import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { verifyPoolSnapshot } from '../dist/meteora/pool.js';
import { verifyDammSnapshot, loadVerifiedDammPool, DAMM_PROGRAM, DammVerificationError } from '../dist/meteora/damm-pool.js';
import { decodeDammTrades } from '../dist/meteora/damm-decode.js';
import { migrationDestination, verifyMigration } from '../dist/meteora/migration.js';
import { dammSchema } from '../dist/meteora/damm-schema.js';
import { encodeBase58, decodeBase58 } from '../dist/meteora/codec.js';
import { MarketStore } from '../dist/storage/market-store.js';
import { processNextReceipt } from '../dist/market/collector.js';
import { runCollection } from '../dist/market/run.js';
import { WebSocketServer } from 'ws';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const accounts = fixture('damm-accounts'), dbcAccounts = fixture('dbc-accounts');
const pool = verifyDammSnapshot(accounts.addresses[0], accounts), source = verifyPoolSnapshot(dbcAccounts.addresses[0], dbcAccounts);
const buy = fixture('damm-buy'), sell = fixture('damm-sell'), migration = fixture('dbc-damm-migration');
const notice = tx => ({ signature: tx.transaction.signatures[0], slot: tx.slot, err: tx.meta.err, blockTime: tx.blockTime });
const pageRow = tx => ({ ...notice(tx), confirmationStatus: 'finalized' });
const signal = () => new AbortController().signal;
const instructions = tx => [...tx.transaction.message.instructions, ...tx.meta.innerInstructions.flatMap(g => g.instructions)];
const swap = tx => instructions(tx).find(ix => ix.programId === DAMM_PROGRAM && ix.data && ['swap','swap2'].some(name => decodeBase58(ix.data).subarray(0,8).equals(Buffer.from(dammSchema.instructions[name].discriminator))));
const event = tx => instructions(tx).find(ix => ix.programId === DAMM_PROGRAM && ix.data && decodeBase58(ix.data).subarray(8,16).equals(Buffer.from(dammSchema.events.EvtSwap2)));
function memory(t, selected = pool) { const store = new MarketStore(':memory:'); store.claimPool(selected); t.after(() => store.close()); return store; }
function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 'qrate-damm-test-')), stores = [];
  t.after(() => {
    stores.forEach(s => s.close());
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('qrate-damm-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  return { path: join(directory, 'market.sqlite'), open() { const store = new MarketStore(join(directory, 'market.sqlite')); stores.push(store); return store; } };
}
const reject = tx => { const decoded = decodeDammTrades(tx, pool); assert.equal(decoded.trades.length, 0); assert.ok(decoded.rejected.length); };

test('real routed DAMM buy and direct sell reconcile exact raw amounts and fee mints', () => {
  const b = decodeDammTrades(buy, pool), s = decodeDammTrades(sell, pool);
  assert.deepEqual(b.rejected, []); assert.deepEqual(s.rejected, []);
  assert.equal(b.trades.length, 1); assert.equal(s.trades.length, 1);
  assert.equal(b.trades[0].instructionPath, '6.0'); assert.equal(b.trades[0].side, 'buy');
  assert.equal(b.trades[0].tokenAmountRaw, '74333841118890'); assert.equal(b.trades[0].solAmountLamports, '300000');
  assert.equal(b.trades[0].fees.mint, pool.baseMint);
  assert.equal(s.trades[0].side, 'sell'); assert.equal(s.trades[0].tokenAmountRaw, '2937510166127');
  assert.equal(s.trades[0].solAmountLamports, '10872'); assert.equal(s.trades[0].fees.mint, pool.quoteMint);
  assert.equal(s.trades[0].protocol, 'meteora-damm-v2');
});

test('DAMM rejects altered authorities, transfer amounts, parameters, unsupported modes and referrals', () => {
  for (const change of [
    tx => { swap(tx).accounts[0] = pool.address; },
    tx => { event(tx).accounts[0] = pool.address; },
    tx => { swap(tx).accounts[11] = pool.baseVault; },
    tx => { instructions(tx).find(ix => ix.parsed?.type === 'transferChecked').parsed.info.tokenAmount.amount = '1'; },
    tx => { const ix = swap(tx), data = decodeBase58(ix.data); data[8] ^= 1; ix.data = encodeBase58(data); },
    tx => { const ix = swap(tx), data = decodeBase58(ix.data); ix.data = encodeBase58(Buffer.concat([Buffer.from(dammSchema.instructions.swap2.discriminator),data.subarray(8,24),Buffer.from([2])])); },
    tx => { tx.meta.err = { InstructionError: [4, 'Custom'] }; },
    tx => { const ix = event(tx), data = decodeBase58(ix.data); data[50] = 1; ix.data = encodeBase58(data); },
    tx => { const ix = event(tx), data = decodeBase58(ix.data); ix.data = encodeBase58(data.subarray(0, data.length - 1)); },
  ]) { const tx = structuredClone(sell); change(tx); reject(tx); }
});

test('DAMM authenticated event cannot be missing, duplicated, or borrowed from a different CPI scope', () => {
  let tx = structuredClone(sell); const evt = event(tx); tx.meta.innerInstructions.find(g => g.index === 4).instructions = tx.meta.innerInstructions.find(g => g.index === 4).instructions.filter(ix => ix !== evt); reject(tx);
  tx = structuredClone(sell); tx.meta.innerInstructions.find(g => g.index === 4).instructions.push(structuredClone(event(tx))); reject(tx);
  tx = structuredClone(buy); event(tx).stackHeight = 2; reject(tx);
  tx = structuredClone(sell); delete event(tx).stackHeight; reject(tx);
});

test('legacy DAMM swap uses the same exact observed execution; known non-swaps create no trades', () => {
  const tx = structuredClone(sell), ix = swap(tx), data = decodeBase58(ix.data);
  ix.data = encodeBase58(Buffer.concat([Buffer.from(dammSchema.instructions.swap.discriminator), data.subarray(8,24)]));
  assert.equal(decodeDammTrades(tx, pool).trades[0].solAmountLamports, '10872');
  ix.data = encodeBase58(Buffer.concat([Buffer.from(dammSchema.instructions.swap2.discriminator), data.subarray(8,24), Buffer.from([0])]));
  assert.equal(decodeDammTrades(tx, pool).trades[0].solAmountLamports, '10872');
  const init = decodeDammTrades(migration, pool);
  assert.equal(init.trades.length, 0); assert.deepEqual(init.rejected, []);
});

test('DAMM snapshot rejects wrong ownership, layouts, flags, quote, extensions and vault relationships', () => {
  for (const change of [
    b => { b.value[0].owner = pool.address; },
    b => { const bytes = Buffer.from(b.value[0].data[0], 'base64'); b.value[0].data[0] = bytes.subarray(0, bytes.length - 1).toString('base64'); },
    b => { b.addresses[2] = source.address; },
    b => { b.value[3].data.parsed.info.owner = pool.address; },
    b => { b.value[4].data.parsed.info.mint = pool.baseMint; },
    b => { b.value[1].data.parsed.info.extensions.push({ extension: 'transferFeeConfig' }); },
    b => { b.value[2].data.parsed.info.decimals = 6; },
  ]) { const copy = structuredClone(accounts); change(copy); assert.throws(() => verifyDammSnapshot(pool.address, copy)); }
});

test('DAMM RPC verifier uses finalized coherent account reads and rejects regressing snapshots', async () => {
  const calls = [];
  const fetcher = async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    const result = body.method === 'getAccountInfo' ? { context: accounts.context, value: accounts.value[0] } : accounts;
    return Response.json({ jsonrpc: '2.0', id: 1, result });
  };
  const verified = await loadVerifiedDammPool(new URL('https://example.invalid/private'), pool.address, signal(), fetcher);
  assert.equal(verified.baseMint, pool.baseMint); assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.params[1].commitment === 'finalized'));
  assert.equal(calls[1].params[1].minContextSlot, accounts.context.slot);
  let n = 0;
  await assert.rejects(loadVerifiedDammPool(new URL('https://example.invalid/private'), pool.address, signal(), async () => Response.json({jsonrpc:'2.0',id:1,result: ++n === 1 ? {context:{slot:accounts.context.slot + 1},value:accounts.value[0]} : accounts})), /predates/);
});

test('real finalized migration proves both pools and direct initialization; matching mints alone do not', () => {
  const link = verifyMigration(migration, source, pool);
  assert.equal(link.destinationPool, pool.address); assert.equal(link.slot, 462536876);
  assert.equal(migrationDestination(migration, source), pool.address);
  for (const change of [
    tx => { tx.meta.err = { InstructionError: [0, 'Failed'] }; },
    tx => { tx.transaction.message.instructions[0].accounts[4] = source.address; },
    tx => { tx.transaction.message.instructions[0].accounts[13] = pool.address; },
    tx => { tx.meta.innerInstructions[0].instructions.find(ix => ix.programId === DAMM_PROGRAM).accounts[7] = source.address; },
    tx => { tx.meta.innerInstructions[0].instructions.find(ix => ix.programId === DAMM_PROGRAM).stackHeight = 3; },
  ]) { const tx = structuredClone(migration); change(tx); assert.throws(() => verifyMigration(tx, source, pool)); }
  assert.throws(() => verifyMigration(migration, source, { ...pool, baseMint: source.address }));
  assert.throws(() => verifyMigration(migration, source, { ...pool, verificationSlot: migration.slot - 1 }));
});

test('DAMM trade persistence is exact, replay-safe and rejects the wrong protocol', t => {
  const store = memory(t); store.enqueue(pool.address, notice(buy)); const job = store.pending(pool.address), result = decodeDammTrades(buy, pool);
  assert.equal(store.saveReceipt(pool.address, job, buy, result), 1);
  assert.equal(store.saveReceipt(pool.address, job, buy, result), 0);
  assert.equal(store.trades(pool.address)[0].tokenAmountRaw, '74333841118890');
  const bad = structuredClone(result); bad.trades[0].protocol = 'meteora-dbc';
  assert.throws(() => store.saveReceipt(pool.address, job, buy, bad), /identity/);
});

test('migration outcome, pool link and creation recovery anchor commit together and survive reopen', async t => {
  const temp = temporary(t), store = temp.open(); store.claimPool(source); store.enqueue(source.address, notice(migration));
  const rpc = { transaction: async () => migration, dammPool: async () => pool };
  assert.equal(await processNextReceipt(store, source, rpc, signal()), true);
  const link = store.migration(source.address); assert.equal(link.destinationPool, pool.address);
  assert.equal(store.status(pool.address).checkpoint, notice(migration).signature);
  assert.equal(store.status(pool.address).discoveryState, 'not-started');
  store.releaseLease(source.address); store.close();
  const reopened = temp.open(); reopened.claimPool(source);
  assert.equal(reopened.migration(source.address).destination.verificationSlot, pool.verificationSlot);
  assert.equal(reopened.status(source.address).receipts[0].state, 'ignored');
  assert.equal(reopened.status(pool.address).bootstrap, 'verified-migration-signature');
});

test('invalid migration and unavailable target cannot advance the source job or create a link', async t => {
  const store = memory(t, source); store.enqueue(source.address, notice(migration));
  assert.equal(await processNextReceipt(store, source, { transaction: async () => migration, dammPool: async () => {throw Error('RPC unavailable');} }, signal()), false);
  assert.equal(store.status(source.address).pendingCount, 1); assert.equal(store.migration(source.address), undefined);
  store.enqueueMigrationEvidence(source.address, notice(migration));
  assert.equal(await processNextReceipt(store, source, { transaction: async () => migration, dammPool: async () => ({ ...pool, baseMint: source.address }) }, signal()), true);
  assert.equal(store.status(source.address).receipts[0].state, 'rejected'); assert.equal(store.migration(source.address), undefined);
  store.enqueueMigrationEvidence(source.address, notice(migration));
  assert.equal(await processNextReceipt(store, source, { transaction: async () => migration, dammPool: async () => {throw new DammVerificationError('Unsupported target fee mode.');} }, signal()), true);
  assert.equal(store.status(source.address).pendingCount, 0);
  assert.equal(store.status(source.address).receipts[0].state, 'rejected');
});

test('link conflict rolls back the receipt and target registration; saved links cannot be removed by replay', t => {
  const store = memory(t, source); store.enqueue(source.address, notice(migration)); const job = store.pending(source.address);
  const link = verifyMigration(migration, source, pool);
  assert.throws(() => store.saveReceipt(source.address, job, migration, { trades: [], rejected: [], migration: {...link, destination: {...pool, baseMint: source.address}} }), /identity/);
  assert.equal(store.status(source.address).pendingCount, 1); assert.equal(store.status(pool.address).state, 'not-collected');
  store.saveReceipt(source.address, job, migration, { trades: [], rejected: [], migration: link });
  assert.throws(() => store.saveReceipt(source.address, job, migration, { trades: [], rejected: [] }), /remove/);
  assert.throws(() => store.saveReceipt(source.address, job, migration, { trades: [], rejected: [], migration: {...link, destinationPool: source.address} }), /identity/);
});

test('schema 1 gains migration tracking without changing its existing exact trades', t => {
  const temp = temporary(t), store = temp.open(); store.claimPool(pool); store.enqueue(pool.address, notice(sell));
  store.saveReceipt(pool.address, store.pending(pool.address), sell, decodeDammTrades(sell,pool)); store.releaseLease(pool.address); store.close();
  const db = new DatabaseSync(temp.path); db.exec('DROP TABLE migrations; PRAGMA user_version=1;'); db.close();
  assert.throws(() => new MarketStore(temp.path, {readOnly:true}), /requires a writable/);
  const upgraded = temp.open(); assert.equal(upgraded.trades(pool.address)[0].solAmountLamports, '10872');
  assert.equal(upgraded.migration(source.address), undefined);
});

test('a late database failure rolls back migration outcome, target and anchor together', t => {
  const temp = temporary(t), store = temp.open(); store.claimPool(source); store.enqueue(source.address,notice(migration));
  const db = new DatabaseSync(temp.path);
  db.exec("CREATE TRIGGER reject_link BEFORE INSERT ON migrations BEGIN SELECT RAISE(ABORT,'simulated link write failure'); END;"); db.close();
  assert.throws(()=>store.saveReceipt(source.address,store.pending(source.address),migration,{trades:[],rejected:[],migration:verifyMigration(migration,source,pool)}),/write failure/);
  assert.equal(store.status(source.address).pendingCount,1); assert.equal(store.status(pool.address).state,'not-collected');
  assert.equal(store.migration(source.address),undefined);
});

test('migration extends an existing standalone bootstrap, but cannot reset an active destination collector', t => {
  const store=memory(t,source);store.claimPool(pool);store.applyPage(pool.address,[pageRow(buy)]);
  store.enqueue(source.address,notice(migration));const job=store.pending(source.address),result={trades:[],rejected:[],migration:verifyMigration(migration,source,pool)};
  assert.throws(()=>store.saveReceipt(source.address,job,migration,result),/already collecting/);
  assert.equal(store.status(pool.address).checkpoint,notice(buy).signature);assert.equal(store.migration(source.address),undefined);
  store.releaseLease(pool.address);store.saveReceipt(source.address,job,migration,result);
  assert.equal(store.status(pool.address).checkpoint,notice(migration).signature);
  assert.equal(store.status(pool.address).coverageStart,notice(migration).signature);
  assert.equal(store.status(pool.address).pendingCount,1); // Existing jobs were preserved.
});

test('graduated DBC without migration evidence is explicitly incomplete and never guesses a destination', async t => {
  const store=memory(t,source);
  const status=await runCollection({pool:source,store,rpc:{signatures:async()=>[],transaction:async()=>{throw Error('no job');}},signal:signal(),live:false,rpcUrl:new URL('http://127.0.0.1'),webSocketUrl:new URL('ws://127.0.0.1'),log:()=>{}});
  assert.match(status.migrationState,/evidence-not-found/); assert.equal(status.followed,undefined);
});

test('one-shot collector follows verified migration, recovers beyond 100 rows and resumes persisted links', async t => {
  const temp = temporary(t), store = temp.open();
  const signature = n => {const bytes = Buffer.alloc(64); bytes.writeUInt32BE(n,60);return encodeBase58(bytes);};
  const newer = Array.from({length:100},(_,i)=>({signature:signature(1000+i),slot:buy.slot+100-i,err:{InstructionError:[0,'failed']},blockTime:buy.blockTime,confirmationStatus:'finalized'}));
  let pages = 0, verified = 0;
  const rpc = {
    signatures: async (address, before) => {
      if(address === source.address) return [pageRow(migration)];
      pages++;
      return before === newer.at(-1).signature ? [pageRow(buy),pageRow(sell),pageRow(migration)] : newer;
    },
    transaction: async sig => sig === notice(migration).signature ? migration : sig === notice(buy).signature ? buy : sell,
    dammPool: async () => {verified++;return pool;},
  };
  const options = {pool:source,store,rpc,signal:signal(),live:false,rpcUrl:new URL('http://127.0.0.1'),webSocketUrl:new URL('ws://127.0.0.1'),log:()=>{}};
  const first = await runCollection(options);
  assert.equal(first.followed.trades,2); assert.equal(first.followed.scanBefore,null); assert.equal(pages,2);
  assert.equal(first.followed.coverageStart,notice(migration).signature);
  store.close(); const reopened = temp.open();
  const again = await runCollection({...options,store:reopened});
  assert.equal(again.followed.trades,2); assert.ok(verified>=3);
});

test('explicit migration evidence can recover an older unsupported job without altering source bootstrap', async t => {
  const store = memory(t,source); store.enqueue(source.address,notice(migration));
  const job = store.pending(source.address);
  store.saveReceipt(source.address,job,migration,{trades:[],rejected:[{instructionPath:'0',reason:'Unsupported DBC instruction/version.'}]});
  const rpc={signatures:async address=> address===source.address ? [pageRow(fixture('dbc-buy'))] : [pageRow(migration)],transaction:async sig=>sig===notice(migration).signature?migration:fixture('dbc-buy'),dammPool:async()=>pool};
  const status=await runCollection({pool:source,store,rpc,signal:signal(),live:false,migrationSignature:notice(migration).signature,rpcUrl:new URL('http://127.0.0.1'),webSocketUrl:new URL('ws://127.0.0.1'),log:()=>{}});
  assert.equal(status.migration.destinationPool,pool.address); assert.equal(status.followed.pendingCount,0);
});

test('live collector follows migration and closes both pool subscriptions on cancellation', async t => {
  const server = new WebSocketServer({host:'127.0.0.1',port:0}); await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(resolve=>{server.clients.forEach(c=>c.terminate());server.close(resolve);}));
  const store = memory(t,source), controller = new AbortController(), subscribed = new Set();
  const timer=setTimeout(()=>controller.abort(),3000);t.after(()=>clearTimeout(timer));
  server.on('connection',socket=>socket.on('message',raw=>{
    const message=JSON.parse(raw);subscribed.add(message.params[0].mentions[0]);socket.send(JSON.stringify({jsonrpc:'2.0',id:1,result:subscribed.size}));
  }));
  const rpc={signatures:async address=> address===source.address?[pageRow(migration)]:[pageRow(buy),pageRow(migration)],transaction:async sig=>sig===notice(migration).signature?migration:buy,dammPool:async()=>pool};
  const poll=setInterval(()=>{if(store.status(pool.address).trades===1&&subscribed.size===2)controller.abort();},10);t.after(()=>clearInterval(poll));
  const result=await runCollection({pool:source,store,rpc,signal:controller.signal,live:true,recoveryIntervalMs:20,rpcUrl:new URL('http://127.0.0.1'),webSocketUrl:new URL(`ws://127.0.0.1:${server.address().port}`),log:()=>{}});
  assert.deepEqual(subscribed,new Set([source.address,pool.address])); assert.equal(result.followed.trades,1);
  store.claimPool(pool); store.releaseLease(pool.address); // Both collectors released their leases.
});
