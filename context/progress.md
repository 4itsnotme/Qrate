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

**User override — 2026-10-28:** move directly to stage 2 (market data). Remaining stage-1 creator-profile navigation and physical-device/Safari checks are deferred, not marked complete. The numbered roadmap remains the reference for subsequent stages.

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
| 1. Partial video feed prototype | Scrolling/loading and trading navigation Chrome-tested on 2026-10-28; stage remains partial | `frontend/index.html`, `feed.js`, `feed-data.js`: bounded media lifecycle, single playback, adjacent loading, wheel/touch/keyboard navigation, dynamic entries and empty trading routes. Creator navigation and physical-device/Safari verification pending. |
| 2. Market data | In progress: restricted DBC/DAMM + durable recovery/migration following verified | Exact trades, SQLite jobs/checkpoints and receipt-proven graduation following implemented. Ordering/candles/statistics and API/chart delivery remain pending. |
| 3. Token launching | Not implemented | No DBC setup, metadata, video association, signing, confirmed launch state or fee configuration. Publishing sequence remains TBD. |
| 4. Trading | Navigation and empty chart only | Real Lightweight Charts canvas added by explicit user request. No candle data connection, wallet connector, quotes, swaps, slippage or confirmations. |
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

Preserve these remnants, but do not mark them complete. Importing the old API fails because it expects `supportsSwapDecoding`, absent from current configuration. Build leaves old files in `dist`, so compilation does not validate them. Four installed packages (`bs58`, `base-x`, `lightweight-charts`, `fancy-canvas`) are extraneous to the declared dependency graph. Since the audit, current source gained a separate native SQLite market store and a vendored frontend chart; these do not adopt the old analytics API/database. See the map for the full artifact inventory.

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

1. Approved product specifies Meteora DBC/DAMM v2 and excludes PumpSwap. Stage 2 removed the PumpSwap default and added a restricted DBC decoder. Historical ignored PumpSwap artifacts/data remain preserved, outside the product path.
2. Provisional Supabase, Railway, wallets, managed video and chart architecture is not implemented. SQLite remnants do not settle the production database decision.
3. README describes future analytics responsibilities; `start`/`dev` currently run a slot probe. README says four retries; implementation makes four attempts total.
4. UI requirements (60-second validation, discovery tabs, profiles and removal states) are mostly absent. Trading navigation was added on 2026-10-28 with intentionally empty contents. Add video is a local preview, not an upload/private draft.
5. `known-issues.md` now records the verified stage-2 coverage/recovery limitations; the original pre-audit sentence was removed.
6. Original audit did not independently reverify older Helius mint/pool claims. Stage 2 now verifies an explicitly selected DBC pool/config/mints/vaults through fresh RPC snapshots; this does not establish a Qrate token launch.

### Roadmap alignment — 2026-10-28

The feed prototype was addressed first. The user's later explicit instruction to skip to stage 2 supersedes the remaining stage-1 tasks; creator-profile navigation and physical-device/Safari checks stay deferred and incomplete.

### Stage 1: finish and verify feed scaffolding

Use `frontend/index.html` and the agreed interactions in `ui-context.md`. Prepare a standard feature spec for this small prototype task, then complete only the missing navigation scaffolding and verify the player in a browser.

Acceptance criteria:

- [x] Vertical scrolling and keyboard navigation select one active player; inactive videos pause and audio remains limited to the active video (Chrome/emulation checked).
- [x] Trade button and right swipe open the same video-specific empty trading-page shell. Returning restores the selected feed item and position (Chrome-verified 2026-10-28).
- Creator name/avatar opens a profile-page shell with a return path to the feed. Shells are explicitly unfinished and do not imply working markets, accounts or profiles.
- [x] Check local preview, sound controls, background pause/resume and aspect-ratio preservation at desktop and mobile viewport sizes; record observed results and limitations. Physical devices/Safari remain unverified.
- No market values, balances or confirmed activity are invented to populate the shells.

These criteria define a partial prototype, not the full video system. Uploads, processing, streaming, persistent drafts and full discovery belong to stage 5; real trading belongs to stage 4 and profile functionality to stage 8. Detailed trading/profile layouts remain deferred. Remaining stage-1 work is creator-profile navigation and physical-device/Safari checks.

### Per-video empty trading tab — 2026-10-28

- Status: implemented and browser-verified for the scoped task; stage 1 remains partial.
- Goal/spec: phone right swipe and desktop glossy transparent Trade button open the selected video's trading tab, empty except for Back navigation. Each video retains its own route for its future chart. Buttons are also available on phones for accessibility.
- Scope: native frontend navigation only. Charts, wallet/trade execution, market data and creator-profile navigation are outside this change. Existing player/scroll logic is reused; no dependencies or backend changes.
- Implementation: `frontend/index.html` adds prototype video IDs, glass buttons, a blank tab shell, hash/history handling, gesture filtering, background playback guards and feed/focus/playback snapshots. Back, Escape, browser Back and phone left swipe return to the feed.
- Verification: temporary CDP QA script run with `node "$env:TEMP/qrate-trade-check.mjs"` against an isolated headless Chrome session. Desktop 1440×900 and phone emulation 390×844 passed all three per-video buttons/routes; blank contents; paused/inert background; Back/Escape/browser history; direct-link return; short/wrong-direction rejection; native vertical scrolling; right swipe on the current video; position restoration; local preview/sound; and resume-only-if-previously-playing. No browser JavaScript exceptions. Inline JavaScript syntax check also passed.
- Limits: phone tests were emulated Chrome, not physical devices or Safari. Stable slot IDs are prototype identifiers, not persisted video/token records. Existing media/provider limitations remain.
- Research: reviewed native touch behavior in [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [MDN Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events), and the [W3C Touch Events repository](https://github.com/w3c/touch-events). No external implementation code was copied.
- Docs: updated `codebase-map.md`, `progress.md`, `ui-context.md`. No new dependency, schema, chart or financial configuration.

### Feed scrolling and media lifecycle — 2026-10-28

- Status: requested implementation complete and verified in Chrome desktop/phone emulation; overall stage 1 remains partial.
- Goal: one-item scrolling with reliable autoplay and bounded heavy media resources, preserving the existing native frontend and empty per-video trading tabs.
- Scope/exclusions: frontend scrolling, media lifecycle, optional pagination adapter and recovery only. No framework/dependencies, application API, video hosting/transcoding, blockchain, wallets, authentication or trading implementation.
- Dependencies/reuse: native CSS snap, IntersectionObserver, media APIs, AbortController and existing controls/history/gesture behavior. Inline frontend logic moved to `frontend/feed.js`; feed entries/provider boundary lives in `frontend/feed-data.js`. No dependency installation.
- Data flow: local multi-file picker or append API → normalized/deduplicated records → lightweight stage shells → visibility-selected active item → N−1/N/N+1 media window, N+2 poster only. Optional loader uses cursor/signal; there is no backend call by default.
- Failures/security: only supported URL schemes/unique safe IDs; DOM text uses textContent; failed media/autoplay get Play/Retry; canceled plays retry at most once; stale media/provider responses are ignored. Pagination errors are separate from playback. No secrets, uploads or user funds involved.
- Performance acceptance: 160 fixture videos tested with at most 3 attached video elements, at most 1 playing, current/next-only media requests and no media reset on append. Distant media releases its source/element; fixed delegated listeners do not accumulate. This is a measured element/request bound, not a production heap/bandwidth benchmark.
- Cost: no new service/dependency charges. Browser hints cannot enforce a byte budget; managed adaptive video remains later work. Lightweight shell count grows with entries; complex DOM virtualization was intentionally not added.
- Verification: `node --check frontend/feed.js`, `node --check frontend/feed-data.js` and browser-check syntax passed; `node --test --test-isolation=none frontend/test/feed-data.test.cjs` **4/4 passed**. `node frontend/test/feed-browser-check.mjs` passed desktop 1440×900 and phone 390×844 checks: wheel/trackpad-like bursts, keyboard/touch, repeated rapid forward/back jumps, loading window/request scope, autoplay/sound, failure/retry, bounded cancellation recovery, Save-Data policy, background resume, trading return/paused intent, dynamic deduplication, provider coalescing/retry, local multi-file preview, file:// and listener/media teardown. No JavaScript exceptions.
- Regression checks: backend `npm.cmd run typecheck`, `npm.cmd run build`, and `node --test --test-isolation=none test/listener.test.mjs` passed (**2/2 backend tests**). Backend application source unchanged. Browser suite uses local generated QA media, no external videos/RPC/credentials.
- Limits: real trackpad hardware, physical phones, Safari, device memory and production bandwidth/startup targets unverified. Save-Data test exercises policy, not carrier performance. `preload` remains a browser hint; no thumbnail extraction or adaptive streaming is claimed.
- Rollback: baseline source checkpoint `493d09b` (`legacy scroll`) preserves the earlier inline controller. Review/revert only this scoped frontend change if needed; do not discard pre-existing context edits or local artifacts. No database migration or data change.
- Docs: `frontend/README.md`, `codebase-map.md`, `progress.md`, `ui-context.md`. Official references reviewed: [media preload](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload), [load/reset](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load), [play promises](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [wheel events](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event), [Network Information](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API), [W3C CSS Scroll Snap source](https://github.com/w3c/csswg-drafts/tree/main/css-scroll-snap-1). No external implementation copied.
- Next action: superseded by the user's explicit move to stage 2 below; stage-1 profile/device gaps remain deferred.

### Stage 2.1 — read-only Meteora DBC decoder slice

Per the user's explicit override, market-data development proceeds while remaining stage-1 work is deferred. The extended specification and official-source research are recorded in `backend/docs/market-data-dbc.md`. No dependency was installed and no production storage/provider decision was made.

Implemented outcome: a supported verified DBC pool/transaction produces an exact normalized buy/sell record, signature/slot/instruction identity and rational execution price, or an explicit rejection. Existing transport is reused; protocol code stays under `backend/src/meteora/`. The old PumpSwap default was removed, with no silent live-token replacement. Ignored historical artifacts/data are preserved.

Acceptance criteria:

- Verify program ownership, mint pair and decimals; reject wrong pools and failed transactions.
- Use real sanitized protocol fixtures for buys/sells, malformed/unsupported data and duplicate processing; never present synthetic prices as product data.
- Preserve exact integer amounts, define price/fee units, and keep separate swap invocations distinct within one transaction.
- Run tests without live credentials or user funds; update progress/map with evidence.
- Keep launching/trading, production database/provider selection and TBD publishing sequence outside this slice.

### Stage 2.1 results — 2026-10-28

- Status: restricted read-only decoder slice implemented; **stage 2 overall remains in progress**. Creator-profile navigation was deferred by the user, not completed.
- Code: `backend/src/meteora/{dbc-schema,codec,pool,decode}.ts`, `src/market.ts`, optional pool-mentions/failed-notification flags in the existing listener, explicit empty tracking defaults, and two market npm commands. No wallet signing, transaction submission or dependency installation.
- Provenance: official SDK 2.0.0 / IDL 0.2.2 pinned at `3a965ec0c0a527c2be3c48b8b479366705bf4926`, with MIT notice/provenance in `backend/vendor/meteora`. No on-chain implementation source was copied or relicensed.
- Supported: standard DBC VirtualPool/WSOL `swap` and exact-input `swap2`; SPL Token or metadata-only Token-2022. Transfer fees/hooks, referrals, other quotes/modes/layouts and failed/ambiguous receipts are explicitly rejected. No fee-free spot quote, proposed 1.9% fee or 60:40 distribution is implied by execution-price records.
- Evidence: real recorded buy/sell at slot 462536749, with verified accounts snapshot at 462537098. Buy: 56,171,396 WSOL lamports → 114,549,982,220 raw token units. Sell: 108,670,144,128 raw token units → 52,712,942 lamports. Both reconcile against direct parsed transfers. Event versions are counted once; CPI paths separate multiple invocations.
- Live read: compiled `market.js inspect` fetched a fresh verified pool snapshot and decoded the recorded buy successfully. The sample pool had already graduated; live mode correctly refused it with exit 1. No active Mainnet live collection/recovery claim is made. Pool subscription/failure filtering is locally tested with real receipt data.
- Checks: strict typecheck/build passed; `node --test --test-isolation=none test/*.test.mjs` **17/17 passed**, and frontend data regressions **4/4 passed**. Automated tests need no live key/funds; fixtures contain public chain data only. Fresh verification reads used the existing private Helius config without logging it. Detailed cases/commands are documented in the backend spec and README.
- Limits at completion of this slice: storage/recovery was absent (now stage 2.2); DAMM/migration following was absent (now restricted support in stage 2.3). Candles, market API and frontend data connection remain pending. The frontend has an empty chart canvas.
- Docs: backend README/spec, schema/fixture provenance, context map/progress/architecture/known issues updated. No ignored database/artifact cleanup or schema migration.
- Follow-up: durable storage/recovery is implemented in stage 2.2 below. DAMM v2/migration support, aggregates/candles and API/chart delivery follow; deferred stage-1 work stays deferred.

### Trading chart UI — 2026-10-28

- Status: frontend chart integration implemented; verified price/candle data remains pending in stage 2. The user explicitly requested adding the chart now.
- Changed: `frontend/index.html` gains a responsive dark chart panel/title/attribution; `trading-chart.js` creates a real Lightweight Charts 5.2.1 candlestick series on a selected video route and removes it on close. `feed.js` invokes the lifecycle without changing feed playback/navigation.
- Data: series starts with `setData([])` and **No price data yet.** No fake candles, API endpoint, mint association, SDK/backend dependency or trading behavior was added.
- Dependency: tracked standalone 5.2.1 browser bundle, SHA-256 `e21cc5caa0226ef30bd8549c50b9ef926615f2a4ee6b4e486353477a55f598cf`, byte-matched to its published release; Apache-2.0/NOTICE plus included fancy-canvas MIT notice retained. Page attribution/link and library logo visible. No npm installation or runtime CDN required.
- Verification: syntax checks and expanded `frontend/test/feed-browser-check.mjs` cover real canvas creation, correct per-video identity, usable desktop/mobile dimensions, removal on return, file:// loading and graceful library failure, alongside existing scrolling/media/pagination/trading navigation checks. No real market data is implied by these UI checks.
- Docs: frontend README, map, progress and UI context updated. Storage/recovery has since been implemented below; chart data delivery remains pending.

### Stage 2.2 — trade storage and missed-data recovery — 2026-10-28

- Status: requested local storage/recovery implementation complete and locally tested; stage 2 overall remains in progress.
- Code: `backend/src/storage/market-store.ts` owns SQLite transactions, trade identities, signature jobs, checkpoints and collector leases. `backend/src/market/` owns paced finalized RPC, resumable discovery, receipt processing and live/recovery coordination. CLI adds `market:recover` and read-only `market:status`; `market:listen` now persists finalized jobs/trades.
- Database: new ignored `backend/data/market.sqlite`, created only when collection runs. Existing `qrate.sqlite` is untouched and rejected by the new schema ownership check. No dependency installed; native SQLite raises the runtime requirement to Node >=22.13.0 (tested 24.22.0).
- Recovery: startup/reconnect/periodic scans, durable retries and atomic page/cursor updates recover missed signatures without duplicate trades. An actual checkpoint signature must be found; missing/pruned anchors report gaps. Receipt/trades/outcome commit together. A pool lease prevents concurrent collector ownership and expires after 90 seconds following a crash.
- Coverage: first collection starts at the latest 100 finalized pool signatures, not lifetime history. Checkpoints mean signatures discovered, not all receipt jobs processed. Status exposes pending/rejected/failed jobs, coverage bounds and scan errors. One-shot recovery is bounded and reports unfinished work. RPC starts are paced at two/second with 429 cooldown; real production throughput is unverified.
- Verification: strict typecheck/build and **35/35 backend tests** passed. Tests include recorded buy/sell persistence, physical SQLite reopen/replay, same-slot multipage resume, absent anchors, RPC outages, retry/cancellation, conflicting-data rollback, storage-write failure, lease expiry and end-to-end local WebSocket disconnect/reconnect recovery. Crash tests simulate pending work/lease expiry; no power-cut test or live Mainnet backfill was run. Frontend data regression checks: **4/4 passed**.
- Docs: new simple `context/code-overview.md` explains where files live and how data flows; detailed map, architecture, known issues, workflow, progress and backend README/spec updated.
- Follow-up: restricted DAMM/migration following is implemented in stage 2.3 below. Verified transaction ordering, candles/statistics, API and frontend delivery remain pending. Local analytics storage does not decide the production user/auth database.

### Current stage 2.3 — DAMM v2 decoding and migration continuity — 2026-10-28

- Status: restricted read-only DAMM v2 and migration following implemented and locally tested. Stage 2 remains in progress; no frontend/trading/launch behavior added.
- Code: `src/meteora/{damm-schema,damm-pool,damm-decode,migration,market-types}.ts`; existing fixed-struct reader/CPI frames and transport/storage/recovery reused. Official MIT SDK 1.5.1 / IDL 0.2.5 schema data pinned at `b66412daefab1edfddbc98f9655ddd2733fe021d`, with license/provenance. No new dependency installed.
- Supported: token-A/WSOL-token-B standard `swap` / exact-input `swap2`, fee modes 0/1, SPL or metadata-only Token-2022. Direct per-frame transfers must match authenticated EvtSwap2. Other orientations/quotes, referrals, compounding, transfer fees/hooks, partial/exact-output and unknown optimized instructions are rejected.
- Continuity: successful finalized DBC migration instruction and direct matching DAMM initializer, plus verified current destination snapshot, establish the link. The source outcome/link/destination anchor commit atomically. Live collection follows both partitions with shared pacing; bounded recovery follows the destination; restart re-verifies and follows saved links. Destination history recovers to migration, including when older than 100 signatures.
- Coverage/CLI: `--protocol damm-v2` selects standalone DAMM (latest-100 bootstrap). DBC remains default. `--migration-signature` supplies older migration evidence outside DBC bootstrap and can retry a previously quarantined migration. Missing evidence reports incomplete status. Stop an active standalone destination collector before extending coverage. One-shot page/job bounds apply per pool (at most source plus linked destination).
- Schema: market database version 2 adds `migrations` transactionally, preserving schema-1 jobs/trades. Read-only status asks schema-1 users to run writable recovery to upgrade; older code refuses schema 2. Historical `qrate.sqlite` remains untouched. No default market DB was seeded.
- Verification: strict types/build and **53/53 backend tests**, plus **4/4 frontend data regressions** pass. Real recorded routed DAMM buy/direct sell/finalized migration and pool accounts cover exact quantities. Tests include altered evidence, CPI scope, unsupported modes, rollback after target creation, schema upgrade, active target lease protection, restart links, >100-signature recovery and both live subscriptions stopping cleanly.
- Live read: fresh finalized Mainnet `market.js inspect --protocol damm-v2` decoded the recorded buy with exact transfers and no rejections; no data saved. Sustained live Mainnet graduation/backfill, full lifetime DBC history, provider omissions and power-loss behavior remain unverified. Real swap fixtures use legacy `swap`; exact-input `swap2` is exercised via explicitly test-only conversion.
- Docs: backend README/spec/license/fixture provenance and context overview/map/architecture/issues/progress updated.
- Next task: specify **verified transaction ordering and OHLC candles/statistics** using saved exact trades, then serve them to the existing chart. Keep the chart empty until real data delivery is implemented. Wallet trading/launching remain later roadmap stages.

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

