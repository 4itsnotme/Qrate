// Chain reads only. Collection writes local analytics data, never signs/submits transactions.
import { existsSync } from 'node:fs';
import { getHeliusRpcUrl, getHeliusWebSocketUrl } from './config.js';
import { getTransaction } from './transaction-rpc.js';
import { decodeDbcTrades } from './meteora/decode.js';
import { decodeBase58, publicKey, requireThat } from './meteora/codec.js';
import { loadVerifiedDbcPool } from './meteora/pool.js';
import { MarketStore, defaultMarketDatabase } from './storage/market-store.js';
import { createMarketRpc } from './market/rpc.js';
import { runCollection } from './market/run.js';
import { loadVerifiedDammPool } from './meteora/damm-pool.js';
import { decodeDammTrades } from './meteora/damm-decode.js';
import { isDammPool } from './meteora/market-types.js';

const args = process.argv.slice(2);
const usage = 'Usage: inspect --pool <address> --signature <signature> [--protocol dbc|damm-v2] | listen --pool <address> [--protocol dbc|damm-v2] [--migration-signature <signature>] [--seconds 10] [--db path] | recover --pool <address> [--protocol dbc|damm-v2] [--migration-signature <signature>] [--max-pages 20] [--max-jobs 500] [--db path] | status --pool <address> [--db path]';
const controller = new AbortController();
let timer: ReturnType<typeof setTimeout> | undefined;
let store: MarketStore | undefined;
const stop = () => controller.abort();

try {
  if (args.includes('--help')) console.log(usage);
  else {
    const mode = args.shift();
    requireThat(mode && ['inspect', 'listen', 'recover', 'status'].includes(mode), usage);
    const values = new Map<string, string>();
    const allowed: Record<string, string[]> = {
      inspect: ['--pool', '--signature', '--protocol'], listen: ['--pool', '--seconds', '--db', '--protocol', '--migration-signature'],
      recover: ['--pool', '--max-pages', '--max-jobs', '--db', '--protocol', '--migration-signature'], status: ['--pool', '--db'],
    };
    while (args.length) {
      const flag = args.shift(); const value = args.shift();
      requireThat(flag && allowed[mode]!.includes(flag) && value && !value.startsWith('--') && !values.has(flag), usage);
      values.set(flag, value);
    }
    const address = publicKey(values.get('--pool'));
    const database = values.get('--db') ?? defaultMarketDatabase;
    if (mode === 'status') {
      if (!existsSync(database)) console.log(JSON.stringify({ pool: address, state: 'no-market-database' }));
      else {
        store = new MarketStore(database, { readOnly: true });
        console.log(JSON.stringify({ ...store.status(address), recentTrades: store.trades(address) }, null, 2));
      }
    } else {
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      const signature = values.get('--signature');
      const protocol = values.get('--protocol') ?? 'dbc';
      requireThat(protocol === 'dbc' || protocol === 'damm-v2', 'Expected --protocol dbc or damm-v2.');
      const migrationSignature = values.get('--migration-signature');
      if (migrationSignature) requireThat(protocol === 'dbc' && decodeBase58(migrationSignature, 64).length === 64, 'Expected a DBC migration signature.');
      if (mode === 'inspect') requireThat(signature && decodeBase58(signature, 64).length === 64, 'Expected a 64-byte transaction signature.');
      function integerOption(flag: string, fallback: number, max: number): number {
        const text = values.get(flag);
        const value = text === undefined ? fallback : Number(text);
        requireThat((text === undefined || /^\d+$/.test(text)) && Number.isInteger(value) && value >= 1 && value <= max, `Invalid ${flag} range (1-${max}).`);
        return value;
      }
      const seconds = values.has('--seconds') ? integerOption('--seconds', 10, 3600) : undefined;
      const maxPages = integerOption('--max-pages', 20, 100);
      const maxReceipts = integerOption('--max-jobs', 500, 10_000);
      const rpcUrl = getHeliusRpcUrl();
      const pool = protocol === 'damm-v2' ? await loadVerifiedDammPool(rpcUrl, address, controller.signal) :
        await loadVerifiedDbcPool(rpcUrl, address, controller.signal, mode === 'inspect' ? 'confirmed' : 'finalized');
      console.log(JSON.stringify({ state: 'verified-pool', readOnlyChain: true, network: 'mainnet-beta', pool }, null, 2));
      if (mode === 'inspect') {
        const details = await getTransaction(rpcUrl, signature!, controller.signal, { commitment: isDammPool(pool) ? 'finalized' : 'confirmed' });
        const result = isDammPool(pool) ? decodeDammTrades(details, pool) : decodeDbcTrades(details, pool);
        console.log(JSON.stringify(result, null, 2));
        if (result.rejected.length) process.exitCode = 1;
      } else {
        store = new MarketStore(database);
        if (seconds !== undefined) timer = setTimeout(stop, seconds * 1000);
        const status = await runCollection({ pool, store, rpc: createMarketRpc(rpcUrl), rpcUrl, webSocketUrl: getHeliusWebSocketUrl(),
          signal: controller.signal, live: mode === 'listen', maxPages, maxReceipts, ...(migrationSignature ? { migrationSignature } : {}) });
        console.log(JSON.stringify(status, null, 2));
        if (mode === 'recover') {
          const incomplete = (state: Record<string, unknown>): boolean => {
            const states = state.receipts as { state: string; count: number }[];
            return Boolean(state.scanError || state.scanBefore || state.discoveryState === 'not-started' || state.migrationState ||
              states.some(row => ['pending', 'rejected'].includes(row.state) && row.count > 0) ||
              (state.followed && incomplete(state.followed as Record<string, unknown>)));
          };
          if (incomplete(status)) process.exitCode = 1;
        }
      }
    }
  }
} catch (error) {
  if (!controller.signal.aborted) {
    console.error(error instanceof Error ? error.message : 'Market operation failed.');
    process.exitCode = 1;
  }
} finally {
  clearTimeout(timer);
  stop();
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
  store?.close();
}
