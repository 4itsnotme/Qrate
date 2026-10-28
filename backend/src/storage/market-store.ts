import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { decodeBase58, formatUnits, publicKey, requireThat } from '../meteora/codec.js';
import { isDammPool } from '../meteora/market-types.js';
import type { MarketPool, MarketTrade, DecodeResult } from '../meteora/market-types.js';
import type { VerifiedMigration } from '../meteora/migration.js';
import { isRecord } from '../transaction-rpc.js';

const APPLICATION_ID = 0x51524d54;
const NETWORK = 'mainnet-beta';
const LEASE_MS = 90_000;
export const defaultMarketDatabase = fileURLToPath(new URL('../../data/market.sqlite', import.meta.url));

export interface SignatureRow { signature: string; slot: number; err: unknown; blockTime: number | null }
export interface PendingJob { signature: string; slot: number; attempts: number }
export interface ScanState {
  checkpoint_signature: string | null; checkpoint_slot: number | null;
  scan_head: string | null; scan_head_slot: number | null; scan_before: string | null;
  coverage_start_signature: string | null; coverage_start_slot: number | null;
  scan_error: string | null; last_scan_at: number | null;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  const json = JSON.stringify(value);
  requireThat(json !== undefined, 'Cannot persist undefined data.');
  return json;
}

const migrationSchema = `
  CREATE TABLE migrations (
    network TEXT NOT NULL, source_pool TEXT NOT NULL, destination_pool TEXT NOT NULL,
    signature TEXT NOT NULL, slot INTEGER NOT NULL, instruction_path TEXT NOT NULL, destination_verification_slot INTEGER NOT NULL,
    PRIMARY KEY(network,source_pool), UNIQUE(network,destination_pool),
    FOREIGN KEY(network,source_pool) REFERENCES pools(network,pool),
    FOREIGN KEY(network,destination_pool) REFERENCES pools(network,pool),
    FOREIGN KEY(network,source_pool,signature) REFERENCES receipts(network,pool,signature)
  ) STRICT;
  PRAGMA user_version = 2;
`;

function identityJson(pool: MarketPool): string {
  const { verificationSlot: _slot, ...identity } = pool;
  if ('isMigrated' in identity) { const { isMigrated: _migrated, ...immutable } = identity; return canonical(immutable); }
  return canonical(identity);
}

const schema = `
  CREATE TABLE pools (
    network TEXT NOT NULL, pool TEXT NOT NULL, identity_json TEXT NOT NULL CHECK(json_valid(identity_json)),
    checkpoint_signature TEXT, checkpoint_slot INTEGER, scan_head TEXT, scan_head_slot INTEGER, scan_before TEXT,
    coverage_start_signature TEXT, coverage_start_slot INTEGER, scan_error TEXT, last_scan_at INTEGER,
    lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(network, pool)
  ) STRICT;
  CREATE TABLE receipts (
    network TEXT NOT NULL, pool TEXT NOT NULL, signature TEXT NOT NULL, slot INTEGER NOT NULL CHECK(slot>=0),
    block_time INTEGER, chain_error TEXT, state TEXT NOT NULL CHECK(state IN ('pending','done','ignored','rejected','failed')),
    attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0, receipt_json TEXT, reasons_json TEXT, last_error TEXT,
    PRIMARY KEY(network, pool, signature), FOREIGN KEY(network,pool) REFERENCES pools(network,pool)
  ) STRICT;
  CREATE INDEX pending_receipts ON receipts(network,pool,state,retry_at,slot);
  CREATE TABLE trades (
    network TEXT NOT NULL, pool TEXT NOT NULL, signature TEXT NOT NULL, instruction_path TEXT NOT NULL,
    slot INTEGER NOT NULL, block_time INTEGER, token_amount_raw TEXT NOT NULL, sol_amount_lamports TEXT NOT NULL,
    price_numerator TEXT NOT NULL, price_denominator TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), economic_json TEXT NOT NULL CHECK(json_valid(economic_json)),
    PRIMARY KEY(network,pool,signature,instruction_path),
    FOREIGN KEY(network,pool,signature) REFERENCES receipts(network,pool,signature)
  ) STRICT;
  CREATE INDEX trade_history ON trades(network,pool,slot);
  PRAGMA application_id = ${APPLICATION_ID};
  ${migrationSchema}
`;

export class MarketStore {
  private readonly db: DatabaseSync;
  private readonly owner = randomUUID();
  private readonly now: () => number;
  private closed = false;

  constructor(path = defaultMarketDatabase, options: { readOnly?: boolean; now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
    if (!options.readOnly && path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { readOnly: options.readOnly ?? false });
    try {
      this.db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
      this.transaction(() => {
        const app = this.db.prepare('PRAGMA application_id').get()!.application_id;
        const version = this.db.prepare('PRAGMA user_version').get()!.user_version;
        if (app === 0 && version === 0 && !options.readOnly) {
          const tables = this.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get()!.n;
          requireThat(tables === 0, 'Refusing to initialize an unrelated database.');
          this.db.exec(schema);
        } else {
          requireThat(app === APPLICATION_ID && (version === 1 || version === 2), 'Unsupported or unrelated market database; legacy data is not migrated.');
          if (version === 1) {
            requireThat(!options.readOnly, 'Market schema 1 requires a writable collection/recovery run to add migration tracking.');
            this.db.exec(migrationSchema);
          }
        }
      }, options.readOnly ?? false);
      if (!options.readOnly) this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    } catch (error) { this.db.close(); throw error; }
  }

  private transaction<T>(action: () => T, readOnly = false): T {
    this.db.exec(readOnly ? 'BEGIN' : 'BEGIN IMMEDIATE');
    try { const value = action(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  private assertLease(pool: string): void {
    const row = this.db.prepare('SELECT lease_owner,lease_until FROM pools WHERE network=? AND pool=?').get(NETWORK, pool);
    requireThat(row?.lease_owner === this.owner && Number(row.lease_until) > this.now(), 'Collector lease was lost; stopping writes.');
  }

  claimPool(pool: MarketPool): void {
    publicKey(pool.address);
    // Mutable observation slot/migration flag are not part of a pool's immutable identity.
    const json = identityJson(pool);
    this.transaction(() => {
      this.db.prepare('INSERT INTO pools(network,pool,identity_json) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(NETWORK, pool.address, json);
      const row = this.db.prepare('SELECT * FROM pools WHERE network=? AND pool=?').get(NETWORK, pool.address)!;
      requireThat(row.identity_json === json, 'Verified pool identity conflicts with stored history.');
      requireThat(row.lease_owner === null || Number(row.lease_until) <= this.now() || row.lease_owner === this.owner,
        'Another collector owns this pool. Stop it or wait for its 90-second crash lease to expire.');
      this.db.prepare('UPDATE pools SET lease_owner=?,lease_until=? WHERE network=? AND pool=?').run(this.owner, this.now() + LEASE_MS, NETWORK, pool.address);
    });
  }

  renewLease(pool: string): void {
    this.transaction(() => {
      this.assertLease(pool);
      this.db.prepare('UPDATE pools SET lease_until=? WHERE network=? AND pool=?').run(this.now() + LEASE_MS, NETWORK, pool);
    });
  }

  releaseLease(pool: string): void {
    this.db.prepare('UPDATE pools SET lease_owner=NULL,lease_until=0 WHERE network=? AND pool=? AND lease_owner=?').run(NETWORK, pool, this.owner);
  }

  scanState(pool: string): ScanState {
    const row = this.db.prepare('SELECT * FROM pools WHERE network=? AND pool=?').get(NETWORK, pool);
    requireThat(row, 'Pool is not registered in this database.');
    return row as unknown as ScanState;
  }

  private insertSignature(pool: string, row: SignatureRow): void {
    requireThat(typeof row.signature === 'string' && decodeBase58(row.signature, 64).length === 64 && Number.isSafeInteger(row.slot) && row.slot >= 0 &&
      (row.blockTime === null || (Number.isSafeInteger(row.blockTime) && row.blockTime >= 0)) &&
      (row.err === null || typeof row.err === 'string' || isRecord(row.err)), 'Invalid finalized signature metadata.');
    const previous = this.db.prepare('SELECT slot,chain_error FROM receipts WHERE network=? AND pool=? AND signature=?').get(NETWORK, pool, row.signature);
    const error = row.err === null ? null : canonical(row.err);
    if (previous) {
      requireThat(previous.slot === row.slot && previous.chain_error === error, 'Conflicting finalized signature metadata.');
      return;
    }
    this.db.prepare('INSERT INTO receipts(network,pool,signature,slot,block_time,chain_error,state) VALUES(?,?,?,?,?,?,?)')
      .run(NETWORK, pool, row.signature, row.slot, row.blockTime, error, error === null ? 'pending' : 'failed');
  }

  enqueue(pool: string, row: SignatureRow): void {
    this.transaction(() => { this.assertLease(pool); this.insertSignature(pool, row); });
  }

  enqueueMigrationEvidence(pool: string, row: SignatureRow): void {
    this.transaction(() => {
      this.assertLease(pool);
      this.insertSignature(pool, row);
      if (this.migration(pool)?.signature === row.signature) return;
      const trades = this.db.prepare('SELECT COUNT(*) AS n FROM trades WHERE network=? AND pool=? AND signature=?').get(NETWORK, pool, row.signature)!.n;
      requireThat(trades === 0 && row.err === null, 'Migration evidence cannot replace trades or a failed transaction.');
      // Explicit evidence can reclassify an unsupported migration quarantined by the previous decoder.
      this.db.prepare("UPDATE receipts SET state='pending',receipt_json=NULL,reasons_json=NULL,retry_at=0,last_error=NULL WHERE network=? AND pool=? AND signature=?")
        .run(NETWORK, pool, row.signature);
    });
  }

  // Signature rows and pagination/checkpoint progress share one commit, even if the process stops here.
  applyPage(pool: string, rows: SignatureRow[]): { complete: boolean; gap: boolean } {
    return this.transaction(() => {
      this.assertLease(pool);
      const state = this.scanState(pool);
      const anchor = state.checkpoint_signature;
      const anchorIndex = anchor === null ? -1 : rows.findIndex(row => row.signature === anchor);
      if (anchorIndex >= 0) requireThat(rows[anchorIndex]!.slot === state.checkpoint_slot, 'Checkpoint slot conflicts with finalized history.');
      const crossedBoundary = anchor !== null && anchorIndex < 0 && rows.some(row => row.slot < Number(state.checkpoint_slot));
      const page = anchorIndex >= 0 ? rows.slice(0, anchorIndex) : crossedBoundary ? rows.filter(row => row.slot >= Number(state.checkpoint_slot)) : rows;
      for (const row of page) this.insertSignature(pool, row);
      const head = state.scan_head ?? rows[0]?.signature ?? null;
      const headSlot = state.scan_head_slot ?? rows[0]?.slot ?? null;
      if (anchor === null || anchorIndex >= 0) {
        const oldest = rows.at(-1);
        this.db.prepare(`UPDATE pools SET checkpoint_signature=?,checkpoint_slot=?,scan_head=NULL,scan_head_slot=NULL,scan_before=NULL,
          coverage_start_signature=COALESCE(coverage_start_signature,?),coverage_start_slot=COALESCE(coverage_start_slot,?),
          scan_error=NULL,last_scan_at=? WHERE network=? AND pool=?`)
          .run(head, headSlot, oldest?.signature ?? null, oldest?.slot ?? null, this.now(), NETWORK, pool);
        return { complete: true, gap: false };
      }
      const gap = rows.length === 0 || crossedBoundary;
      this.db.prepare(`UPDATE pools SET scan_head=?,scan_head_slot=?,scan_before=?,scan_error=?,last_scan_at=? WHERE network=? AND pool=?`)
        .run(head, headSlot, gap ? state.scan_before : rows.at(-1)!.signature,
          gap ? 'Saved checkpoint unavailable from provider; coverage gap remains open.' : null, this.now(), NETWORK, pool);
      return { complete: false, gap };
    });
  }

  scanError(pool: string): void {
    this.transaction(() => {
      this.assertLease(pool);
      this.db.prepare('UPDATE pools SET scan_error=? WHERE network=? AND pool=?')
        .run('Signature recovery request failed; checkpoint was not advanced.', NETWORK, pool);
    });
  }

  pending(pool: string): PendingJob | undefined {
    return this.db.prepare("SELECT signature,slot,attempts FROM receipts WHERE network=? AND pool=? AND state='pending' AND retry_at<=? ORDER BY slot,rowid LIMIT 1")
      .get(NETWORK, pool, this.now()) as unknown as PendingJob | undefined;
  }

  signatureSlot(pool: string, signature: string): number | undefined {
    const row = this.db.prepare('SELECT slot FROM receipts WHERE network=? AND pool=? AND signature=?').get(NETWORK, pool, signature);
    return row ? Number(row.slot) : undefined;
  }

  beginAttempt(pool: string, signature: string): void {
    this.transaction(() => {
      this.assertLease(pool);
      this.db.prepare("UPDATE receipts SET attempts=attempts+1 WHERE network=? AND pool=? AND signature=? AND state='pending'").run(NETWORK, pool, signature);
    });
  }

  retry(pool: string, signature: string): void {
    this.transaction(() => {
      this.assertLease(pool);
      const row = this.db.prepare('SELECT attempts FROM receipts WHERE network=? AND pool=? AND signature=?').get(NETWORK, pool, signature);
      requireThat(row, 'Missing pending receipt.');
      const delay = Math.min(300_000, 1000 * 2 ** Math.min(Number(row.attempts), 9));
      this.db.prepare("UPDATE receipts SET retry_at=?,last_error=? WHERE network=? AND pool=? AND signature=? AND state='pending'")
        .run(this.now() + delay, 'Receipt unavailable or inconsistent; retry pending.', NETWORK, pool, signature);
    });
  }

  saveReceipt(pool: string, job: PendingJob, receipt: Record<string, unknown>, result: {
    trades: MarketTrade[]; rejected: DecodeResult['rejected']; migration?: VerifiedMigration;
  }): number {
    return this.transaction(() => {
      this.assertLease(pool);
      requireThat(isRecord(receipt.transaction) && Array.isArray(receipt.transaction.signatures) && receipt.transaction.signatures[0] === job.signature &&
        receipt.slot === job.slot && isRecord(receipt.meta) && 'err' in receipt.meta, 'Receipt identity does not match its durable job.');
      const previous = this.db.prepare('SELECT state,chain_error,receipt_json,reasons_json FROM receipts WHERE network=? AND pool=? AND signature=?').get(NETWORK, pool, job.signature);
      if (this.migration(pool)?.signature === job.signature) requireThat(result.migration, 'Replay cannot remove a saved migration link.');
      const state = receipt.meta.err !== null ? 'failed' : result.rejected.length ? 'rejected' : result.trades.length ? 'done' : 'ignored';
      requireThat(previous && previous.chain_error === (receipt.meta.err === null ? null : canonical(receipt.meta.err)), 'Receipt status conflicts with finalized discovery.');
      if (previous.state !== 'pending' && previous.receipt_json !== null) {
        const storedPaths = this.db.prepare('SELECT instruction_path FROM trades WHERE network=? AND pool=? AND signature=?').all(NETWORK, pool, job.signature);
        requireThat(previous.state === state && previous.reasons_json === canonical(result.rejected) && storedPaths.length === result.trades.length &&
          storedPaths.every(row => result.trades.some(trade => trade.instructionPath === row.instruction_path)), 'Conflicting replay changes the saved receipt outcome.');
      }
      const identity = JSON.parse(String(this.db.prepare('SELECT identity_json FROM pools WHERE network=? AND pool=?').get(NETWORK, pool)!.identity_json)) as MarketPool;
      let inserted = 0;
      for (const trade of result.trades) {
        requireThat(receipt.meta.err === null && trade.network === NETWORK && trade.protocol === (isDammPool(identity) ? 'meteora-damm-v2' : 'meteora-dbc') && trade.pool === pool &&
          trade.signature === job.signature && trade.slot === job.slot && /^\d+(\.\d+)?$/.test(trade.instructionPath) &&
          /^\d+$/.test(trade.tokenAmountRaw) && BigInt(trade.tokenAmountRaw) > 0n && /^\d+$/.test(trade.solAmountLamports) && BigInt(trade.solAmountLamports) > 0n &&
          trade.tokenMint === identity.baseMint && trade.quoteMint === identity.quoteMint,
          'Invalid trade identity or raw quantities.');
        requireThat(/^\d+$/.test(trade.priceExact.numerator) && /^\d+$/.test(trade.priceExact.denominator) &&
          BigInt(trade.priceExact.numerator) > 0n && BigInt(trade.priceExact.denominator) > 0n &&
          BigInt(trade.priceExact.numerator) * BigInt(trade.tokenAmountRaw) * 1_000_000_000n ===
          BigInt(trade.priceExact.denominator) * BigInt(trade.solAmountLamports) * 10n ** BigInt(identity.baseDecimals) &&
          trade.tokenAmount === formatUnits(BigInt(trade.tokenAmountRaw), identity.baseDecimals) && trade.solAmount === formatUnits(BigInt(trade.solAmountLamports), 9),
          'Stored price/units disagree with exact execution amounts.');
        const { verificationSlot: _verification, ...economic } = trade;
        const stable = canonical(economic);
        const existing = this.db.prepare('SELECT economic_json FROM trades WHERE network=? AND pool=? AND signature=? AND instruction_path=?')
          .get(NETWORK, pool, job.signature, trade.instructionPath);
        if (existing) { requireThat(existing.economic_json === stable, 'Conflicting trade for an existing signature/instruction.'); continue; }
        this.db.prepare(`INSERT INTO trades(network,pool,signature,instruction_path,slot,block_time,token_amount_raw,sol_amount_lamports,
          price_numerator,price_denominator,payload_json,economic_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(NETWORK, pool, job.signature, trade.instructionPath, trade.slot, trade.timestamp, trade.tokenAmountRaw, trade.solAmountLamports,
            trade.priceExact.numerator, trade.priceExact.denominator, canonical(trade), stable);
        inserted++;
      }
      if (result.migration) {
        const link = result.migration;
        requireThat(!isDammPool(identity) && receipt.meta.err === null && result.rejected.length === 0 && link.sourcePool === pool &&
          link.signature === job.signature && link.slot === job.slot && link.destinationPool !== pool && link.destination.address === link.destinationPool &&
          link.destination.baseMint === identity.baseMint && link.destination.quoteMint === identity.quoteMint &&
          link.destination.baseDecimals === identity.baseDecimals && link.destination.baseTokenProgram === identity.baseTokenProgram &&
          Number.isSafeInteger(link.destination.verificationSlot) && link.destination.verificationSlot >= job.slot && /^\d+(\.\d+)?$/.test(link.instructionPath),
          'Migration identity conflicts with its source receipt.');
        const existing = this.migration(pool);
        requireThat(!existing || (existing.destinationPool === link.destinationPool && existing.signature === link.signature &&
          existing.slot === link.slot && existing.instructionPath === link.instructionPath), 'Conflicting persisted migration link.');
        this.db.prepare('INSERT INTO pools(network,pool,identity_json) VALUES(?,?,?) ON CONFLICT DO NOTHING')
          .run(NETWORK, link.destinationPool, identityJson(link.destination));
        const target = this.db.prepare('SELECT * FROM pools WHERE network=? AND pool=?').get(NETWORK, link.destinationPool)!;
        requireThat(target.identity_json === identityJson(link.destination), 'Migration target conflicts with stored pool identity.');
        // Extend a standalone latest-100 collection back to creation; never reset a live owner's cursor.
        const needsAnchor = target.coverage_start_slot === null || Number(target.coverage_start_slot) > link.slot ||
          (Number(target.coverage_start_slot) === link.slot && target.coverage_start_signature !== link.signature);
        if (!existing && needsAnchor) {
          requireThat(target.lease_owner === null || Number(target.lease_until) <= this.now(), 'Migration destination is already collecting; stop it before extending coverage.');
          this.db.prepare(`UPDATE pools SET checkpoint_signature=?,checkpoint_slot=?,coverage_start_signature=?,coverage_start_slot=?,
            scan_head=NULL,scan_head_slot=NULL,scan_before=NULL,scan_error=NULL,last_scan_at=NULL WHERE network=? AND pool=?`)
            .run(link.signature, link.slot, link.signature, link.slot, NETWORK, link.destinationPool);
        }
        this.db.prepare('INSERT INTO migrations(network,source_pool,destination_pool,signature,slot,instruction_path,destination_verification_slot) VALUES(?,?,?,?,?,?,?) ON CONFLICT(network,source_pool) DO NOTHING')
          .run(NETWORK, pool, link.destinationPool, link.signature, link.slot, link.instructionPath, link.destination.verificationSlot);
      }
      const update = this.db.prepare('UPDATE receipts SET state=?,receipt_json=?,reasons_json=?,retry_at=0,last_error=NULL,block_time=? WHERE network=? AND pool=? AND signature=?')
        .run(state, canonical(receipt), canonical(result.rejected), receipt.blockTime as number | null, NETWORK, pool, job.signature);
      requireThat(update.changes === 1, 'Cannot commit an unknown receipt.');
      return inserted;
    });
  }

  migration(pool: string): VerifiedMigration | undefined {
    const row = this.db.prepare(`SELECT m.*,p.identity_json FROM migrations m JOIN pools p ON p.network=m.network AND p.pool=m.destination_pool
      WHERE m.network=? AND m.source_pool=?`).get(NETWORK, pool);
    if (!row) return;
    return { sourcePool: pool, destinationPool: String(row.destination_pool), signature: String(row.signature), slot: Number(row.slot),
      instructionPath: String(row.instruction_path), destination: { ...JSON.parse(String(row.identity_json)), verificationSlot: Number(row.destination_verification_slot) } as VerifiedMigration['destination'] };
  }

  status(pool: string): Record<string, unknown> {
    const registered = this.db.prepare('SELECT * FROM pools WHERE network=? AND pool=?').get(NETWORK, pool);
    if (!registered) return { pool, state: 'not-collected', trades: 0 };
    const counts = this.db.prepare('SELECT state,COUNT(*) AS count FROM receipts WHERE network=? AND pool=? GROUP BY state').all(NETWORK, pool);
    const trades = this.db.prepare('SELECT COUNT(*) AS count FROM trades WHERE network=? AND pool=?').get(NETWORK, pool)!.count;
    const pending = this.db.prepare("SELECT COUNT(*) AS count,MIN(retry_at) AS next_retry,MIN(slot) AS oldest_slot FROM receipts WHERE network=? AND pool=? AND state='pending'").get(NETWORK, pool)!;
    const lastError = this.db.prepare("SELECT last_error FROM receipts WHERE network=? AND pool=? AND state='pending' AND last_error IS NOT NULL ORDER BY retry_at DESC LIMIT 1").get(NETWORK, pool);
    const linkedFrom = this.db.prepare('SELECT source_pool,signature,slot FROM migrations WHERE network=? AND destination_pool=?').get(NETWORK, pool);
    return { pool, network: NETWORK, commitment: 'finalized', bootstrap: linkedFrom ? 'verified-migration-signature' : 'latest-100-signatures', trades, receipts: counts,
      migration: this.migration(pool) ?? null, linkedFrom: linkedFrom ?? null,
      checkpoint: registered.checkpoint_signature, checkpointSlot: registered.checkpoint_slot,
      coverageStart: registered.coverage_start_signature, coverageStartSlot: registered.coverage_start_slot,
      discoveryState: registered.scan_error ? 'gap-or-error' : registered.last_scan_at === null ? 'not-started' : registered.scan_before ? 'recovering' : registered.checkpoint_signature ? 'up-to-checkpoint' : 'empty-observed',
      scanBefore: registered.scan_before, scanError: registered.scan_error, lastScanAt: registered.last_scan_at,
      pendingCount: pending.count, nextRetryAt: pending.next_retry, oldestPendingSlot: pending.oldest_slot,
      lastReceiptError: lastError?.last_error ?? null,
      meaning: 'Checkpoint covers discovered signatures; pending/rejected receipts are not complete decoded history.' };
  }

  trades(pool: string, limit = 20): MarketTrade[] {
    requireThat(Number.isInteger(limit) && limit >= 1 && limit <= 1000, 'Use a history limit between 1 and 1000.');
    return this.db.prepare('SELECT payload_json FROM trades WHERE network=? AND pool=? ORDER BY slot DESC,signature,instruction_path LIMIT ?')
      .all(NETWORK, pool, limit).map(row => JSON.parse(String(row.payload_json)) as MarketTrade);
  }

  close(): void { if (!this.closed) { this.closed = true; this.db.close(); } }
}
