# Qrate — System Architecture

> Architecture is **provisional** until verified against the actual repository. Do not replace existing functioning services just to match this diagram.

## Design invariants

1. **Non-custodial by design:** Users control their keys and authorize their trades. Qrate must not hold user trading funds or have unilateral signing / transfer authority over them.
2. **On-chain trading:** Trades and ownership are settled on Solana through Meteora. Qrate's database and UI are derived views, not the ledger of record.
3. **No Qrate-controlled asset-redirection PDA:** Meteora pools are necessarily managed by program-owned PDAs; Qrate must not gain the authority to divert user trading funds. Protocol fee recipient authorities require separate explicit review.
4. **No irreversible launch by assumption:** Mark successful token creation only after confirmed chain state; publishing sequence remains TBD.
5. **Recoverability:** WebSockets are notification streams, not sufficient proof of complete history. Reconcile gaps from chain data with idempotent processing.
6. **Infrastructure portability:** Prefer clear boundaries between Qrate code and vendor SDKs/services.

## Provisional responsibility matrix

| Responsibility | Proposed service | Status |
|---|---|---|
| Video storage/encoding/delivery | Cloudflare Stream, Bunny Stream, or other managed provider | **TBD** |
| User database/social records | Supabase/Postgres | Likely, verify actual code |
| Authentication | Supabase Auth | Likely, final model TBD |
| Wallet connection | Phantom, Solflare, other compatible wallets | Intended |
| Embedded wallet provider | Privy or alternative | **TBD** |
| Token creation, swapping, liquidity | Meteora DBC → configured Meteora migration pool (DAMM v2 intended) | Restricted read-only DBC/DAMM decoding and verified migration following exist; launching/swapping remain intended |
| RPC, WebSockets and recovery queries | Helius | Finalized durable collection/recovery locally tested; live throughput/quotas not verified |
| Application API and event workers | Railway | Likely, verify actual code |
| Price chart UI | TradingView Lightweight Charts 5.2.1 | Empty responsive canvas integrated; candle data/API pending |
| Moderation | Hybrid automated checks + human review | Conceptual, **TBD** |
| Fiat on-ramp/card payments | Regulated integration if appropriate | **TBD** |

## High-level data flows

### Watching a video

`Viewer → Qrate feed API → video metadata → signed/public media URL → CDN/adaptive player`

- Persist viewer/social actions in the application database under appropriate access rules.
- Distinguish video playback success from market-data availability.

### Creating a video token (sequence TBD)

`Creator uploads/drafts video → processing/moderation checks → launch cost preview/payment authorization → user-authorized Meteora transaction(s) → on-chain verification → associate mint + pool with video → show tokenized state`

- Whether publication precedes token creation is **TBD**. Do not hard-code an irreversible atomic-publication assumption.
- Implement an idempotent launch state machine so retries cannot create duplicate tokens for a video.
- Never treat an RPC timeout as proof that the transaction failed.

### Trading

`User wallet signs transaction → Solana / Meteora DBC or DAMM v2 → confirmed chain result → Helius observations/reconciliation → backend normalized trades/aggregates → trading UI and charts`

- Show estimated outcomes with slippage and network costs.
- Never custody or proxy-sign users' transfers from a Qrate server.
- Keep protocol-specific swaps/decoders separate; **PumpSwap is not a requirement**.

### Creator fee earnings

`Meteora fee allocation / eligible claim account → creator-authorized claim → creator wallet`

- Prefer a mechanism where creators claim their own earnings on-chain, with no Qrate custody.
- Verify precise on-chain authority, claim eligibility, accrual events, protocol deductions, DBC vs DAMM v2 behavior, and revenue reporting before implementing.
- Proposed 60/40 Qrate/creator share requires a verified configuration and supporting accounting.

## Video optimization architecture — approved concept

- 60-second maximum; accept multiple input aspect ratios.
- Inspect upload metadata; **selectively** compress oversized inputs client-side rather than forcing browser transcoding for every video.
- Upload directly to the chosen video provider, preferably with resumable support; avoid proxying entire large video files through Railway.
- Provider/server transcoding into adaptive renditions (illustrative ladder **360p, 540p, 720p, 1080p**) with source-quality ceiling.
- Initial codec consideration: H.264 video + AAC audio; evaluate AV1/HEVC later based on device compatibility/cost.
- Target 1080p visual quality when input permits, with adaptive HLS/compatible streaming where supported.
- Play the active feed video and preload only a small part of the likely next one; stop buffering distant videos; use CDN and segment caching.
- Measure watch time, buffering, delivered minutes/GB, startup latency, transcode time, and cost per 1,000 actual views.
- Keep drafts private and avoid exposing unreviewed content. Moderation/publishing workflow **TBD**.

## Market data reliability

### Verified boundary — 2026-10-28

`backend/src/market.ts` verifies an explicitly selected standard DBC pool and reads/decodes receipts through `src/meteora/`. Supported exact-input WSOL swaps are normalized from authenticated frame-local events plus token-transfer evidence; amounts and price ratios remain exact. SDK IDL data is pinned with an MIT notice; no Meteora SDK package was installed. The old PumpSwap default is removed. Inspection prints records; collection stores them as described below. No candle API/frontend data connection exists yet.

Stage 2.2 adds a separate local analytics database at `backend/data/market.sqlite` using native SQLite (Node >=22.13). Finalized pool notices/signature scans feed durable jobs; the existing decoder's receipt/trades/status commit atomically. Recovery persists pagination and must find a real signature anchor, otherwise it reports a coverage gap. First collection intentionally covers the latest 100 signatures, not lifetime history. `storage/market-store.ts` owns transactions/uniqueness/leases; `market/` coordinates paced reads, retries and reconnect recovery. Legacy `qrate.sqlite` is not migrated. This does not choose the production user database or implement the chart/candle API.

Stage 2.3 adds a pinned DAMM v2 verifier/decoder and migration verifier under `src/meteora/`. A finalized DBC migration plus direct DAMM initializer and a verified destination snapshot establish the link; matching mints alone do not. SQLite schema 2 adds the link and destination recovery anchor atomically with the source receipt outcome. Live collection follows both pool partitions using shared RPC pacing; one-shot recovery follows the destination in a bounded second pass. Linked DAMM history starts at the migration signature, while standalone bootstrap remains latest 100. Older missing DBC migration evidence requires an explicit signature, not a guessed destination. Schema 1 upgrades additively on a writable collection run; unrelated historical databases remain untouched.

The remaining requirements below are intended architecture where not covered by these slices. Legacy raw transport remains in-memory. Restricted exact-input/token-A-WSOL coverage does not provide all Meteora modes or independently prove provider completeness. See `backend/docs/{market-data-dbc,market-storage-recovery,market-data-damm}.md` for supported cases and evidence. Candles and frontend data delivery remain absent.

- Subscribe to relevant Meteora pools via Helius WebSockets.
- Verify signatures/transaction status; skip failures; use bounded workers, backpressure, retries with jitter, persistent checkpoints and deduplication.
- Periodically reconcile slot ranges and backfill missed transactions after disconnects/restarts.
- Build OHLCV candles, price, volume, market cap and holders from verified data with explicit units/definitions.
- Store raw chain identifiers (signature, slot, instruction context, pool, mint), reconciliation state, and aggregate provenance. Exact schema TBD pending actual-code audit.
- Support graduation/transition from DBC to configured DAMM v2 pool without silent data discontinuity.

## Security, compliance and operational constraints

- Protect service-role credentials and RPC keys; enforce database authorization per user.
- Verify wallet signatures and ownership for privileged creator actions; never trust a client-submitted owner address without authentication.
- Use rate limits, abuse controls, reporting, monitoring, alerting, backups, and health checks.
- Basic safeguards run throughout development; production readiness reviews remain a distinct stage.
- **EU/Apple regulatory model TBD**. Consult counsel on Qrate's service activity, fee distribution, token offers and App Store restrictions; do not equate self-custody with automatic exemption.

## Costs and provider evaluation

- Planning figures are **unverified assumptions**: approximately $200/month target; illustrative itemized $244/month, subject to actual usage and current pricing.
- Compare video providers on **full lifetime cost** (storage, encoding, delivered minutes or GB, previews/preloading, CDN egress, deletion policy and transcoding).
- Compare Helius and database limits under real transaction volume and WebSocket reconnect load.
- Avoid committing to a provider before testing real 60-second videos and measured watch/view patterns.
