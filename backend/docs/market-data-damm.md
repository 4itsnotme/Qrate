# Stage 2.3 — read-only DAMM v2 and migration continuity

Implemented and locally verified, 2026-10-28. This extends the existing market collector; no signing, swaps, launching, chart API or dependency installation.

1. **Goal:** retain verified trades when a supported DBC token graduates to DAMM v2.
2. **Scope:** pinned DAMM v2 standard `swap` / exact-input `swap2`, token A as the non-SOL token and token B as WSOL; SPL or metadata-only Token-2022. Exclude referrals, compounding, transfer fees/hooks, optimized unknown instructions and other quotes/modes. Preserve explicit rejection evidence.
3. **Requirements:** verify owner/layout/mints/vaults; reconcile authenticated per-frame swap events with direct token transfers; persist exact amounts and economic replay identity. Link pools only from a successful finalized DBC migration instruction and its DAMM initialization CPI, cross-checked with a fresh verified destination snapshot. Follow persisted links after restart. Recover destination history to the migration signature, including same-slot activity, rather than bootstrap only its latest 100.
4. **Dependencies:** reuse native SQLite, HTTP/WebSocket transport and pinned IDL reader. Official MIT DAMM SDK 1.5.1 / IDL 0.2.5 at `b66412daefab1edfddbc98f9655ddd2733fe021d`; DBC IDL remains pinned at `3a965ec0…`. Data-only schema subset with license/provenance. No on-chain implementation source is copied.
5. **Implementation:** DAMM schema/verifier/decoder and migration verifier under `src/meteora/`; narrow shared parsing/types; extend current store with an additive migration-link table and destination recovery anchor; extend collector/CLI to follow verified links using the same paced RPC adapter.
6. **Flow:** finalized DBC job → migration receipt + verified DAMM snapshot → atomic source outcome/link/destination anchor → DAMM recovery jobs → decoder → existing trade storage. DBC and DAMM remain separate pool partitions.
7. **Failures:** retain retryable jobs when destination reads fail; reject conflicting links/unsupported evidence; never infer migration from token symbols or matching mints alone. Existing atomic writes, leases, gaps and cancellation rules apply. If old migration evidence is outside bootstrap coverage, report the missing link and allow an explicit migration signature.
8. **Security:** chain reads only; no private endpoint/keys in fixtures or logs. Public recorded receipts are historical references, unrelated to Qrate-launched tokens.
9. **Verification:** real recorded buy/sell/migration/accounts, altered authorities/transfers/mints/amounts/modes/status, routed CPI isolation, persistence/replay, schema upgrade, link rollback/conflicts, restart following and recovery beyond 100 signatures. Run all backend tests/types/build plus frontend data regressions. Bounded Mainnet reads only; no live trading.
10. **Performance:** reuse one paced RPC adapter across source/destination, bounded discovery/receipt attempts and one collector lease per pool. No global subscription or production throughput claim.
11. **Costs:** existing Helius read/subscription usage and disk; no new vendor or package. Reading destination history can require multiple bounded passes.
12. **Rollback:** preserve existing working-tree changes and old `qrate.sqlite`. Schema addition is transactional and non-destructive; previous runtime deliberately refuses a newer schema. No automatic downgrade or data deletion.
13. **Documentation:** backend README/spec/provenance/fixtures and context overview/map/progress/architecture/known issues. Keep stage 2 incomplete pending candles/statistics/API/chart delivery.

## Official references

- [Pinned SDK/IDL](https://github.com/MeteoraAg/damm-v2-sdk/tree/b66412daefab1edfddbc98f9655ddd2733fe021d), [MIT license](https://github.com/MeteoraAg/damm-v2-sdk/blob/b66412daefab1edfddbc98f9655ddd2733fe021d/LICENSE).
- [DAMM events](https://docs.meteora.ag/developer-guides/damm-v2/program/events), [instructions](https://docs.meteora.ag/developer-guides/damm-v2/program/instructions).
- [DBC migration instruction](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/blob/3a965ec0c0a527c2be3c48b8b479366705bf4926/packages/dynamic-bonding-curve/src/services/migration.ts).

## Observed results

Strict typecheck/build and **53 backend tests** pass; frontend data regressions **4/4** pass. Real finalized receipts prove routed buy `6.0`, direct sell `4` and DBC migration `0` into DAMM `initialize_pool_with_dynamic_config`. Exact raw input/output transfers reconcile. Recorded swap receipts use legacy `swap`; a test-only conversion verifies exact-input `swap2` without claiming it is an observed chain receipt.

Tests cover adversarial event/transfer/authority/mint/status/stack evidence, protocol partitioning, replay precision, missing migration evidence, target-read failures, additive schema-1 upgrade, late transactional rollback, active destination leases, reopen/restart following, recovery beyond 100 destination signatures and dual live subscriptions/cancellation. Migration links retain their verification slot; unrelated databases remain protected by the existing guard.

A fresh finalized Mainnet `node dist/market.js inspect --protocol damm-v2 --pool 6RwUJcenBfx8DwwYKM7Dw8466pjCT7YSnVbw6oSbeEAx --signature 2c92juYEGag8UqUJFMwgzwiqSPkfzgVtknUiEKxaMRzEVX4pM4yuMhLsLHkE69RxC7R2WgY2sQXLgJ5C4z1rnX5H` succeeded with one trade and zero rejections. It wrote no market database. No default DB was seeded or full live Mainnet backfill run. Sustained production throughput, real-time Mainnet graduation, provider completeness and power-cut durability were not independently tested.

Schema 2 is additive to the earlier Qrate market schema 1 only. Rollback to earlier runtime requires a compatible database copy; no automatic downgrade is provided. An active standalone destination must stop before migration evidence extends its coverage. Bounded one-shot work applies per source/destination pool; missing evidence and unavailable anchors remain explicit. Candles/order/statistics/API/chart delivery are still incomplete.
