import { isDammPool } from '../meteora/market-types.js';
import type { MarketPool, MarketTrade } from '../meteora/market-types.js';
import { migrationDestination } from '../meteora/migration.js';
import { requireThat } from '../meteora/codec.js';
import { MarketStore } from '../storage/market-store.js';
import { startLogsListener } from '../logs-listener.js';
import { recoverSignatures } from './recovery.js';
import { processNextReceipt } from './collector.js';
import { waitFor } from './rpc.js';
import type { MarketRpc } from './rpc.js';

export interface CollectionOptions {
  pool: MarketPool;
  store: MarketStore;
  rpc: MarketRpc;
  signal: AbortSignal;
  live: boolean;
  rpcUrl: URL;
  webSocketUrl: URL;
  maxPages?: number;
  maxReceipts?: number;
  recoveryIntervalMs?: number;
  migrationSignature?: string;
  log?: (message: string) => void;
}

export async function runCollection(options: CollectionOptions): Promise<Record<string, unknown>> {
  const { pool, store, rpc } = options;
  const log = options.log ?? console.log;
  const onSaved = (trades: MarketTrade[]) => {
    for (const trade of trades) log(JSON.stringify({ state: 'saved-trade', ...trade }));
  };
  const local = new AbortController();
  const signal = AbortSignal.any([options.signal, local.signal]);
  let fatal: unknown;
  let listener: ReturnType<typeof startLogsListener> | undefined;
  let forceRecovery = true;
  let nextRecovery = 0;
  let followed: Promise<Record<string, unknown>> | undefined;
  let followedStatus: Record<string, unknown> | undefined;
  store.claimPool(pool);
  const fail = (error: unknown) => { fatal = error; local.abort(); };
  const heartbeat = setInterval(() => {
    try { store.renewLease(pool.address); } catch (error) { fail(error); }
  }, 20_000);
  const followMigration = () => {
    const link = isDammPool(pool) ? undefined : store.migration(pool.address);
    if (!link || followed) return;
    followed = (async () => {
      requireThat(rpc.dammPool, 'DAMM destination verifier is required to follow migration.');
      const destination = await rpc.dammPool(link.destinationPool, signal);
      const { migrationSignature: _evidence, ...destinationOptions } = options;
      const status = await runCollection({ ...destinationOptions, pool: destination, signal });
      followedStatus = status;
      return status;
    })();
    void followed.catch(fail);
  };
  try {
    if (options.migrationSignature) {
      requireThat(!isDammPool(pool), 'Migration evidence requires a DBC source pool.');
      const receipt = await rpc.transaction(options.migrationSignature, signal);
      signal.throwIfAborted();
      requireThat(migrationDestination(receipt, pool), 'Signature is not a supported migration of this DBC pool.');
      store.enqueueMigrationEvidence(pool.address, { signature: options.migrationSignature, slot: Number(receipt.slot), err: null, blockTime: receipt.blockTime as number | null });
    }
    if (options.live) {
      listener = startLogsListener({ rpcUrl: options.rpcUrl, webSocketUrl: options.webSocketUrl, mint: pool.baseMint,
        mentionsAddress: pool.address, commitment: 'finalized',
        onSignature: (notice) => store.enqueue(pool.address, { ...notice, blockTime: null }),
        onSubscribed: () => { forceRecovery = true; },
        onFatalError: () => fail(new Error('Durable signature storage failed; collection stopped.')), log });
      while (!signal.aborted) {
        followMigration();
        if (forceRecovery || Date.now() >= nextRecovery) {
          forceRecovery = false;
          const result = await recoverSignatures(store, pool.address, rpc, signal, 2);
          nextRecovery = Date.now() + (!result.complete && !result.gap && !result.error ? 1000 : options.recoveryIntervalMs ?? 30_000);
          if (result.error || result.gap) log(JSON.stringify({ state: 'recovery-incomplete', ...result }));
        }
        if (signal.aborted) break;
        const processed = await processNextReceipt(store, pool, rpc, signal, onSaved);
        await waitFor(processed ? 0 : 250, signal);
      }
    } else {
      const result = await recoverSignatures(store, pool.address, rpc, signal, options.maxPages ?? 20);
      log(JSON.stringify({ state: 'recovery-pass', ...result }));
      // Bound work per CLI invocation. Delayed/unavailable jobs survive for later retry.
      for (let i = 0; i < (options.maxReceipts ?? 500) && !signal.aborted && store.pending(pool.address); i++) {
        await processNextReceipt(store, pool, rpc, signal, onSaved);
      }
      if (!signal.aborted) { followMigration(); if (followed) await followed; }
    }
  } catch (error) {
    if (!signal.aborted) fatal = error;
  } finally {
    local.abort();
    clearInterval(heartbeat);
    listener?.stop();
    if (followed) { try { await followed; } catch (error) { if (!options.signal.aborted) fatal ??= error; } }
    try { store.releaseLease(pool.address); } catch (error) { fatal ??= error; }
  }
  if (fatal) throw fatal;
  return { ...store.status(pool.address), ...(followedStatus ? { followed: followedStatus } : {}),
    ...(!isDammPool(pool) && pool.isMigrated && !store.migration(pool.address) ? { migrationState: 'evidence-not-found; provide --migration-signature or extend source history' } : {}) };
}
