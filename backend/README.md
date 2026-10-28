# Qrate Analytics Backend

This folder contains Qrate's read-only-chain Node.js/TypeScript observer, restricted Meteora DBC/DAMM v2 decoders, verified migration following, and durable local trade storage/recovery. It does not yet serve a candle API or connect market data to the frontend chart.

**Runtime:** Node **22.13.0 or newer** (tested here with 24.22.0) for built-in SQLite; no new npm dependency is required. The production user/account database is not selected by this local analytics implementation.

Its responsibilities will include:

- Receiving Solana transaction data through Helius RPC and WebSockets.
- Passing transactions through interchangeable protocol decoders.
- Calculating token prices, OHLC candlesticks, and market statistics.
- Storing local development data in SQLite.
- Serving historical data through an API and live updates through WebSockets.
- Supporting many tokens without creating a separate backend for each token.

The first implementation will observe one actively traded Solana mainnet token in read-only mode. Qrate token launches and wallet-authorized trading remain separate, devnet-first workflows.

## Market data — stage 2.1

The legacy PumpSwap default was removed to match Qrate's Meteora scope. `trackedTokens` starts empty. The market commands require an explicit **DBC pool address** and derive/verify its mint, config, vaults, token programs and decimals through Helius before decoding.

From `backend` (use `npm.cmd` if PowerShell blocks `npm.ps1`):

```sh
npm run market:inspect -- --pool <DBC_POOL_ADDRESS> --signature <TRANSACTION_SIGNATURE>
npm run market:listen -- --pool <ACTIVE_DBC_POOL_ADDRESS> --seconds 10
```

Compiled alternatives: `npm run build`, then `node dist/market.js inspect --pool ... --signature ...` or `node dist/market.js listen --pool ... --seconds 10`. Omit `--seconds` for continuous observation; Ctrl+C stops it. No transaction is signed or submitted.

Supported DBC scope: standard VirtualPool/WSOL pairs; `swap` and exact-input `swap2`; SPL Token and Token-2022 with metadata-only extensions. Decoder authenticates frame-local event CPIs, reconciles events with token transfers, and emits one record per invocation even when the program emits several event versions. Unsupported modes, transfer fees/hooks, referrals, other quote tokens and failed/malformed receipts are rejected. DAMM v2/migration support is described below.

Output contains exact raw quantities, decimal strings, side, mint/pool, signature/instruction identity, slot/time and an exact rational WSOL/token **execution price**. The price already reflects DBC fees in the user quantities; do not subtract them again. Network fee belongs to the whole transaction, not each swap. This is not a fee-free spot quote or validated Qrate 1.9% / 60:40 fee configuration.

`market:listen` subscribes to **finalized pool mentions** and durably records signature jobs (including failed-chain markers). DBC migration receipts can now link/follow a supported DAMM pool, including an already-graduated source when evidence is available. The raw legacy observer retains its earlier confirmed/in-memory behavior.

## Trade storage and recovery — stage 2.2

From `backend`, replace `YOUR_DBC_POOL` with the actual pool address:

```powershell
npm.cmd run build
node dist/market.js listen --pool YOUR_DBC_POOL --seconds 30
node dist/market.js recover --pool YOUR_DBC_POOL --max-pages 20 --max-jobs 500
node dist/market.js status --pool YOUR_DBC_POOL
```

Equivalent npm commands are `market:listen`, `market:recover`, `market:status` (add `--` before flags). Optional `--db PATH` selects a database. `market:inspect` still reads/prints one receipt without saving it.

- Default database: **`backend/data/market.sqlite`**, created on collection, ignored by Git. The older `qrate.sqlite` is not opened/migrated; an application/schema guard rejects unrelated databases.
- `pools` holds identity, collector lease, coverage boundary and pagination/checkpoint state. `receipts` holds durable signature jobs, retries, raw receipts and failure/rejection outcomes. `trades` stores exact amounts/price fractions with a unique signature/instruction identity.
- A receipt's trades and completion status commit together. Replays are idempotent; changed amounts/prices/outcomes conflict rather than silently overwriting history. Saved console trade output happens only after commit.
- First collection intentionally bootstraps the **latest 100 finalized signatures**, not all-time history. `coverageStart` identifies that initial lower boundary. An initially empty pool has no signature anchor until a non-empty bootstrap page is observed.
- Later scans page newest-to-oldest until the actual saved checkpoint signature is found, including same-slot transactions. Each page and its cursor commit together. An interrupted scan resumes its cursor after restart; newer arrivals are handled on the next pass.
- Recovery runs at startup, after subscription/reconnect, and about every 30 seconds. An absent anchor, crossed checkpoint slot, malformed page or provider failure leaves an explicit gap/error without advancing the checkpoint. Recovery cannot recreate history that the provider no longer serves.
- Checkpoints mean **signatures durably discovered**, not that every receipt decoded. Status exposes pending/done/ignored/rejected/failed counts, retry details, coverage and recent stored trades. Unsupported receipts are retained as rejected; no fabricated prices are inserted.
- Pending fetches survive shutdown/crash and retry with capped backoff (up to five minutes). One pool collector owns a renewable lease; graceful stop releases it, while crash recovery may wait up to 90 seconds. Storage/lease failures stop collection.
- One-shot recovery is bounded (20 pages/500 receipt attempts **per pool** by default, at most DBC plus its one linked DAMM destination). Exit 1 indicates incomplete scans, pending retries, rejected receipts or missing required migration evidence, including destination status; inspect status and rerun as appropriate.
- Signature and detail requests share a conservative two-starts/second budget and honor bounded HTTP 429 cooldowns. Busy pools can accumulate a disk backlog; throughput, retention and provider coverage need production evaluation.
- Saved receipts use finalized reads. This reduces fork ambiguity but does not independently prove RPC completeness/finality. Recent-trade display sorts by slot then stable identifiers; it is not verified intra-slot ordering for OHLC candles.

Tests use temporary databases/local servers and recorded public receipts; no Mainnet backfill or production DB seeding was performed during development. See [storage/recovery specification](docs/market-storage-recovery.md) and [the simple code overview](../context/code-overview.md).

Recorded buy/sell/migration and pool snapshots are in `test/fixtures/`. These are unrelated public observation tokens, not Qrate video tokens. No active live sample is silently selected.

See [the slice specification](docs/market-data-dbc.md) and [schema provenance/license](vendor/meteora/README.md). The official SDK IDL is pinned as data; no new package was installed.

## DAMM v2 and migration — stage 2.3

Direct DAMM inspection/collection uses `--protocol damm-v2`; default protocol remains `dbc`:

```powershell
node dist/market.js inspect --protocol damm-v2 --pool YOUR_DAMM_POOL --signature A_SWAP_SIGNATURE
node dist/market.js recover --protocol damm-v2 --pool YOUR_DAMM_POOL --max-pages 20 --max-jobs 500
node dist/market.js listen --pool YOUR_DBC_POOL --seconds 30
```

- Supports token A / WSOL token B, fee modes 0/1, standard `swap` and exact-input `swap2`, SPL and metadata-only Token-2022. Rejects other orientations/quotes, referrals, compounding, transfer fees/hooks, partial/exact-output and unknown optimized instructions. Exact user execution price includes protocol/LP effects in transferred amounts; `fees.tradingRaw` is DAMM's claiming/LP component, not an additional fee to subtract.
- A successful finalized DBC `migration_damm_v2` instruction must match the source config/mints/vaults and directly invoke a matching DAMM initializer. A fresh finalized destination snapshot verifies owner/layout/mints/vaults. Only then does the source outcome, pool link and destination creation anchor commit atomically. Matching token names/mints alone are insufficient.
- `listen` follows the persisted destination concurrently; `recover` follows it in a bounded second pass. Both share RPC pacing and retain separate pool jobs/leases/history. Source collection remains active so late DBC recovery is not lost. Graceful cancellation stops both collectors.
- A linked destination recovers back to the **migration signature**, even beyond 100 transactions. Standalone DAMM collection still bootstraps the latest 100 until verified migration evidence extends coverage. An active standalone destination collector must stop before this coverage extension.
- If an already-graduated DBC pool's migration is older than its bootstrap page, supply the actual signature with `--migration-signature SIGNATURE` on DBC `listen`/`recover`. The receipt is verified; the address is never guessed. This can retry a migration quarantined by the earlier decoder. Missing evidence is reported as incomplete; unavailable history still reports a gap.
- SQLite schema **2** adds `migrations` transactionally to Qrate market schema 1, preserving trades/jobs. A read-only `status` on schema 1 asks for a writable collection/recovery run to upgrade. No downgrade is automatic; older code refuses schema 2. Unrelated `qrate.sqlite` remains protected.
- Verification: **53 backend tests**, strict types/build and **4 frontend data regressions** pass. Includes real buy/sell/migration, rollback, schema upgrade, target lease conflict, restart following, >100-signature destination recovery and dual live subscriptions. Fresh Mainnet DAMM `inspect` also passed without saving data. Sustained live Mainnet migration/recovery, full lifetime DBC history and provider completeness remain unverified.

See [the stage-2.3 specification](docs/market-data-damm.md) and [pinned DAMM schema/license provenance](vendor/meteora/damm-provenance.md). Candles, transaction ordering, statistics and chart delivery remain next work.

## TypeScript commands

- `npm run dev` starts the entry point with automatic reloads.
- `npm run typecheck` checks strict TypeScript types without creating output.
- `npm run build` compiles source files into `dist`.
- `npm start` runs the compiled backend entry point.

## Helius connection test — beginner notes

Run these commands from the `backend` folder:

```sh
npm run rpc:test
```

This makes one read-only `getSlot` request to Helius Solana Mainnet and prints the
current confirmed slot. A slot is a position in Solana's block-production schedule;
it is not a token price or wallet balance. A failed request exits with code 1.

### Where to look

- `.env`: your private local API key. Already ignored by Git. Never paste it into frontend code.
- `.env.example`: a blank template that is safe to upload to GitHub.
- `src/config.ts`: loads `.env` with `dotenv`, reads `process.env.HELIUS_API_KEY`,
  checks that it exists, and constructs the private Mainnet URL.
- `src/helius.ts`: sends the JSON-RPC request, applies a 15-second timeout, and checks
  HTTP errors, RPC errors, and the returned slot. Error messages never print the key.
- `src/index.ts`: calls those helpers and prints the result.

TypeScript checks the types; Node reads environment variables at runtime. The existing
`types: ["node"]` in `tsconfig.json` provides the types for `process.env`.

To set this up on another computer, copy `.env.example` to `.env`, fill in
`HELIUS_API_KEY=`, then run `npm install`. On a cloud server, set the same variable
in the hosting service's environment settings.

To check and run the compiled version:

```sh
npm run typecheck
npm run build
npm start
```

Check Git's protection with `git check-ignore .env`. It should print `.env`.
Git ignore rules protect untracked files; never force-add `.env`.

## Live transaction listener — beginner notes

This legacy raw observer requires an explicit reference in `src/tracked-tokens.ts`; otherwise it exits with guidance to use `market:listen -- --pool ...`. Once configured, run `npm run listen`. Keep the terminal open; press Ctrl+C to stop.
For compiled JavaScript, run `npm run build` followed by `npm run listen:built`.

- `src/config.ts` loads the same private API key for HTTPS and secure WebSockets.
- `src/listen.ts` is the command's starting point. It takes the first mint from
  `src/tracked-tokens.ts` and connects everything together.
- `src/logs-listener.ts` sends `logsSubscribe` with `mentions: [mint]` at confirmed
  commitment. The subscription ID tells us the server accepted the request.
- Each notification prints its signature (the transaction's public identifier).
  `src/transaction-rpc.ts` then calls `getTransaction` and the terminal prints the
  returned JSON, including instructions, balances, and execution metadata.
- Fetching supports transaction versions up to 1. It makes four attempts total when
  details are not yet available or a request fails, using short increasing delays.
- A queue fetches one transaction at a time. Pending signatures and the last
  10,000 completed signatures prevent duplicates during the current process,
  including across reconnects. Failed fetches are not marked completed.
- Heartbeat ping/pong checks run every 30 seconds. Failed connections reconnect
  with increasing delays and resubscribe automatically. Ctrl+C cancels network work.

This raw command is terminal observation only: it does not calculate prices, classify swaps,
write a database, or send transactions. Failed on-chain transactions are also
displayed; check `meta.err` in the details before treating anything as successful.

### What this first listener can and cannot capture

`mentions` matches the mint as a transaction account, not every token transfer or
trade involving it. Some transactions reference token accounts without the mint.
WebSockets do not replay notifications missed while offline. Deduplication is in
memory and resets on restart; entries older than the last 10,000 successes can
be processed again. The queue holds at most 1,000 pending signatures and reports
overflow. This is a bounded terminal demo, not a complete historical indexer.
Persistent deduplication and reconnect backfill belong in the later SQLite stage.

### Verification

`npm test` builds TypeScript and runs local transport/decoder tests. If test subprocess isolation is restricted (`spawn EPERM`), run `npm run build` and `node --test --test-isolation=none test/*.test.mjs` instead.

Tests include real recorded DBC buy/sell receipts and account snapshots plus explicitly mutated copies for rejection/CPI scenarios, and local HTTP/WebSocket fixtures for transport behavior. No test submits transactions or sends fabricated activity to the frontend. Type checking is `npm run typecheck`.
