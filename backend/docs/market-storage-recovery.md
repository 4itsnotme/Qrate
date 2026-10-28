# Stage 2.2 — durable trades and missed-data recovery

Implemented and locally verified, 2026-10-28. Authorized scope: trade storage, disconnect/restart recovery and a simple context overview. No wallet/trading actions or candle/chart API.

This records the stage-2.2 boundary. [Stage 2.3](market-data-damm.md) adds restricted DAMM v2 decoding, verified migration links and schema 2; initial latest-100 bootstrap now applies to standalone pools, while linked destinations recover to their migration signature.

1. **Goal:** retain verified DBC observations after exit and discover transactions missed while disconnected, without duplicate trades or silent gaps.
2. **Scope:** the existing restricted DBC decoder; one selected pool per collector, local analytics SQLite. Initial collection explicitly starts with the latest 100 finalized pool signatures, not all-time history. Later recovery must reach the saved signature checkpoint. DAMM v2/migration following, candles, distributed hosting and user/account storage remain separate.
3. **Requirements:** atomic receipt/trade/status commits, unique network/pool/signature/instruction identities, exact raw amounts, durable pending retries, saved pagination progress, explicit coverage/rejection status and cancellation-safe restart. Failed/non-swap/unsupported receipts remain distinguishable.
4. **Dependencies:** native `node:sqlite`, already available in this session's Node 24.22.0; set the supported runtime floor to Node 22.13.0 (SQLite available without a CLI flag). No npm installation. Use a new guarded database path; preserve the legacy database/artifacts.
5. **Implementation:** `storage/market-store.ts` owns schema/transactions/collector leases; `market/recovery.ts` owns paged signature discovery; `market/collector.ts` owns finalized receipts/retries; `market/rpc.ts` paces read requests. Extend the existing listener with a signature-only callback and subscribe acknowledgement hook; reuse its socket/reconnect logic. Extend the market CLI with recover/status and storage options.
6. **Data flow:** finalized pool notifications and periodic/reconnect signature scans → SQLite pending jobs → finalized transaction fetch → existing DBC decoder → atomic receipt/trades/status commit. Recovery checkpoints mean signatures were durably discovered, not that every job decoded successfully.
7. **Failure handling:** RPC failures retain cursor/jobs and retry with bounded backoff; cancellation leaves work pending. Page rows and cursor commit together. Missing anchors, malformed/non-advancing pagination and conflicting data never advance coverage. Storage/lease failures stop collection. One lease per pool prevents concurrent writers racing recovery state; expired crash leases can be reclaimed.
8. **Security:** read-only chain access, private RPC keys stay server-side, parameterized SQL, schema/application identity guard, FULL synchronous durability/WAL/busy timeout. No account/wallet secrets or custodial powers. Reject mismatched receipt signatures/slots. Persist finalized observations to reduce fork ambiguity; provider omissions/finality failures still cannot be independently proved away.
9. **Verification:** real recorded receipt fixtures with temporary SQLite files; duplicate replay, reopen/restart, multi-page and same-slot recovery, interrupted scans, missing anchor, RPC outage/null receipts, failed/unsupported receipts, conflicting payload rollback, lease contention/expiry, pool isolation, foreign DB protection and existing transport/frontend regressions.
10. **Performance:** one receipt worker and shared conservative request pacing (two starts/second by default), pages of 100, bounded pages per scan invocation. Durable backlog can grow on disk and must be monitored; no production throughput claim. Newest history arriving during a scan is picked up in the next scan.
11. **Cost:** local disk plus existing RPC reads, no new vendor/package. Long outages may require many pages/receipt calls; one-shot recovery has a page bound and reports unfinished work. No paid live backfill is run automatically by development tests.
12. **Rollback:** scoped source baseline is the current working tree; preserve existing uncommitted decoder/chart work. Do not migrate/delete `qrate.sqlite`. New `market.sqlite` has its own application ID/schema; no destructive migration. Document new runtime floor and default bootstrap coverage.
13. **Documentation:** backend commands/limits, detailed map/progress/architecture/known issues, and `context/code-overview.md` with short plain-language file responsibilities and two data flows.

## References

- [Node 22 SQLite API](https://nodejs.org/docs/latest-v22.x/api/sqlite.html), [official source/documentation](https://github.com/nodejs/node/blob/main/doc/api/sqlite.md)
- [Solana signature pagination](https://solana.com/docs/rpc/http/getsignaturesforaddress), [transaction reads](https://solana.com/docs/rpc/http/gettransaction)
- [SQLite atomic commits](https://www.sqlite.org/atomiccommit.html)

SQLite matches the repository's local analytics plan and supplies transactions/uniqueness without new dependencies. A hand-written JSON journal would require additional crash-consistency machinery; a cloud database is unnecessary for this local slice. This does not choose the production user database.

## Verification and remaining limits

Strict types/build and **35 backend tests** pass, including physical SQLite reopen/replay, interrupted same-slot pagination, unavailable/crossed anchors, late arrivals, exact amount/ratio validation, changed-outcome rejection, disk-write failure, request throttling/finalized options, crash leases and an end-to-end WebSocket disconnect/reconnect recovery test. Existing decoder and transport tests remain in the suite. Crash behavior is simulated with pending work/expired leases; abrupt power-loss durability relies on SQLite's transaction guarantees, not a power-cut test performed here.

No live Mainnet backfill was run and no test data was seeded into the default application database. Temporary DBs/local HTTP/WebSocket fixtures are used; the older `qrate.sqlite` remains separate. Production throughput, provider pruning/omissions and finality failures are not independently verified. The bootstrap boundary is explicitly limited, unsupported DBC receipts stay quarantined, and DAMM v2/runtime migration/candles/chart delivery remain later work.
