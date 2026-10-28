import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { decodeDbcTrades } from '../dist/meteora/decode.js';
import { verifyPoolSnapshot, loadVerifiedDbcPool, DBC_PROGRAM, EVENT_AUTHORITY, WSOL } from '../dist/meteora/pool.js';
import { decodeBase58, encodeBase58, formatUnits } from '../dist/meteora/codec.js';
import { dbcSchema } from '../dist/meteora/dbc-schema.js';
import { startLogsListener } from '../dist/logs-listener.js';

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/dbc-${name}.json`, import.meta.url)));
const accounts = await fixture('accounts');
const buy = await fixture('buy');
const sell = await fixture('sell');
const pool = verifyPoolSnapshot(accounts.addresses[0], accounts);
const copy = value => structuredClone(value);
const group = tx => tx.meta.innerInstructions.find(item => tx.transaction.message.instructions[item.index].programId === DBC_PROGRAM);
const eventInstruction = (tx, name) => group(tx).instructions.find(ix => ix.data && decodeBase58(ix.data).subarray(8, 16).equals(Buffer.from(dbcSchema.events[name])));
function rejected(tx, pattern) {
  const result = decodeDbcTrades(tx, pool);
  assert.equal(result.trades.length, 0);
  assert.ok(result.rejected.some(item => pattern.test(item.reason)), JSON.stringify(result.rejected));
}

test('recorded pool proves programs, mint/vault links, decimals and migration state', () => {
  assert.equal(pool.baseDecimals, 6);
  assert.equal(pool.collectFeeMode, 1);
  assert.equal(pool.quoteMint, WSOL);
  assert.equal(pool.isMigrated, true);
  assert.equal(pool.verificationSlot, 462537098);
  assert.equal(pool.baseMint, 'HnnfZNoKbpZmYYWE6Y71WLbU3ey8qeShT51TtASdtx9M');
});

for (const [side, receipt, raw, lamports, path] of [
  ['buy', buy, '114549982220', '56171396', '5'],
  ['sell', sell, '108670144128', '52712942', '3'],
]) {
  test(`real DBC ${side} matches exact transfer quantities; overlapping event versions yield one trade`, () => {
    const result = decodeDbcTrades(receipt, pool);
    assert.deepEqual(result.rejected, []);
    assert.equal(result.trades.length, 1);
    const trade = result.trades[0];
    assert.equal(trade.side, side);
    assert.equal(trade.tokenAmountRaw, raw);
    assert.equal(trade.solAmountLamports, lamports);
    assert.equal(trade.instructionPath, path);
    assert.equal(trade.slot, 462536749);
    assert.equal(BigInt(trade.priceExact.numerator) * BigInt(raw) * 1_000_000_000n,
      BigInt(trade.priceExact.denominator) * BigInt(lamports) * 1_000_000n);
    assert.equal(trade.fees.mint, side === 'buy' ? pool.baseMint : WSOL);
    assert.deepEqual(decodeDbcTrades(receipt, pool), result, 'replay identity must be deterministic');
  });
}

test('address/instruction codec preserves zero prefixes and exact amount precision', () => {
  for (const address of accounts.addresses) assert.equal(encodeBase58(decodeBase58(address, 32)), address);
  assert.equal(encodeBase58(Buffer.alloc(32)), '1'.repeat(32));
  assert.deepEqual(decodeBase58('1'.repeat(32), 32), Buffer.alloc(32));
  assert.equal(formatUnits(18446744073709551615n, 9), '18446744073.709551615');
  assert.throws(() => decodeBase58('0OIl'));
});

test('failed status and ambiguous CPI recordings cannot create trades', () => {
  const failed = copy(buy); failed.meta.err = { InstructionError: [5, 'Custom'] };
  rejected(failed, /Failed transaction/);
  const incomplete = copy(buy); delete group(incomplete).instructions[0].stackHeight;
  rejected(incomplete, /stack heights/);
  const duplicated = copy(buy); duplicated.meta.innerInstructions.push(copy(group(duplicated)));
  rejected(duplicated, /duplicate CPI group/);
});

test('wrong transfers and mismatched newer events fail closed', () => {
  const altered = copy(buy);
  group(altered).instructions.find(ix => ix.parsed?.type === 'transferChecked').parsed.info.tokenAmount.amount = '1';
  rejected(altered, /transfers/);
  const conflict = copy(buy);
  const event = eventInstruction(conflict, 'EvtSwap3');
  const bytes = decodeBase58(event.data); bytes.writeBigUInt64LE(1n, 84); event.data = encodeBase58(bytes);
  rejected(conflict, /input.*inconsistent/);
});

test('missing, duplicated or extended event evidence is rejected; log text is never trusted', () => {
  const missing = copy(buy);
  const event = eventInstruction(missing, 'EvtSwap2');
  missing.meta.logMessages.push(`Program data: ${decodeBase58(event.data).subarray(16).toString('base64')}`);
  group(missing).instructions = group(missing).instructions.filter(ix => ix !== event);
  rejected(missing, /EvtSwap2/);
  const duplicate = copy(buy); group(duplicate).instructions.push(copy(eventInstruction(duplicate, 'EvtSwap2')));
  rejected(duplicate, /EvtSwap2/);
  const extended = copy(buy); const extra = eventInstruction(extended, 'EvtSwap2');
  extra.data = encodeBase58(Buffer.concat([decodeBase58(extra.data), Buffer.from([0])]));
  rejected(extended, /layout|trailing/);
});

test('event authority and event/instruction pool identities must agree', () => {
  const spoofed = copy(buy); eventInstruction(spoofed, 'EvtSwap2').accounts[0] = WSOL;
  rejected(spoofed, /authority/);
  const wrongPool = copy(buy); const event = eventInstruction(wrongPool, 'EvtSwap2');
  const bytes = decodeBase58(event.data); decodeBase58(WSOL, 32).copy(bytes, 16); event.data = encodeBase58(bytes);
  rejected(wrongPool, /event pool/);
});

test('legacy event-2 fallback is supported without counting the event as another swap', () => {
  const tx = copy(buy); const newer = eventInstruction(tx, 'EvtSwap3');
  group(tx).instructions = group(tx).instructions.filter(ix => ix !== newer);
  assert.equal(decodeDbcTrades(tx, pool).trades[0].tokenAmountRaw, '114549982220');
});

test('unsupported swap2 modes and referral accounts are explicitly rejected', () => {
  const tx = copy(buy); const instruction = tx.transaction.message.instructions[5];
  const bytes = decodeBase58(instruction.data);
  instruction.data = encodeBase58(Buffer.concat([Buffer.from(dbcSchema.instructions.swap2.discriminator), bytes.subarray(8, 24), Buffer.from([1])]));
  rejected(tx, /exact-input/);
  const referral = copy(buy); referral.transaction.message.instructions[5].accounts[12] = WSOL;
  rejected(referral, /Referral/);
});

test('exact-input swap2 uses the same observed amounts as the supported legacy instruction', () => {
  const tx = copy(buy); const instruction = tx.transaction.message.instructions[5];
  const original = decodeBase58(instruction.data);
  instruction.data = encodeBase58(Buffer.concat([Buffer.from(dbcSchema.instructions.swap2.discriminator), original.subarray(8, 24), Buffer.from([0])]));
  const result = decodeDbcTrades(tx, pool);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.trades[0].tokenAmountRaw, '114549982220');
});

test('routed CPI scopes and multiple invocations retain separate instruction identities', () => {
  // Structural mutations of a recorded receipt; these are not actual chain transactions.
  const tx = copy(buy); const original = copy(tx.transaction.message.instructions[5]);
  tx.transaction.message.instructions[5] = { programId: '11111111111111111111111111111111', accounts: [], data: '1', stackHeight: 1 };
  groupForIndex(tx, 5).instructions = [{ ...original, stackHeight: 2 }, ...groupForIndex(tx, 5).instructions.map(ix => ({ ...ix, stackHeight: ix.stackHeight + 1 }))];
  const routed = decodeDbcTrades(tx, pool);
  assert.deepEqual(routed.rejected, []);
  assert.equal(routed.trades[0].instructionPath, '5.0');

  const multiple = copy(buy);
  const index = multiple.transaction.message.instructions.length;
  multiple.transaction.message.instructions.push(copy(original));
  multiple.meta.innerInstructions.push({ index, instructions: copy(group(buy).instructions) });
  const result = decodeDbcTrades(multiple, pool);
  assert.equal(result.trades.length, 2);
  assert.equal(new Set(result.trades.map(trade => trade.id)).size, 2);
});
function groupForIndex(tx, index) { return tx.meta.innerInstructions.find(item => item.index === index); }

test('pool verification rejects owner, address, mint, extension and layout mismatches', () => {
  const mutations = [
    bundle => { bundle.value[0].owner = WSOL; },
    bundle => { bundle.addresses[2] = WSOL; },
    bundle => { bundle.value[2].data.parsed.info.decimals = 7; },
    bundle => { bundle.value[2].data.parsed.info.extensions.push({ extension: 'transferFeeConfig' }); },
    bundle => { bundle.value[2].data.parsed.info.extensions.push({ extension: 'transferHook' }); },
    bundle => { bundle.value[4].data.parsed.info.owner = WSOL; },
    bundle => { bundle.value[0].data[0] = Buffer.from('truncated').toString('base64'); },
    bundle => { bundle.value[1].data[0] = Buffer.concat([Buffer.from(bundle.value[1].data[0], 'base64'), Buffer.from([0])]).toString('base64'); },
  ];
  for (const mutate of mutations) {
    const bundle = copy(accounts); mutate(bundle);
    assert.throws(() => verifyPoolSnapshot(pool.address, bundle));
  }
});

test('pool RPC adapter requests a coherent account bundle and sanitizes provider failures', async (t) => {
  const calls = [];
  let fail = false;
  let stale = false;
  const server = createServer(async (request, response) => {
    let body = ''; for await (const part of request) body += part;
    const call = JSON.parse(body); calls.push(call);
    const result = call.method === 'getAccountInfo' ? { context: accounts.context, value: accounts.value[0] } :
      { context: stale ? { slot: accounts.context.slot - 1 } : accounts.context, value: accounts.value };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(fail ? { jsonrpc: '2.0', id: 1, error: { message: 'test-secret' } } : { jsonrpc: '2.0', id: 1, result }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = new URL(`http://127.0.0.1:${server.address().port}/?api-key=test-secret`);
  assert.equal((await loadVerifiedDbcPool(url, pool.address, new AbortController().signal)).baseMint, pool.baseMint);
  assert.deepEqual(calls[1].params[0], accounts.addresses);
  assert.equal(calls[1].params[1].minContextSlot, accounts.context.slot);
  stale = true;
  await assert.rejects(loadVerifiedDbcPool(url, pool.address, new AbortController().signal), /older/);
  fail = true;
  await assert.rejects(loadVerifiedDbcPool(url, pool.address, new AbortController().signal), error => !String(error).includes('test-secret'));
});

test('pool listener subscribes to pool, skips failed notifications and decodes a real receipt once', async (t) => {
  let requests = 0;
  const outputs = [];
  const server = createServer(async (request, response) => {
    for await (const _ of request) { /* consume test request */ }
    requests++;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: buy }));
  });
  const wss = new WebSocketServer({ server });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let listener;
  t.after(async () => {
    listener?.stop();
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  wss.on('connection', socket => socket.on('message', raw => {
    const request = JSON.parse(raw.toString());
    assert.deepEqual(request.params, [{ mentions: [pool.address] }, { commitment: 'confirmed' }]);
    socket.send(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 9 }));
    for (const [signature, err] of [['2'.repeat(88), { InstructionError: [0, 'Custom'] }], [buy.transaction.signatures[0], null], [buy.transaction.signatures[0], null]]) {
      socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'logsNotification', params: { subscription: 9,
        result: { context: { slot: buy.slot }, value: { signature, err, logs: [] } } } }));
    }
  }));
  const url = `127.0.0.1:${server.address().port}`;
  listener = startLogsListener({ rpcUrl: new URL(`http://${url}`), webSocketUrl: new URL(`ws://${url}`), mint: pool.baseMint,
    mentionsAddress: pool.address, skipFailedTransactions: true, log: () => {},
    onTransaction: (_, tx) => outputs.push(...decodeDbcTrades(tx, pool).trades) });
  for (let i = 0; i < 100 && !outputs.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(outputs.length, 1);
  assert.equal(requests, 1);
});
