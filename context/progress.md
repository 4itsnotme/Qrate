# Qrate — Roadmap and Progress

> **Repository audit: 2026-10-27.** Status reflects current source and local verification, not deployed functionality. Preferred roadmap and unresolved decisions remain unchanged. Detailed evidence is in [codebase-map.md](codebase-map.md).

## Documentation progress

- [x] Step 1: Product overview decisions gathered (multiple subtopics still TBD)
- [x] Step 2: Provisional architecture mapped
- [x] Step 3: Core invariants approved
- [x] Step 4: Build vs integrate approach approved
- [x] Step 5: Permanent project context approved
- [x] Step 6: Preferred development order approved
- [x] Step 7: Standard + extended feature specs approved
- [x] Step 8: Research, inspection, explanations and codebase-map rules approved
- [x] Step 9: Implementation workflow approved
- [x] Step 10: Verification/review rules approved
- [x] Step 11: Debugging workflow and known-issues log approved
- [x] Step 12: Current documentation/dependency management approved

## Preferred development order

1. **Partial video feed prototype** — scrolling/player/navigation scaffolding.
2. **Market data** — Helius, Meteora trade decoding, candles/statistics, recovery.
3. **Token launching** — DBC setup, video/token association, fees, launch verification.
4. **Trading** — wallet approvals, swaps, confirmations, slippage.
5. **Complete video feed & video infrastructure** — upload/processing/streaming/drafts.
6. **Social features** — likes, comments, shares, follows, bookmarks.
7. **Authentication** — full registration/sign-in systems.
8. **Profiles** — creator and viewer profiles, links, verification status.
9. **Portfolio** — holdings, PnL, trades.
10. **Creator dashboard** — video performance, earnings and claims.
11. **Moderation** — reports, prelaunch checks, copyright, removal appeals.
12. **Reliability** — final hardening, audits, monitoring, recovery, regression suite.

**Important prerequisites:** Basic wallet authorization is needed before real trading, even if full authentication arrives later. A minimum video/upload identifier is needed to associate launches before completing the video system. Essential security, privacy, moderation safeguards and reliability checks must be implemented throughout—not deferred wholesale until modules 11–12.

## Current implementation status

No complete end-to-end product stage is verified. Two foundations exist: a local video-player prototype and a read-only transaction observer.

| Roadmap stage | Actual status | Evidence / remaining work |
|---|---|---|
| 1. Partial video feed prototype | Partially implemented; browser behavior unverified in this audit | `frontend/index.html`: three scroll-snap slots, responsive navigation, local preview, active playback/audio and keyboard paging. Trade/swipe-right and creator navigation absent. |
| 2. Market data | In progress: raw transport locally tested | Seven backend source modules provide Helius reads/subscriptions, retries, reconnects and bounded memory deduplication. No current source for Meteora decoding, durable storage, recovery, aggregates, candles or API. |
| 3. Token launching | Not implemented | No DBC setup, metadata, video association, signing, confirmed launch state or fee configuration. Publishing sequence remains TBD. |
| 4. Trading | Not implemented | No wallet connector, quotes, swaps, slippage or confirmation UI. |
| 5. Complete video feed/infrastructure | Local preview only | No provider/upload endpoint, duration validation, transcoding, adaptive streaming, drafts or persistent catalog. |
| 6. Social | Not implemented | No likes, comments, shares, follows or bookmarks. |
| 7. Authentication | Not implemented | No registration/session system or authorization policies. |
| 8. Profiles | Not implemented | No profile screens/records, account linking or verification. |
| 9. Portfolio | Not implemented | No holdings, valuation, PnL or personal trade history. |
| 10. Creator dashboard | Not implemented | No analytics dashboard, fee accounting or claims. |
| 11. Moderation | Not implemented | No content checks, reports, deletion review, appeals or admin tools. |
| 12. Reliability | Initial observer safeguards only | Timeouts, cancellation, heartbeat, reconnect and two tests exist. No source-backed persistent checkpoints/reconciliation, CI or production monitoring. |

### Completed and verified foundations

- Backend package/lockfile, strict TypeScript compilation and ESM entry points are present and build successfully.
- Helius configuration and slot probe are implemented; live connectivity was not rechecked.
- Observer passes local tests for subscription, fetching after a null result, duplicates across reconnect and shutdown. Second test covers a pre-aborted fetch without exposing its URL.
- Secrets, generated output and SQLite paths are Git-ignored. Secret contents were not inspected or documented.

### Local work that is not reproducible from source

Ignored `backend/dist/` contains **21 modules with absent TypeScript source**, including a PumpSwap decoder, SQLite storage/queue, chart API, market lookup and SOL/USD conversion. Referenced chart page/assets are absent; source maps contain no embedded source. SQLite holds **1,507 PumpSwap swap rows**, **1,507 ordering rows** and **19,030 RPC job rows** at audit; records were not independently verified on-chain.

Preserve these remnants, but do not mark them complete. Importing the old API fails because it expects `supportsSwapDecoding`, absent from current configuration. Build leaves old files in `dist`, so compilation does not validate them. Four installed packages (`bs58`, `base-x`, `lightweight-charts`, `fancy-canvas`) are extraneous to the declared dependency graph. Current source has no SQLite or chart integration. See the map for the full artifact inventory.

### Audit and documentation update — 2026-10-27

- Status: audit complete; product implementation partial.
- Baseline HEAD: `133ac71` (`Add Helius Mainnet WebSocket transaction listener`). No audit commit created.
- Scope: all eight context files, application source/tests, manifests/lockfile, ignore rules, README and local generated/data artifacts. Updated only map/progress; no application source or dependency changes. Test build regenerated ignored compiled output.
- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: compilation passed; default runner failed at subprocess creation (`spawn EPERM`), before test execution. This command did not pass.
- `node --test --test-isolation=none test/listener.test.mjs`: **2/2 passed**, using freshly compiled source and local HTTP/WebSocket fixtures.
- Frontend inline JavaScript syntax: passed. Browser/device behavior, live providers, prices, chain correctness and deployments were not tested.
- Read-only SQLite schema/count inspection and artifact import confirmed the source/remnant distinction above. No migration/write commands were run against the database.
- Existing Git changes (two deleted root agent files, untracked context directory) were preserved. PowerShell blocks `npm.ps1`; `npm.cmd` works without changing execution policy.

### Documentation/implementation inconsistencies

1. Approved product specifies Meteora DBC/DAMM v2 and excludes PumpSwap, but configured sample pool and historical local decoder/data use PumpSwap. This is an experimental observation target, not Meteora integration.
2. Provisional Supabase, Railway, wallets, managed video and chart architecture is not implemented. SQLite remnants do not settle the production database decision.
3. README describes future analytics responsibilities; `start`/`dev` currently run a slot probe. README says four retries; implementation makes four attempts total.
4. UI requirements (60-second validation, discovery tabs, trading navigation, profiles and removal states) are mostly absent. Add video is a local preview, not an upload/private draft.
5. `known-issues.md` retains a pre-audit sentence. Other context files are unchanged; use this audit/map for implementation evidence.
6. README/comments report prior Helius mint/pool verification. Historical network claims were not independently reverified here; current observer does not verify pool contents.

### Recommended next task — stage 2: one read-only Meteora decoder slice

Continue market data before token launches or swaps. Start with the required extended feature spec and current official Meteora/Solana API/SDK research. This audit does not select or approve a new dependency or architecture.

Proposed outcome: given a verified DBC pool and transaction, produce a normalized swap record with exact token/SOL amounts, direction, signature, slot and instruction identity, or an explicit rejection. Reuse transport and keep decoding separate. Resolve the PumpSwap sample mismatch in this scope; inventory/preserve remnants before considering reuse. Do not silently expand PumpSwap or reconstruct the entire missing analytics system.

Acceptance criteria:

- Verify program ownership, mint pair and decimals; reject wrong pools and failed transactions.
- Use real sanitized protocol fixtures for buys/sells, malformed/unsupported data and duplicate processing; never present synthetic prices as product data.
- Preserve exact integer amounts, define price/fee units, and keep separate swap invocations distinct within one transaction.
- Run tests without live credentials or user funds; update progress/map with evidence.
- Keep launching/trading, production database/provider selection and TBD publishing sequence outside this slice.

Subsequent stage-2 work: durable idempotent storage/checkpoints, disconnect backfill, DAMM v2/migration support, then aggregates/candles and API/chart connection. Local remnants do not satisfy these acceptance criteria.

## Open decisions (TBD)

- Video publishing **before or together with** token creation; whether tokenless videos appear in feeds.
- Video provider and exact encoding formats/costs.
- Authentication and embedded wallet vendor (Privy vs alternatives); account-linking flow.
- Creator verification thresholds and manual review requirements.
- Video moderation automation/human approval and appeals.
- Launch deposit/bail amount, refund trigger, funds source, eligibility.
- Exact Meteora fee sharing, DBC setup, DAMM v2 migration and price impact calculations.
- Fiat on-ramp/payment architecture.
- EU MiCA/CASP/token issuance/legal assessment and Apple App Store country-specific submission plan.
- Live streaming, direct messages and advanced trading order scope.
- Precise UI design and creator dashboard layout.
- Security incident and shutdown procedures.

## Working financial assumptions (not vendor quotes)

- Approximately **$200/month** operating target; prior illustrative **$244/month** line-item scenario.
- Trading fee proposal **1.9%**, expected Qrate/creator **60/40 of distributable fees**.
- Creator launch-deposit reimbursement concept **TBD**.

## Feature update template

```md
### [Feature / task] — [YYYY-MM-DD]
- Status: planned / in progress / tested / complete / blocked
- Owner / commit / PR: ...
- Relevant modules: ...
- What changed: ...
- Tests and observed results: ...
- Unverified or failed cases: ...
- Costs or limits discovered: ...
- Docs updated: ...
- Next action: ...
```

