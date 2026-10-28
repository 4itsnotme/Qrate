# Qrate — Codebase Navigation Map

> Audited **2026-10-27** against the current working tree, all application source/tests, manifests/lockfile, README, and local generated/data artifacts. Proposed services and ignored remnants are distinguished from reproducible source. Deployments and live provider behavior were not verified.

## Current architecture

Start with [the simple code overview](code-overview.md) for a short guide. Updated 2026-10-28 for storage/recovery.

Qrate has two independent programs: a static browser video-preview prototype and a read-only-chain Node.js Solana market collector. **There is no source-backed application API or data connection between them.** The raw observer prints receipts; market collection validates supported DBC receipts and saves exact trade/execution-price records in a separate local SQLite database. Current source does not sign or submit transactions.

Ignored local files also contain an older analytics build and populated SQLite database, but their corresponding source is absent. They cannot be counted as a working, reproducible application.

## Repository layout and entry points

| Path | Responsibility / first symbols to inspect |
|---|---|
| `frontend/index.html` | Markup/inline CSS, initial empty feed shells, picker/loading status and trading chart panel. Loads deferred plain scripts; no framework, bundler or package manifest. |
| `frontend/trading-chart.js`, `frontend/vendor/lightweight-charts/` | Real Lightweight Charts 5.2.1 canvas with an empty candlestick series; per-video open/close/resize/error handling. Tracked standalone bundle/hash/licenses/NOTICE, no runtime CDN or backend data. |
| `frontend/feed.js` | Playback/resource controller, active-stage observer, wheel/keyboard/touch navigation, delegated controls, trading routes, local previews, visibility and teardown. Public adapter: `window.qrateFeed`. |
| `frontend/feed-data.js` | `QrateFeedData`: normalized entries, deduplication, optional cursor loader, coalesced requests, retries and canceled/stale provider protection. No backend endpoint assumed. |
| `frontend/README.md` | Local usage, loading policy, adapter contract, verification commands and limits. |
| `frontend/test/feed-data.test.cjs` | Four credential-free Node tests for data-boundary behavior, retry, deduplication and stale provider responses. |
| `frontend/test/feed-browser-check.mjs` | Chrome CDP checks with an allowlisted local HTTP/media fixture server; uses existing backend `ws`. No application API or external media service. |
| `frontend/LOGO.png` | Image asset, not referenced by the current HTML. |
| `backend/package.json`, `package-lock.json` | Private ESM Node package, scripts and pinned dependencies. No root package/workspace manifest. |
| `backend/tsconfig.json` | Strict TypeScript, NodeNext modules, ES2024 target; compiles `src/**/*.ts` to `dist/`. |
| `backend/src/index.ts` | One-shot RPC connectivity command; calls `getSlot` and exits. `start`, `dev` and `rpc:test` run this, not an HTTP server. |
| `backend/src/config.ts` | `getHeliusRpcUrl`, `getHeliusWebSocketUrl`; loads backend `.env`, validates `HELIUS_API_KEY`, constructs private Mainnet URLs. Existing environment variables take precedence. |
| `backend/src/helius.ts` | `getSlot`: confirmed JSON-RPC read, 15-second timeout, HTTP/JSON/RPC/result validation and sanitized errors. |
| `backend/src/listen.ts` | Long-running observer command; selects only `trackedTokens[0]`, starts listener and handles SIGINT/SIGTERM. |
| `backend/src/tracked-tokens.ts` | Optional typed Meteora references; array is now empty. Legacy PumpSwap default removed. Market commands require an explicit pool. |
| `backend/src/market.ts` | `market:inspect`, `market:listen`, `market:recover`, `market:status`: inspect, durably collect, backfill to checkpoint or read local status. No wallet/signing. |
| `backend/src/storage/market-store.ts` | Native SQLite schema, atomic receipt/trade writes, exact replay protection, pending jobs, recovery state and renewable pool leases. |
| `backend/src/market/{rpc,recovery,collector,run}.ts` | Paced finalized reads, resumable signature scans, receipt decoding/retries and live/recovery coordination. |
| `backend/test/storage-recovery.test.mjs` | Temporary physical SQLite files, replay/restart, gaps, leases, atomic failure and local WebSocket reconnect recovery. |
| `backend/src/meteora/codec.ts` | Bounded base58/IDL fixed-struct reader and exact integer formatting. No SDK or floating-point amount math. |
| `backend/src/meteora/dbc-schema.ts` | Data-only MIT IDL subset pinned to official SDK commit `3a965ec0…`, SDK 2.0.0 / IDL 0.2.2; compiled as TypeScript data. |
| `backend/src/meteora/pool.ts` | `verifyPoolSnapshot`, `loadVerifiedDbcPool`, sanitized RPC; owners/discriminators, config/mint/vault links, decimals/token extensions and coherent observation slots. |
| `backend/src/meteora/decode.ts` | `decodeDbcTrades`: per-invocation events plus direct transfer reconciliation → normalized trades or explicit rejections. |
| `backend/src/meteora/{damm-schema,damm-pool,damm-decode}.ts` | Pinned DAMM v2 IDL data, coherent pool/mint/vault verification and exact per-invocation swap decoding. Shared fixed-struct reader/CPI frame parser reused. |
| `backend/src/meteora/{market-types,migration}.ts` | Common pool/trade types and receipt-based DBC-to-DAMM migration proof; no inferred address from matching tokens. |
| `backend/test/damm.test.mjs`, `backend/docs/market-data-damm.md` | Recorded DAMM/migration fixtures, decoder failures, additive schema upgrade, atomic link/anchor, restart and live following tests/spec. |
| `backend/test/meteora.test.mjs`, `test/fixtures/` | Real recorded buy/sell/account snapshots and mutated negative/CPI cases; local RPC/pool-subscription tests. |
| `backend/docs/market-data-dbc.md`, `backend/vendor/meteora/` | Extended specification/results, pinned schema provenance and MIT notice. |
| `backend/src/logs-listener.ts` | Subscription, heartbeat and reconnect. Legacy raw mode uses an in-memory queue; market mode hands finalized signatures to durable storage and triggers recovery after subscription. |
| `backend/src/transaction-rpc.ts` | `getTransaction`: confirmed by default, finalized for collection; retries, validation, cancellation and optional paced fetch. Returns receipts, not decoded swaps. |
| `backend/test/listener.test.mjs` | Two Node tests with local HTTP/WebSocket fixtures; imports compiled observer/RPC modules. |
| `backend/README.md`, `backend/docs/market-storage-recovery.md` | Commands, storage/coverage semantics, evidence and limitations. Candle API/chart delivery remains planned. |
| `.gitignore`, `backend/.gitignore` | Ignore secrets, dependencies, builds and SQLite files; root also excludes browser verification artifacts. |
| `context/*.md` | Nine documents including the new simple `code-overview.md`; distinguish verified implementation from intended product behavior. |
| `backend/.env`, `.env.example` | Private local configuration exists; contents not inspected or reproduced. Example contains a blank `HELIUS_API_KEY`. |
| `backend/dist/`, `backend/data/`, `backend/node_modules/` | Ignored local generated output, database and installed dependencies; see remnants below. |

No source-backed migrations, API routes, CI workflows, deployment/container configuration, wallet adapters or auth policies were found in the original audit. Frontend hash routes were added on 2026-10-28 (below). No active `AGENTS.md` exists. Git showed `AGENTS.md` and `AGENTS (1).md` deleted and `context/` untracked before the original audit; those changes were preserved during that audit.

## Technologies, dependencies and integrations

| Layer | Verified implementation |
|---|---|
| Browser | Plain HTML/CSS/JavaScript, native video, CSS scroll snap, IntersectionObserver, File API/object URLs, Page Visibility API, requestAnimationFrame. No external browser scripts. |
| Runtime | Package requires Node `>=22.13.0` for native `node:sqlite`; tested runtime Node **24.22.0**, npm **11.19.1**. Full declared range not tested. |
| Runtime dependencies | `dotenv` **18.0.9**, `ws` **8.22.0**. |
| Development dependencies | TypeScript **7.0.2**, `tsx` **4.23.15**, `@types/node` **26.6.5**, `@types/ws` **8.18.2**. |
| Chain access | Direct JSON-RPC via native fetch/WebSockets to Helius Solana Mainnet. No declared Solana or Helius SDK. |
| Testing | Built-in `node:test`, `node:assert/strict`, local HTTP/WebSocket servers. |
| Meteora | Restricted read-only DBC/DAMM v2 decoders and verified migration following using pinned official MIT IDL data; full SDK not installed. Swap construction, launching and fee distribution remain unimplemented. |
| Planned only | Supabase/Postgres/Auth, Railway hosting, wallet connectors/Privy, managed video and production charts. No deployment/account setup verified. |

Manifest and lockfile root agree; installed declared versions match. `npm.cmd ls --depth=0 --prefix backend` additionally reports **extraneous** `bs58@6.0.0`, `base-x@5.0.1`, `lightweight-charts@5.2.1` and `fancy-canvas@2.1.0`. These are local remnants, not declared reproducible application dependencies. No dependencies were installed, removed or upgraded. Package license is `UNLICENSED`; dependency advisory/license research was outside this source audit.

## Communication and data flows

### Feed data and local video loading — updated 2026-10-28

`Add video / qrateFeed.appendVideos → normalized unique entries → stage shells → active-stage observer → media window → browser playback`

- `feed.js` keeps the existing native CSS Scroll Snap and trading navigation. Wheel/trackpad bursts advance one item after a small input threshold, with momentum-tail protection. Touch stays native; keyboard arrows/Page Up/Page Down/Home/End navigate. The document does not scroll. The 9:16 frame/object-fit preserves source ratios; mobile stages now center the frame in the available area. Existing desktop rounding and mobile square corners are retained.
- IntersectionObserver selects a stage at 60% visibility. Only visible candidates are considered; changing active index updates the old/new stage instead of walking the full feed. Wheel/keyboard navigation pauses the old player immediately. Only the active, visible, intended-to-play element may play; stale/canceled promises and late media events are checked against element identity. Automatic cancellation retry is bounded to one retry.
- At most **three video elements** are attached: N, retained N−1 and optionally N+1. Next loading waits until the active player has data. N+2 gets a supplied poster/app metadata only; its media URL is not attached. Distant videos are paused, detached from their source, reset with `load()`, removed, and recreated on return with their saved position. Unchanged adjacent sources are not reset on append.
- Save-Data/2G disables speculative next-media loading; 3G uses metadata only. Native Network Information support is optional. `preload=auto` is a hint, not a buffer guarantee or byte cap: browsers can fetch full small files. This is progressive browser-managed loading, not adaptive streaming.
- `data-media-state` exposes unloaded/poster/preloading/ready/active/inactive/released. Separate `data-playback-state` drives Loading/Play/Retry UI. Failed media and rejected autoplay have explicit recovery. User pause/mute choice, background pause/resume and trading-tab playback intent are preserved.
- Fixed delegated control/media listeners support appended/recreated elements. Lifetime AbortController, observer disconnection, timer/frame cancellation, source cancellation and object-URL cleanup cover teardown. Back-forward-cache suspension keeps local URLs available for return; final page exit revokes them.
- Add video accepts multiple local files: first replaces the first preview; extras fill empty slots then append. The picker accepts video MIME prefixes only. Files remain local and do not create drafts or publish content. Locally owned URLs are revoked on replacement/final cleanup; externally supplied URLs remain their owner's responsibility.
- `feed-data.js` validates IDs/URLs, deduplicates IDs and appends atomically. `qrateFeed.setLoader(loadPage, options)` optionally supplies pages `{items,nextCursor,hasMore}` using `{cursor,signal}`. Near the end, one request is coalesced across callers. Invalid/non-advancing pages fail separately from playback, expose Retry and preserve cursor. Replacing/disabling providers aborts requests and ignores late results. **No loader or backend request exists by default.** See `frontend/README.md` for API examples.
- No duration/size validation, thumbnail extraction, compression, upload provider, transcoding, HLS, authentication, persistent catalog or full discovery ranking was added. Lightweight stage shells still grow with the entry count; the three-element bound applies to heavy media, not total DOM size or measured heap memory.

Verification on 2026-10-28: four feed-data tests and the desktop/mobile-emulated Chrome suite passed, including a 160-video feed, wheel/trackpad-like bursts, keyboard/phone swipes, rapid forward/back navigation, current/next-only media requests, no adjacent source reset on append, single playback, distant resource release, media/autoplay/cancellation recovery, Save-Data policy, background-tab resume, trading return, pagination retry/coalescing, local multi-file preview, file:// operation and listener teardown. No browser JavaScript exceptions. Physical phones, real trackpad hardware, Safari and production memory/bandwidth budgets were not verified.

### Per-video trading navigation — implemented 2026-10-28

`Desktop Trade button / phone right swipe → openTrading(index) → #trade/<video ID> → renderRoute → blank trading tab`

- Initial stages use `video-1` through `video-3`; appended entries keep their supplied IDs and local extras get unique `local-*` IDs. Trade/right-swipe share `openTrading` in `feed.js`. The tab holds the selected ID and a real Lightweight Charts canvas created by `trading-chart.js`; its candlestick series is intentionally empty. Future candle/history queries must use the selected video's actual token/pool; no mint association or trade execution is implemented.
- Glass-style Trade buttons overlay each video. Buttons remain available on phones as a non-gesture alternative. Phone gestures apply at viewport widths up to 767px; desktop uses buttons.
- `addPhoneSwipe` accepts a one-finger, predominantly horizontal movement of at least 64px within one second. Vertical gestures, short/leftward feed gestures, multiple touches, cancellation, controls and starts within 24px of screen edges do not open a tab. Native vertical panning and pinch zoom remain enabled.
- `renderRoute` pauses videos, keeps the feed mounted, hides it visually and makes feed/navigation inert. Snapshot retains active item, scroll position, playback intent and focus. No media source is replaced during navigation.
- Back button, Escape and browser Back return to the feed; left swipe on the empty tab also returns on phones. Previously playing media resumes, previously paused media stays paused. Browser Forward and direct known hash links are handled; direct links have a local return path. Unknown hashes do not select a trading tab.
- Active-stage updates and asynchronous playback are guarded while trading is open. On return after a viewport-height change, scroll targets the saved video at its new height.
- Verified in headless Chrome at desktop 1440×900 and phone emulation 390×844: all three buttons/routes, blank content, inert background/paused media, return position, Escape, browser history, direct links, horizontal/vertical gesture distinction, current-video routing, local preview/sound and playback restoration. A generated local media fixture was used only for QA. Physical phones and Safari were not tested. No JavaScript exceptions were observed.
- No dependencies, backend services, charts or financial behaviors were added. Temporary QA scripts/profile and screenshots are outside tracked application source.

### Connectivity probe

`rpc:test / dev / start → index.ts → config.ts → helius.getSlot → Helius HTTPS → confirmed slot printed`

This tests connectivity only. Failures set exit code 1; errors omit private URLs and provider response text.

### Transaction observer

`listen → optional configured mint → startLogsListener → Helius logsSubscribe → signature queue → getTransaction over HTTPS → JSON printed / onTransaction callback`

- Legacy raw subscription defaults to `mentions: [mint]` at confirmed commitment. There is no default mint now, so this command exits with guidance until configured. New optional `mentionsAddress` lets market collection subscribe to the verified pool instead; `skipFailedTransactions` skips failed notifications for that path. Existing raw behavior otherwise remains available.
- Acknowledgement timeout is 15 seconds; ping/pong heartbeat runs every 30 seconds. Reconnect uses exponential backoff plus jitter, approximately 1–30 seconds; a stable minute resets backoff.
- Pending/in-flight signatures are deduplicated, with at most 1,000 pending entries. Overflow is reported and dropped. One worker fetches at a time.
- Latest 10,000 successfully processed signatures remain deduplicated across socket reconnects, but not process restarts.
- `getTransaction` requests `jsonParsed`, confirmed commitment and maximum transaction version 1. There are **four attempts total**, 15-second request timeouts and 0.5/1/2-second retry delays. Failed fetches are not marked complete; another notification is needed to enqueue them again.
- Signature/slot/transaction shape is checked. `meta.err` is not filtered: failed on-chain transactions can be printed. No decoder, price calculation, durable checkpoint or business-state confirmation follows.
- SIGINT/SIGTERM stops reconnects, aborts HTTP work and closes the socket. No replay/backfill occurs after disconnection.

### Stage 2.1 — read-only DBC decoding (2026-10-28)

`market:inspect --pool --signature → pool/config/mint/vault snapshot verification → getTransaction → frame-local event/transfer checks → normalized terminal trade`

`market:listen --pool [--seconds] → same pool verification → pool logsSubscribe → failed-notification filter → existing receipt fetch/queue → same decoder`

- Supported: VirtualPool/WSOL, `swap` and exact-input `swap2`, SPL Token or metadata-only Token-2022. Reject transfer fees/hooks, referrals, other quotes/modes/layouts and failed or ambiguous receipts. This is a restricted decoder, not full Meteora coverage.
- Discriminators/account lists/fixed structs come from the pinned MIT SDK IDL. The reader parses full supported account sizes (424-byte pool, 1048-byte config) and rejects trailing/truncated data. One coherent account bundle verifies program owners, relationships, decimals and vault authority. New reads may not regress behind the initial observation slot.
- Invocation stack heights isolate routed CPIs. `EvtSwap2` is required; `EvtSwap3`, when present, must agree. Direct token transfers must match user/vault accounts, mints, authority, raw amounts and decimals. Multiple event versions produce one trade; separate invocations retain distinct signature/path identities. Arbitrary log text and whole-wallet balance deltas are never price evidence.
- Normalized amounts/fees are integer/decimal strings; price also retains an exact rational SOL/token ratio. It is a fee-inclusive user execution price, not a fee-free spot quote. Whole-transaction network fee is separate. No proposed 1.9% / 60:40 product economics is configured or implied.
- Sample buy/sell receipts at slot 462536749 decoded successfully; fresh Helius historical inspection also passed. Snapshot pool was already migrated, and live mode correctly refused it. Sustained active Mainnet collection has not been verified; pool subscription/failure filtering is tested locally.
- Storage/recovery was added in stage 2.2 and restricted DAMM/migration following in stage 2.3 below. Lifetime historical completeness and candle API/chart data delivery remain absent. The frontend chart has an empty candle series.
- See `backend/README.md` for commands and `backend/docs/market-data-dbc.md` for scope, tests and rollback. No dependency was installed; ignored analytics/database remnants were preserved.

### Stage 2.2 — trade storage and missed-data recovery (2026-10-28)

`finalized pool notification / paged signature scan → durable receipt job → finalized receipt → existing DBC decoder → atomic receipt/trades/outcome commit`

- New database: `backend/data/market.sqlite`; native SQLite WAL/FULL synchronization, schema ownership checks and exact trade uniqueness `(network,pool,signature,instruction_path)`. Legacy `qrate.sqlite` is untouched. Raw quantities/rational prices remain strings; replay conflicts fail rather than overwrite records.
- First scan intentionally starts at the latest 100 signatures. Later scans must find the actual saved signature, even within the same slot. Page jobs/cursor commit together; interrupted scans resume. Missing/pruned anchors report a gap without falsely advancing coverage. Checkpoints describe signature discovery, not completed receipt processing; status shows the pending backlog separately.
- Finalized jobs survive restart; failed fetches retry with bounded backoff. Startup, reconnect and periodic scans recover gaps within provider history. A renewable single-collector lease protects each pool; crashed collectors may require up to 90 seconds before takeover. Shared RPC pacing defaults to two request starts/second with 429 cooldown.
- `market:recover` is bounded (20 pages/500 receipt attempts by default); inspect status and rerun for unfinished work. `market:status` is read-only and requires no RPC key. No default database was seeded during development.
- Strict typecheck/build and 35 backend tests passed, including real recorded receipt persistence, duplicate replay, reopen, same-slot pagination, missing anchors, atomic rollback, crash leases and local WebSocket disconnect recovery. No sustained live Mainnet backfill or power-cut test was performed. Same-slot trade display sorting does not establish on-chain transaction order for future candles.
- This is local analytics storage, not a production user/auth database decision. Stage 2.3 adds restricted DAMM/migration continuity below; ordered candles/statistics, market API and frontend data delivery remain next work.

### Stage 2.3 — DAMM v2 and verified migration following (2026-10-28)

`finalized DBC migration receipt → direct DAMM initializer + verified destination snapshot → atomic source outcome/link/creation anchor → destination recovery + live collection → existing exact trade store`

- DAMM supports standard `swap` and exact-input `swap2`, token A as base/token B as WSOL, fee modes 0/1, SPL or metadata-only Token-2022. Referrals, compounding, transfer fees/hooks, other orientations/quotes/modes and unknown optimized instructions are rejected. Authenticated frame-local EvtSwap2 must reconcile with two direct checked transfers. Known non-swaps are ignored, not converted into trades.
- Official SDK 1.5.1 / IDL 0.2.5 is pinned at `b66412daefab1edfddbc98f9655ddd2733fe021d`, with MIT notice/provenance in `backend/vendor/meteora`. Only schema data is reused; no npm installation or quote/curve implementation.
- CLI adds `--protocol damm-v2`; DBC remains default. Successful migration proofs register a separate DAMM partition in SQLite and anchor it to the actual migration signature. Schema 2 adds `migrations` transactionally to schema 1; status is read-only and instructs old-schema users to run writable recovery first. Older code refuses the newer schema.
- Live mode keeps source recovery running and starts a destination collector sharing paced RPC. One-shot mode processes both pools with per-pool bounds. Restart re-verifies/follows saved links. If migration predates DBC bootstrap, `--migration-signature` supplies explicit evidence; otherwise graduated sources report missing evidence. Destination bootstrap is extended to migration only when no active standalone collector owns it. Both pool histories/leases remain separate.
- Verification: 53 backend tests and strict types/build passed, including real routed DAMM buy/direct sell/migration, transfer/event failures, link/anchor rollback, schema upgrade, restart, >100-signature recovery and dual live subscriptions/cancellation. Fresh finalized Mainnet DAMM inspection passed. No default database seeding, full Mainnet backfill or sustained real-time graduation test was performed.
- Next: verify transaction ordering, build exact candles/statistics, then API/chart delivery. No wallet trading or launch behavior was added.

## Ignored analytics remnants — preserve, do not count as completed source

`backend/dist/` includes **21 modules whose TypeScript source is absent**, identified through source maps. Maps contain no embedded source:

- `api`, `server`, `candles`, `swaps`, `trades`, `repair-order`, `transaction-order`, `rpc-scheduler`, `signature-queue`, `token-lookup`, `token-supply`, `sol-usd`, `watch-service`.
- `decoders/{amounts,index,pool-rpc,pumpswap,types}` plus `pumpswap-schema.json`.
- `storage/{migrations,signature-queue,swap-store}`.

Their code describes a local HTTP API/watch service, PumpSwap decoding, SQLite storage/durable jobs, block ordering and candles. Artifact routes include `/api/watch`, `/api/watch/start`, `/api/watch/stop`, `/api/tokens/lookup`, `/api/candles` and static chart assets. **These are artifact routes, not supported current application entry points.** Referenced `frontend/markets.html`, `markets.css`, `markets.js` and `market-chart-utils.mjs` are absent.

Artifact integrations include DexScreener discovery, Coinbase Exchange SOL/USD quotes, native `node:sqlite`, `bs58` and Lightweight Charts. Decoder registry lists PumpSwap only; recognizing a Meteora pool label is not Meteora decoding.

Read-only inspection of `backend/data/qrate.sqlite` found:

| Table | Rows at audit | Meaning suggested by schema |
|---|---:|---|
| `swaps` | 1,507 | Saved swap payloads; all have protocol `pumpswap`. |
| `transaction_order` | 1,507 | Stored slot/block/index ordering evidence. |
| `rpc_jobs` | 19,030 | Signature work items; count does not establish pending/completed status. |

WAL/SHM files exist. Rows were not independently verified against Solana; counts do not prove decoding correctness or complete history. No migration/write command was run on this data.

TypeScript build does not clean `dist`, leaving old modules beside current output. Importing `dist/api.js` **fails**: current `tracked-tokens.js` lacks the `supportsSwapDecoding` export expected by the artifact. Do not delete artifacts/data or automatically restore them into application source; reconcile provenance and roadmap fit before reuse.

## Feature navigation

| Feature | Source / status |
|---|---|
| Feed/player | `frontend/index.html`, `feed.js`, `feed-data.js`: scrolling/resource lifecycle, dynamic entries and per-video trading navigation implemented and Chrome-tested. No backend feed/discovery ranking/catalog or creator navigation. |
| Market transport | Existing listener/RPC plus explicit verified-pool collection in `market.ts`; locally tested, not a durable/full indexer. |
| Decoders/charts/history | Restricted DBC/DAMM decoders, verified migration following and local SQLite trades/recovery. Frontend chart remains empty; ordered candles/statistics/data delivery pending. Old analytics remain incompatible artifacts. |
| Launching | No DBC configuration, metadata, video association, signing or confirmed/idempotent launch state. |
| Trading/wallets | Per-video chart tab with an empty candle series; no wallet connection, quotes, swaps, slippage, live price data or confirmations. |
| Upload/drafts/streaming | Local HTML preview only; no provider, persistent storage or processing. |
| Users/social/profiles | No auth, schema/policies, social actions, profiles or verification. |
| Portfolio/creator economics | No holdings/PnL, dashboards, fee accounting/configuration or claims. |
| Moderation/reliability | Local durable market recovery and observer safeguards; no content/report/removal tools, production monitoring or CI. |

## Commands and verification — 2026-10-27

Run backend scripts in `backend/`. Use **`npm.cmd`** on this Windows environment: current PowerShell policy blocks `npm.ps1`.

| Command / check | Result and scope |
|---|---|
| `npm.cmd run typecheck` | Passed strict source checks without emitting output. |
| `npm.cmd test` | Build passed; default test runner could not spawn a child process (`EPERM`), before tests ran. |
| `node --test --test-isolation=none test/listener.test.mjs` | **2/2 passed**, using freshly compiled modules and local fixtures. Subscription parameters, null retry, malformed JSON, duplicate suppression across reconnect, stop/no reconnect and pre-aborted fetch covered. |
| Frontend inline script parsed with `node:vm` | Syntax passed; no proof of browser playback/gestures. |
| `npm.cmd ls --depth=0 --prefix backend` | Declared dependencies present; four extraneous packages above. |
| `git check-ignore backend/.env backend/data/qrate.sqlite backend/dist/index.js` | All three ignored. |
| SQLite opened with `readOnly: true` | Schema and aggregate counts inspected only. |
| Import `backend/dist/api.js` | Failed missing-export check above; no server started. |

`npm.cmd run listen` starts the observer; `npm.cmd run rpc:test` makes a live read; `npm.cmd run build` compiles source; `npm.cmd run listen:built` runs the compiled observer. Live provider commands were **not** run. Open `frontend/index.html` for the independent browser preview. No production deployment was verified.

## Documentation discrepancies

- Prior map/progress said the repository was uninspected; these two files now contain audit evidence.
- `architecture.md` is provisional: Supabase, Railway, wallets, video providers and charts remain proposed. SQLite remnants do not approve a production/user-database replacement.
- Product scope specifies Meteora and excludes PumpSwap. Stage 2 removed the legacy PumpSwap default; ignored PumpSwap artifacts/data are retained as historical local remnants, not product dependencies.
- Original audit did not reverify historical Helius mint/owner claims. Stage 2 now includes fresh DBC owner/mint/vault verification and recorded evidence; no Qrate token launch is implied.
- README retry wording now matches four total attempts. Its future database/API responsibilities still must not be read as implemented services.
- `known-issues.md` was refreshed for the verified stage-2 limitations; product open decisions remain unresolved.
- The 60-second limit, discovery tabs and removed-video UX remain approved requirements without implementation. Trading navigation was implemented on 2026-10-28, with tab contents deliberately empty. Publishing sequence, provider/auth choices and economic assumptions remain TBD.

## Next development entry point

**User override, 2026-10-28:** move to stage 2; stage-1 creator-profile navigation and physical-device/Safari verification remain deferred. Restricted DBC/DAMM decoding, verified migration following and durable recovery are implemented and locally tested. Next: verified transaction ordering and candles/statistics, then API/chart delivery. Preserve ignored analytics remnants and keep the frontend independent until real candle data is available.
