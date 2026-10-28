import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MarketStore } from '../dist/storage/market-store.js';
import { verifyPoolSnapshot } from '../dist/meteora/pool.js';
import { decodeDbcTrades } from '../dist/meteora/decode.js';
import { encodeBase58 } from '../dist/meteora/codec.js';
import { recoverSignatures } from '../dist/market/recovery.js';
import { processNextReceipt } from '../dist/market/collector.js';
import { parseSignaturePage } from '../dist/market/rpc.js';
import { createMarketRpc } from '../dist/market/rpc.js';
import { runCollection } from '../dist/market/run.js';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/dbc-${name}.json`, import.meta.url)));
const buy = fixture('buy'), sell = fixture('sell');
const bundle = fixture('accounts');
const pool = verifyPoolSnapshot(bundle.addresses[0], bundle);
const decoded = decodeDbcTrades(buy, pool);
const notice = tx => ({ signature: tx.transaction.signatures[0], slot: tx.slot, err: tx.meta.err, blockTime: tx.blockTime });
const signature = n => { const bytes = Buffer.alloc(64); bytes.writeUInt32BE(n, 60); return encodeBase58(bytes); };
const row = (n, slot = 100) => ({ signature: signature(n), slot, err: null, blockTime: 1793203379, confirmationStatus: 'finalized' });
const signal = () => new AbortController().signal;
function memory(t, now = Date.now) {
  const store = new MarketStore(':memory:', { now }); store.claimPool(pool);
  t.after(() => store.close()); return store;
}
function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 'qrate-market-test-'));
  const stores = [];
  t.after(() => {
    for (const store of stores) store.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('qrate-market-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  return { path: join(directory, 'market.sqlite'), open(options) { const store = new MarketStore(join(directory, 'market.sqlite'), options); stores.push(store); return store; } };
}
const count = (store, state) => Number(store.status(pool.address).receipts?.find(row => row.state === state)?.count ?? 0);

test('exact trades survive reopening and replay does not duplicate or round them', t => {
  const temp = temporary(t);
  const first = temp.open(); first.claimPool(pool); first.enqueue(pool.address, notice(buy));
  assert.equal(first.saveReceipt(pool.address, first.pending(pool.address), buy, decoded), 1);
  first.releaseLease(pool.address); first.close();
  const reopened = temp.open(); reopened.claimPool({ ...pool, verificationSlot: pool.verificationSlot + 100 });
  const replay = structuredClone(decoded); replay.trades[0].verificationSlot += 100;
  assert.equal(reopened.saveReceipt(pool.address, { signature: notice(buy).signature, slot: buy.slot }, buy, replay), 0);
  assert.equal(reopened.trades(pool.address).length, 1);
  assert.equal(reopened.trades(pool.address)[0].tokenAmountRaw, '114549982220');
  assert.equal(reopened.trades(pool.address)[0].solAmountLamports, '56171396');
  const readOnly = temp.open({ readOnly: true });
  assert.equal(readOnly.status(pool.address).trades, 1);
});

test('invalid/conflicting batches roll back all trade inserts and receipt completion', t => {
  const store = memory(t); store.enqueue(pool.address, notice(buy));
  const job = store.pending(pool.address);
  const invalid = structuredClone(decoded);
  invalid.trades.push({ ...invalid.trades[0], instructionPath: '6', tokenAmountRaw: '0' });
  assert.throws(() => store.saveReceipt(pool.address, job, buy, invalid), /raw quantities/);
  assert.equal(store.trades(pool.address).length, 0);
  assert.equal(count(store, 'pending'), 1);
  store.saveReceipt(pool.address, job, buy, decoded);
  const conflict = structuredClone(decoded); conflict.trades[0].user = pool.quoteMint;
  assert.throws(() => store.saveReceipt(pool.address, job, buy, conflict), /Conflicting trade/);
  assert.equal(store.trades(pool.address)[0].tokenAmountRaw, '114549982220');
  assert.throws(() => store.saveReceipt(pool.address, job, buy, { trades: [], rejected: [] }), /saved receipt outcome/);
});

test('storage rejects a wrong price ratio or unit conversion before any trade is committed', t => {
  const store = memory(t); store.enqueue(pool.address, notice(buy));
  const incorrect = structuredClone(decoded); incorrect.trades[0].priceExact.numerator = '1';
  assert.throws(() => store.saveReceipt(pool.address, store.pending(pool.address), buy, incorrect), /price\/units/);
  assert.equal(store.trades(pool.address).length, 0);
  assert.equal(count(store, 'pending'), 1);
});

test('crashed in-flight jobs are replayable after lease expiry; competing collectors cannot write', t => {
  const temp = temporary(t); let now = 1000;
  const first = temp.open({ now: () => now }); first.claimPool(pool); first.enqueue(pool.address, notice(buy));
  first.beginAttempt(pool.address, notice(buy).signature);
  const second = temp.open({ now: () => now });
  assert.throws(() => second.claimPool(pool), /Another collector/);
  first.close(); // No release simulates a crash after work started.
  now += 90_001; second.claimPool(pool);
  assert.equal(second.pending(pool.address).attempts, 1);
  assert.equal(second.saveReceipt(pool.address, second.pending(pool.address), buy, decoded), 1);
  assert.equal(count(second, 'done'), 1);
});

test('expired owners cannot commit after a replacement acquires the pool', t => {
  const temp = temporary(t); let now = 0;
  const first = temp.open({ now: () => now }); first.claimPool(pool); first.enqueue(pool.address, notice(buy));
  const job = first.pending(pool.address);
  now += 90_001;
  const second = temp.open({ now: () => now }); second.claimPool(pool);
  assert.throws(() => first.saveReceipt(pool.address, job, buy, decoded), /lease was lost/);
  assert.equal(second.trades(pool.address).length, 0);
});

test('multi-page same-slot recovery resumes its saved cursor after restart and catches newer arrivals next pass', async t => {
  const temp = temporary(t); let now = 0;
  const first = temp.open({ now: () => now }); first.claimPool(pool); first.applyPage(pool.address, [row(1)]);
  const rpc = { signatures: async (_pool, before) => { assert.equal(before, null); return [row(4), row(3)]; } };
  const pass = await recoverSignatures(first, pool.address, rpc, signal(), 1);
  assert.equal(pass.complete, false);
  assert.equal(first.scanState(pool.address).checkpoint_signature, signature(1));
  assert.equal(first.scanState(pool.address).scan_before, signature(3));
  first.close(); now += 90_001;
  const reopened = temp.open({ now: () => now }); reopened.claimPool(pool);
  const finish = await recoverSignatures(reopened, pool.address, { signatures: async (_pool, before) => {
    assert.equal(before, signature(3)); return [row(2), row(1)];
  } }, signal());
  assert.equal(finish.complete, true);
  assert.equal(reopened.scanState(pool.address).checkpoint_signature, signature(4));
  assert.equal(count(reopened, 'pending'), 4);
  await recoverSignatures(reopened, pool.address, { signatures: async () => [row(5, 101), row(4)] }, signal());
  assert.equal(reopened.scanState(pool.address).checkpoint_signature, signature(5));
  assert.equal(count(reopened, 'pending'), 5);
});

test('unavailable history reports a gap without advancing the anchor, and can resume when restored', async t => {
  const store = memory(t); store.applyPage(pool.address, [row(1)]);
  let call = 0;
  const result = await recoverSignatures(store, pool.address, { signatures: async () => ++call === 1 ? [row(4), row(3)] : [] }, signal());
  assert.equal(result.gap, true);
  assert.equal(store.scanState(pool.address).checkpoint_signature, signature(1));
  assert.match(store.scanState(pool.address).scan_error, /coverage gap/);
  const restored = await recoverSignatures(store, pool.address, { signatures: async (_pool, before) => {
    assert.equal(before, signature(3)); return [row(2), row(1)];
  } }, signal());
  assert.equal(restored.complete, true);
  assert.equal(store.scanState(pool.address).checkpoint_signature, signature(4));
  assert.equal(store.scanState(pool.address).scan_error, null);
});

test('RPC outages and malformed/non-advancing pages preserve checkpoint and durable pagination', async t => {
  const store = memory(t); store.applyPage(pool.address, [row(1)]);
  let call = 0;
  const result = await recoverSignatures(store, pool.address, { signatures: async () => {
    if (++call === 1) return [row(3), row(2)]; throw new Error('private-provider-url');
  } }, signal());
  assert.equal(result.error, true);
  assert.equal(store.scanState(pool.address).checkpoint_signature, signature(1));
  assert.equal(store.scanState(pool.address).scan_before, signature(2));
  assert.doesNotMatch(store.scanState(pool.address).scan_error, /private-provider-url/);
  await recoverSignatures(store, pool.address, { signatures: async () => [row(2)] }, signal());
  assert.equal(store.scanState(pool.address).scan_before, signature(2));
  assert.throws(() => parseSignaturePage([row(1), row(1)], null, undefined));
  assert.throws(() => parseSignaturePage([{ ...row(1), confirmationStatus: 'confirmed' }], null, undefined));
});

test('pending receipt failures remain retriable, then real buy/sell commit exactly once', async t => {
  let now = 0; const store = memory(t, () => now);
  store.enqueue(pool.address, notice(buy)); store.enqueue(pool.address, notice(sell));
  const controller = new AbortController();
  assert.equal(await processNextReceipt(store, pool, { transaction: async () => { throw new Error('RPC outage'); } }, controller.signal), false);
  assert.equal(count(store, 'pending'), 2);
  const realRpc = { transaction: async signature => signature === notice(buy).signature ? buy : sell };
  assert.equal(await processNextReceipt(store, pool, realRpc, controller.signal), true);
  now += 300_001; store.claimPool(pool);
  assert.equal(await processNextReceipt(store, pool, realRpc, controller.signal), true);
  assert.equal(await processNextReceipt(store, pool, realRpc, controller.signal), false);
  assert.equal(store.trades(pool.address).length, 2);
  assert.equal(count(store, 'done'), 2);
});

test('cancellation, missing metadata and mismatched receipts never complete a pending job', async t => {
  let now = 0; const store = memory(t, () => now); store.enqueue(pool.address, notice(buy));
  const incomplete = structuredClone(buy); incomplete.meta = null;
  await processNextReceipt(store, pool, { transaction: async () => incomplete }, signal());
  assert.equal(count(store, 'pending'), 1); now += 300_001; store.claimPool(pool);
  await processNextReceipt(store, pool, { transaction: async () => sell }, signal());
  assert.equal(count(store, 'pending'), 1); now += 300_001; store.claimPool(pool);
  const controller = new AbortController();
  await processNextReceipt(store, pool, { transaction: async () => { controller.abort(); return buy; } }, controller.signal);
  assert.equal(count(store, 'pending'), 1);
  assert.equal(store.trades(pool.address).length, 0);
});

test('failed chain signatures and unsupported receipts are visible without fabricated trades', async t => {
  const store = memory(t);
  store.enqueue(pool.address, { ...row(88), err: { InstructionError: [0, 'Custom'] } });
  store.enqueue(pool.address, notice(buy));
  const unsupported = structuredClone(buy); unsupported.transaction.message.instructions[5].accounts[12] = pool.quoteMint;
  await processNextReceipt(store, pool, { transaction: async () => unsupported }, signal());
  assert.equal(count(store, 'failed'), 1);
  assert.equal(count(store, 'rejected'), 1);
  assert.equal(store.trades(pool.address).length, 0);
});

test('pool partitions are isolated and unrelated legacy databases are not changed', t => {
  const store = memory(t); const other = { ...pool, address: '11111111111111111111111111111111' };
  store.claimPool(other); store.enqueue(other.address, notice(buy));
  assert.equal(store.pending(pool.address), undefined);
  assert.ok(store.pending(other.address));
  assert.throws(() => store.saveReceipt(other.address, store.pending(other.address), buy, decoded), /trade identity/);
  const temp = temporary(t); const foreign = new DatabaseSync(temp.path);
  foreign.exec('CREATE TABLE legacy(value TEXT); INSERT INTO legacy VALUES (\'keep\');'); foreign.close();
  assert.throws(() => temp.open(), /unrelated/);
  const check = new DatabaseSync(temp.path, { readOnly: true });
  assert.equal(check.prepare('SELECT value FROM legacy').get().value, 'keep'); check.close();
});

test('passing the checkpoint slot without its signature flags a gap and retains a recoverable cursor', async t => {
  const store = memory(t); store.applyPage(pool.address, [row(1, 100)]);
  const result = await recoverSignatures(store, pool.address, { signatures: async () => [row(3, 101), row(99, 99)] }, signal());
  assert.equal(result.gap, true);
  assert.equal(store.scanState(pool.address).checkpoint_signature, signature(1));
  assert.equal(store.scanState(pool.address).scan_before, null);
  assert.equal(store.signatureSlot(pool.address, signature(99)), undefined);
  const restored = await recoverSignatures(store, pool.address, { signatures: async () => [row(3, 101), row(1, 100)] }, signal());
  assert.equal(restored.complete, true);
});

test('signature page rows and checkpoint updates roll back together on metadata conflict', t => {
  const store = memory(t); store.applyPage(pool.address, [row(1, 100)]);
  assert.throws(() => store.applyPage(pool.address, [row(3, 101), row(1, 99)]), /Checkpoint slot/);
  assert.equal(store.signatureSlot(pool.address, signature(3)), undefined);
  assert.equal(store.scanState(pool.address).checkpoint_signature, signature(1));
});

test('production RPC adapter requests finalized pages/receipts and honors a shared 429 cooldown', async t => {
  const calls = []; let throttle = false;
  const server = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body); calls.push(rpc);
    response.setHeader('Content-Type', 'application/json');
    if (throttle) { response.writeHead(429, { 'Retry-After': '60' }); response.end('{}'); return; }
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: rpc.method === 'getTransaction' ? buy : [row(1)] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const rpc = createMarketRpc(new URL(`http://127.0.0.1:${server.address().port}/?api-key=test-secret`));
  await rpc.signatures(pool.address, signature(2), 99, signal());
  await rpc.transaction(notice(buy).signature, signal());
  assert.equal(calls[0].params[1].commitment, 'finalized');
  assert.equal(calls[0].params[1].limit, 100);
  assert.equal(calls[0].params[1].before, signature(2));
  assert.equal(calls[0].params[1].minContextSlot, 99);
  assert.equal(calls[1].params[1].commitment, 'finalized');
  throttle = true;
  await assert.rejects(rpc.signatures(pool.address, null, null, signal()), error => !String(error).includes('test-secret'));
  const countBefore = calls.length;
  await assert.rejects(rpc.signatures(pool.address, null, null, AbortSignal.timeout(30)));
  assert.equal(calls.length, countBefore, 'cooldown wait must not issue another HTTP request');
});

test('one-shot recovery saves recorded trades and a repeated pass is idempotent', async t => {
  const store = memory(t);
  const rpc = { signatures: async () => [notice(buy), notice(sell)].map(row => ({ ...row, confirmationStatus: 'finalized' })),
    transaction: async signature => signature === notice(buy).signature ? buy : sell };
  const options = { pool, store, rpc, rpcUrl: new URL('http://127.0.0.1:1'), webSocketUrl: new URL('ws://127.0.0.1:1'),
    signal: signal(), live: false, log: () => {} };
  const status = await runCollection(options);
  assert.equal(status.trades, 2);
  assert.equal(status.discoveryState, 'up-to-checkpoint');
  const repeated = await runCollection(options);
  assert.equal(repeated.trades, 2);
});

test('a storage commit failure stops collection and leaves the job available for safe retry', async t => {
  const store = memory(t);
  const rpc = { signatures: async () => [{ ...notice(buy), confirmationStatus: 'finalized' }], transaction: async () => buy };
  const options = { pool, store, rpc, rpcUrl: new URL('http://127.0.0.1:1'), webSocketUrl: new URL('ws://127.0.0.1:1'),
    signal: signal(), live: false, log: () => {} };
  const realSave = store.saveReceipt;
  store.saveReceipt = () => { throw new Error('Simulated disk write failure'); };
  await assert.rejects(runCollection(options), /disk write failure/);
  assert.equal(store.trades(pool.address).length, 0);
  assert.equal(count(store, 'pending'), 1);
  store.saveReceipt = realSave;
  const resumed = await runCollection(options);
  assert.equal(resumed.trades, 1);
  assert.equal(count(store, 'done'), 1);
});

test('live reconnect recovers an offline trade and deduplicates overlapping socket/recovery receipts', { timeout: 12000 }, async t => {
  const temp = temporary(t); const store = temp.open();
  const old = { ...row(10, buy.slot - 1), err: { InstructionError: [0, 'Custom'] } };
  store.claimPool(pool); store.applyPage(pool.address, [old]); store.releaseLease(pool.address);
  const server = createServer(); const wss = new WebSocketServer({ server });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const controller = new AbortController(); let missed = false; let subscriptions = 0;
  const fetched = [];
  const rpc = { signatures: async () => (missed ? [notice(sell), notice(buy), old] : [notice(buy), old])
    .map(row => ({ ...row, confirmationStatus: 'finalized' })),
    transaction: async signature => { fetched.push(signature); return signature === notice(buy).signature ? buy : sell; } };
  wss.on('connection', socket => socket.on('message', raw => {
    const request = JSON.parse(raw.toString());
    assert.deepEqual(request.params, [{ mentions: [pool.address] }, { commitment: 'finalized' }]);
    subscriptions++;
    socket.send(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 7 }));
    for (let i = 0; i < 2; i++) socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'logsNotification',
      params: { subscription: 7, result: { context: { slot: buy.slot }, value: { signature: notice(buy).signature, err: null } } } }));
  }));
  const url = `127.0.0.1:${server.address().port}`;
  const running = runCollection({ pool: { ...pool, isMigrated: false }, store, rpc,
    rpcUrl: new URL(`http://${url}`), webSocketUrl: new URL(`ws://${url}`), signal: controller.signal,
    live: true, recoveryIntervalMs: 60_000, log: () => {} });
  t.after(async () => {
    controller.abort(); await running.catch(() => {});
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  async function until(condition) { for (let i = 0; i < 160; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('Live recovery timed out'); }
  await until(() => store.trades(pool.address).length === 1 && subscriptions >= 1);
  missed = true;
  for (const client of wss.clients) client.terminate();
  await until(() => store.trades(pool.address).length === 2 && subscriptions >= 2);
  controller.abort(); await running;
  assert.equal(new Set(fetched).size, 2);
  assert.equal(fetched.length, 2);
  assert.equal(store.scanState(pool.address).checkpoint_signature, notice(sell).signature);
  const other = temp.open(); other.claimPool(pool); // Graceful shutdown released the lease.
});
