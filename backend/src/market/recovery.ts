import { MarketStore } from '../storage/market-store.js';
import { parseSignaturePage } from './rpc.js';
import type { MarketRpc } from './rpc.js';
import { requireThat } from '../meteora/codec.js';

export interface RecoveryResult { complete: boolean; gap: boolean; pages: number; error: boolean }

export async function recoverSignatures(store: MarketStore, pool: string, rpc: MarketRpc, signal: AbortSignal, maxPages = 20): Promise<RecoveryResult> {
  requireThat(Number.isInteger(maxPages) && maxPages >= 1 && maxPages <= 100, 'Use 1–100 recovery pages per pass.');
  let pages = 0;
  while (pages < maxPages && !signal.aborted) {
    const state = store.scanState(pool);
    let rows;
    try {
      const raw = await rpc.signatures(pool, state.scan_before, state.checkpoint_slot, signal);
      signal.throwIfAborted();
      rows = parseSignaturePage(raw, state.scan_before, state.scan_before ? store.signatureSlot(pool, state.scan_before) : undefined);
    } catch {
      if (!signal.aborted) store.scanError(pool);
      return { complete: false, gap: false, pages, error: !signal.aborted };
    }
    const result = store.applyPage(pool, rows);
    pages++;
    if (result.complete || result.gap) return { ...result, pages, error: false };
  }
  return { complete: false, gap: false, pages, error: false };
}
