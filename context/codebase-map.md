# Qrate — Codebase Navigation Map

> Audited **2026-10-27** against the current working tree, all application source/tests, manifests/lockfile, README, and local generated/data artifacts. Proposed services and ignored remnants are distinguished from reproducible source. Deployments and live provider behavior were not verified.

## Current architecture

Qrate has two independent programs: a static browser video-preview prototype and a read-only Node.js Solana transaction observer. **There is no source-backed application API or connection between them.** The observer prints transactions, not verified trades or prices. Current source does not sign or submit transactions.

Ignored local files also contain an older analytics build and populated SQLite database, but their corresponding source is absent. They cannot be counted as a working, reproducible application.

## Repository layout and entry points

| Path | Responsibility / first symbols to inspect |
|---|---|
| `frontend/index.html` | Entire frontend: HTML, inline CSS and JavaScript; three player slots and local file picker. No framework, bundler, package manifest or routes. |
| `frontend/LOGO.png` | Image asset, not referenced by the current HTML. |
| `backend/package.json`, `package-lock.json` | Private ESM Node package, scripts and pinned dependencies. No root package/workspace manifest. |
| `backend/tsconfig.json` | Strict TypeScript, NodeNext modules, ES2024 target; compiles `src/**/*.ts` to `dist/`. |
| `backend/src/index.ts` | One-shot RPC connectivity command; calls `getSlot` and exits. `start`, `dev` and `rpc:test` run this, not an HTTP server. |
| `backend/src/config.ts` | `getHeliusRpcUrl`, `getHeliusWebSocketUrl`; loads backend `.env`, validates `HELIUS_API_KEY`, constructs private Mainnet URLs. Existing environment variables take precedence. |
| `backend/src/helius.ts` | `getSlot`: confirmed JSON-RPC read, 15-second timeout, HTTP/JSON/RPC/result validation and sanitized errors. |
| `backend/src/listen.ts` | Long-running observer command; selects only `trackedTokens[0]`, starts listener and handles SIGINT/SIGTERM. |
| `backend/src/tracked-tokens.ts` | `TrackedToken`, `trackedTokens`: single Mainnet mint, decimals and candidate pool/program/quote addresses. Pool fields are not used by the current listener. |
| `backend/src/logs-listener.ts` | `ListenerOptions`, `startLogsListener`: subscription, heartbeat, reconnect, in-memory queue/deduplication, sequential fetching and console/callback output. |
| `backend/src/transaction-rpc.ts` | `isRecord`, `getTransaction`: confirmed detail reads, retries, signature/response validation and cancellation. Returns generic JSON, not a decoded swap. |
| `backend/test/listener.test.mjs` | Two Node tests with local HTTP/WebSocket fixtures; imports compiled observer/RPC modules. |
| `backend/README.md` | Commands, limitations and future analytics goals. Database/API/chart responsibilities are plans for the current source. |
| `.gitignore`, `backend/.gitignore` | Ignore secrets, dependencies, builds and SQLite files; root also excludes browser verification artifacts. |
| `context/*.md` | Eight product, architecture, standards, workflow, UI, issues, roadmap and map documents; much of their content is intended behavior. |
| `backend/.env`, `.env.example` | Private local configuration exists; contents not inspected or reproduced. Example contains a blank `HELIUS_API_KEY`. |
| `backend/dist/`, `backend/data/`, `backend/node_modules/` | Ignored local generated output, database and installed dependencies; see remnants below. |

No source-backed migrations, API routes, frontend routes, CI workflows, deployment/container configuration, wallet adapters or auth policies were found. No active `AGENTS.md` exists. Git already showed `AGENTS.md` and `AGENTS (1).md` deleted and `context/` untracked before the audit; those changes were preserved.

## Technologies, dependencies and integrations

| Layer | Verified implementation |
|---|---|
| Browser | Plain HTML/CSS/JavaScript, native video, CSS scroll snap, IntersectionObserver, File API/object URLs, Page Visibility API, requestAnimationFrame. No external browser scripts. |
| Runtime | Package declares Node `>=20`; audit runtime Node **24.22.0**, npm **11.19.1**. Full declared runtime range not tested. |
| Runtime dependencies | `dotenv` **18.0.9**, `ws` **8.22.0**. |
| Development dependencies | TypeScript **7.0.2**, `tsx` **4.23.15**, `@types/node` **26.6.5**, `@types/ws` **8.18.2**. |
| Chain access | Direct JSON-RPC via native fetch/WebSockets to Helius Solana Mainnet. No declared Solana or Helius SDK. |
| Testing | Built-in `node:test`, `node:assert/strict`, local HTTP/WebSocket servers. |
| Planned only | Meteora DBC/DAMM v2 SDKs, Supabase/Postgres/Auth, Railway hosting, wallet connectors/Privy, managed video and production charts. No deployment/account setup verified. |

Manifest and lockfile root agree; installed declared versions match. `npm.cmd ls --depth=0 --prefix backend` additionally reports **extraneous** `bs58@6.0.0`, `base-x@5.0.1`, `lightweight-charts@5.2.1` and `fancy-canvas@2.1.0`. These are local remnants, not declared reproducible application dependencies. No dependencies were installed, removed or upgraded. Package license is `UNLICENSED`; dependency advisory/license research was outside this source audit.

## Communication and data flows

### Local video preview

`Add video → native picker → MIME-prefix check → URL.createObjectURL(file) → first video slot → native playback`

- `setActiveIndex` marks the active stage, pauses other players, prepares nearby videos, applies sound state and attempts playback.
- IntersectionObserver selects a stage once at least 60% visible. Keyboard arrows/Page Up/Page Down/Home/End navigate stages; reduced-motion preference controls smooth scrolling.
- Clicking the active video toggles playback; sound buttons remember a page-local preference. Hidden documents pause; returning attempts resume.
- `prepareNearbyVideos` sets metadata preload for the active item and immediate neighbors, and `none` for distant items. Future `data-src` support exists, but no feed data source supplies it. Previously assigned distant sources are not unloaded, so this is not verified segment-level buffer management.
- Replacing a preview and leaving the page revoke the local URL. Selection is not uploaded or saved; three slots start empty.
- CSS defines a 9:16 frame and preserves video aspect ratio. There is no duration/size validation, compression, transcoding, adaptive HLS, draft record or publication action. Autoplay rejection sets a data attribute without a visible retry message.
- Frontend behavior is source-inspected, not interactively browser-tested in this audit.

### Connectivity probe

`rpc:test / dev / start → index.ts → config.ts → helius.getSlot → Helius HTTPS → confirmed slot printed`

This tests connectivity only. Failures set exit code 1; errors omit private URLs and provider response text.

### Transaction observer

`listen → listen.ts → first configured mint → startLogsListener → Helius logsSubscribe → signature queue → getTransaction over HTTPS → JSON printed / onTransaction callback`

- Subscription uses `mentions: [mint]` at confirmed commitment, not the configured pool. Mint mentions cannot capture every trade involving a token.
- Acknowledgement timeout is 15 seconds; ping/pong heartbeat runs every 30 seconds. Reconnect uses exponential backoff plus jitter, approximately 1–30 seconds; a stable minute resets backoff.
- Pending/in-flight signatures are deduplicated, with at most 1,000 pending entries. Overflow is reported and dropped. One worker fetches at a time.
- Latest 10,000 successfully processed signatures remain deduplicated across socket reconnects, but not process restarts.
- `getTransaction` requests `jsonParsed`, confirmed commitment and maximum transaction version 1. There are **four attempts total**, 15-second request timeouts and 0.5/1/2-second retry delays. Failed fetches are not marked complete; another notification is needed to enqueue them again.
- Signature/slot/transaction shape is checked. `meta.err` is not filtered: failed on-chain transactions can be printed. No decoder, price calculation, durable checkpoint or business-state confirmation follows.
- SIGINT/SIGTERM stops reconnects, aborts HTTP work and closes the socket. No replay/backfill occurs after disconnection.

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
| Feed/player | `frontend/index.html`: partial local prototype. No feed API/tabs/catalog, creator navigation, Trade button or swipe-right route. |
| Market transport | `logs-listener.ts`, `transaction-rpc.ts`, `tracked-tokens.ts`: implemented and locally tested, not a full indexer. |
| Decoders/charts/history | No current source; incompatible ignored remnants only. No Meteora decoder. |
| Launching | No DBC configuration, metadata, video association, signing or confirmed/idempotent launch state. |
| Trading/wallets | No wallet connection, quotes, swaps, slippage or confirmations. |
| Upload/drafts/streaming | Local HTML preview only; no provider, persistent storage or processing. |
| Users/social/profiles | No auth, schema/policies, social actions, profiles or verification. |
| Portfolio/creator economics | No holdings/PnL, dashboards, fee accounting/configuration or claims. |
| Moderation/reliability | Observer safeguards only; no content/report/removal tools, production monitoring, durable recovery or CI. |

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
- Product/UI scope specifies Meteora and excludes PumpSwap. Configured sample pool and ignored decoder/data use PumpSwap. Treat this as a read-only experiment, not an implemented product protocol.
- README/comments report previous Helius mint/owner verification. This audit verifies configuration existence, not those historical network checks. Current source does not decode/verify pool mint fields.
- README says four retries; implementation makes four attempts total. Its future analytics responsibilities and package description do not establish implemented APIs/storage.
- `known-issues.md` still says an audit has not occurred. It was left unchanged because this task updates only map/progress; its risk list remains useful but that sentence is stale.
- The 60-second limit, discovery tabs, trading navigation and removed-video UX are approved requirements without implementation. Publishing sequence, provider/auth choices and economic assumptions remain TBD.

## Next development entry point

Continue roadmap stage 2 with a fixture-tested, read-only **Meteora DBC pool-verification/decoder slice**, reusing transport and resolving the PumpSwap sample mismatch. Preserve/inventory local remnants before reuse. Research current official APIs/SDK compatibility and write the required extended spec before implementation. See `progress.md` for acceptance criteria and subsequent stages.
