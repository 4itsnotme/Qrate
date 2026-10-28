import { readRpc } from '../meteora/pool.js';
import { getTransaction, isRecord } from '../transaction-rpc.js';
import { decodeBase58, requireThat } from '../meteora/codec.js';
import type { SignatureRow } from '../storage/market-store.js';
import { loadVerifiedDammPool } from '../meteora/damm-pool.js';
import type { VerifiedDammPool } from '../meteora/damm-pool.js';

export function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Collection cancelled.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export interface MarketRpc {
  signatures(pool: string, before: string | null, minSlot: number | null, signal: AbortSignal): Promise<unknown>;
  transaction(signature: string, signal: AbortSignal): Promise<Record<string, unknown>>;
  dammPool?(address: string, signal: AbortSignal): Promise<VerifiedDammPool>;
}

// Shared pacing includes getTransaction's own retries as well as recovery page requests.
export function createMarketRpc(url: URL): MarketRpc {
  let turn = Promise.resolve();
  let nextStart = 0;
  let cooldownUntil = 0;
  const pacedFetch: typeof fetch = async (input, init) => {
    const signal = init?.signal ?? new AbortController().signal;
    const reservation = turn.then(async () => {
      signal.throwIfAborted();
      while (Date.now() < Math.max(nextStart, cooldownUntil)) await waitFor(Math.max(nextStart, cooldownUntil) - Date.now(), signal);
      nextStart = Date.now() + 500;
    });
    turn = reservation.catch(() => {});
    await reservation;
    const response = await fetch(input, init);
    if (response.status === 429) {
      const raw = response.headers.get('retry-after');
      const seconds = raw === null ? NaN : Number(raw);
      const date = raw === null ? NaN : Date.parse(raw);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - Date.now() : 2000;
      cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.min(60_000, Math.max(1000, delay)));
    }
    return response;
  };
  return {
    signatures: (pool, before, minSlot, signal) => readRpc(url, 'getSignaturesForAddress', [pool,
      { commitment: 'finalized', limit: 100, ...(before ? { before } : {}), ...(minSlot === null ? {} : { minContextSlot: minSlot }) }], signal, pacedFetch),
    transaction: (signature, signal) => getTransaction(url, signature, signal, { commitment: 'finalized', fetcher: pacedFetch }),
    dammPool: (address, signal) => loadVerifiedDammPool(url, address, signal, pacedFetch),
  };
}

export function parseSignaturePage(value: unknown, before: string | null, previousSlot: number | undefined): SignatureRow[] {
  requireThat(Array.isArray(value) && value.length <= 100, 'Invalid recovery page.');
  const seen = new Set<string>();
  let lastSlot = previousSlot ?? Number.MAX_SAFE_INTEGER;
  return value.map((item: unknown) => {
    requireThat(isRecord(item) && typeof item.signature === 'string' && decodeBase58(item.signature, 64).length === 64 &&
      item.signature !== before && !seen.has(item.signature) && Number.isSafeInteger(item.slot) && Number(item.slot) >= 0 && Number(item.slot) <= lastSlot &&
      (item.err === null || typeof item.err === 'string' || isRecord(item.err)) &&
      (item.blockTime === null || (Number.isSafeInteger(item.blockTime) && Number(item.blockTime) >= 0)) &&
      (item.confirmationStatus === null || item.confirmationStatus === 'finalized'), 'Invalid, duplicated, non-finalized or non-advancing signature page.');
    seen.add(item.signature);
    lastSlot = Number(item.slot);
    return { signature: item.signature, slot: Number(item.slot), err: item.err, blockTime: item.blockTime as number | null };
  });
}
