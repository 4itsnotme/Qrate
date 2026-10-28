import { decodeDbcTrades } from '../meteora/decode.js';
import { MarketStore } from '../storage/market-store.js';
import type { MarketRpc } from './rpc.js';
import { isRecord } from '../transaction-rpc.js';
import { decodeDammTrades } from '../meteora/damm-decode.js';
import { isDammPool } from '../meteora/market-types.js';
import type { MarketPool, MarketTrade, DecodeResult } from '../meteora/market-types.js';
import { migrationDestination, verifyMigration } from '../meteora/migration.js';
import type { VerifiedMigration } from '../meteora/migration.js';
import { DammVerificationError } from '../meteora/damm-pool.js';

// Jobs remain pending while HTTP is in flight; a crash simply causes a safe replay after lease expiry.
export async function processNextReceipt(store: MarketStore, pool: MarketPool, rpc: MarketRpc, signal: AbortSignal, onSaved?: (trades: MarketTrade[]) => void): Promise<boolean> {
  signal.throwIfAborted();
  const job = store.pending(pool.address);
  if (!job) return false;
  store.beginAttempt(pool.address, job.signature);
  let receipt: Record<string, unknown>;
  try {
    receipt = await rpc.transaction(job.signature, signal);
    signal.throwIfAborted();
    if (!isRecord(receipt.transaction) || !Array.isArray(receipt.transaction.signatures) || receipt.transaction.signatures[0] !== job.signature || receipt.slot !== job.slot ||
      !isRecord(receipt.meta) || receipt.meta.err !== null ||
      !(receipt.blockTime === null || (Number.isSafeInteger(receipt.blockTime) && Number(receipt.blockTime) >= 0))) {
      throw new Error('Inconsistent finalized receipt.');
    }
    const message = receipt.transaction.message;
    if (!isRecord(message) || !Array.isArray(message.accountKeys) || !message.accountKeys.some(key =>
      key === pool.address || (isRecord(key) && key.pubkey === pool.address))) throw new Error('Receipt does not reference its discovery pool.');
  } catch {
    if (!signal.aborted) store.retry(pool.address, job.signature);
    return false;
  }
  // Storage failures deliberately propagate; they must stop collection instead of becoming RPC retries.
  let result: DecodeResult & { migration?: VerifiedMigration };
  if (isDammPool(pool)) result = decodeDammTrades(receipt, pool);
  else {
    let destination: string | undefined;
    try { destination = migrationDestination(receipt, pool); }
    catch (error) {
      store.saveReceipt(pool.address, job, receipt, { trades: [], rejected: [{ instructionPath: 'migration', reason: error instanceof Error ? error.message : 'Invalid migration.' }] });
      return true;
    }
    result = decodeDbcTrades(receipt, pool);
    if (destination) {
      let verified;
      try {
        if (!rpc.dammPool) throw new Error('Destination verifier unavailable.');
        verified = await rpc.dammPool(destination, signal);
        signal.throwIfAborted();
      } catch (error) {
        if (!signal.aborted && error instanceof DammVerificationError) {
          result.rejected.push({ instructionPath: 'migration', reason: error.message });
          store.saveReceipt(pool.address, job, receipt, result);
          return true;
        }
        if (!signal.aborted) store.retry(pool.address, job.signature);
        return false;
      }
      try {
        const migration = verifyMigration(receipt, pool, verified);
        result.rejected = result.rejected.filter(row => row.instructionPath !== migration.instructionPath);
        result.migration = migration;
      } catch (error) {
        result.rejected.push({ instructionPath: 'migration', reason: error instanceof Error ? error.message : 'Invalid migration proof.' });
      }
    }
  }
  const inserted = store.saveReceipt(pool.address, job, receipt, result);
  if (inserted) onSaved?.(result.trades);
  return true;
}
