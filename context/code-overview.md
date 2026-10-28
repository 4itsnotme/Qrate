# Qrate — simple code overview

Updated 2026-10-28. Start here; [codebase-map.md](codebase-map.md) has the detailed audit and [progress.md](progress.md) tracks the roadmap.

## What lives where

| File or folder | What it does |
|---|---|
| `frontend/index.html` | The video feed and trading-page layout/styles. |
| `frontend/feed.js` | Scrolling, active-video playback, nearby loading, local video selection and Trade/back navigation. |
| `frontend/feed-data.js` | Adds video entries without duplicates; has a pagination hook for a future feed source. |
| `frontend/trading-chart.js` | Opens/resizes/closes the real Lightweight Charts canvas for the selected video. It has no candle data yet. |
| `frontend/vendor/` | The pinned chart library and its licenses, available locally without a CDN. |
| `backend/src/config.ts` | Reads the private Helius key on the backend. Never put it in frontend files. |
| `backend/src/market.ts` | Terminal commands to inspect a trade, collect live data, recover missed data or read saved status. |
| `backend/src/logs-listener.ts` | Connects to Solana WebSockets, detects new signatures and reconnects when disconnected. |
| `backend/src/transaction-rpc.ts` | Fetches a complete transaction receipt, with timeout/retry handling. |
| `backend/src/meteora/` | Verifies DBC/DAMM pools and turns supported buy/sell receipts into exact trade records. |
| `backend/src/meteora/damm-pool.ts`, `damm-decode.ts` | Checks the post-graduation DAMM pool and reads its supported trades. |
| `backend/src/meteora/migration.ts` | Proves which DAMM pool a DBC token actually migrated into. |
| `backend/src/market/rpc.ts` | Paces RPC requests and asks for finalized signature pages/receipts. |
| `backend/src/market/recovery.ts` | Finds transactions between the newest history and the saved checkpoint. |
| `backend/src/market/collector.ts` | Takes pending jobs, decodes receipts and commits their trades. |
| `backend/src/market/run.ts` | Runs collection/recovery, follows a verified migration, coordinates retries and stops both collectors safely. |
| `backend/src/storage/market-store.ts` | Owns SQLite tables, duplicate protection, checkpoints, pending jobs and collector locks. |
| `backend/data/market.sqlite` | New local trade database, created when collection is run; ignored by Git. The old `qrate.sqlite` is kept separate. |
| `backend/test/`, `frontend/test/` | Automated checks using local fixtures and temporary databases. |

## How the pieces connect

**Watching:** select local videos → feed controller → browser video player. Trade/right swipe opens that video's chart tab.

**Collecting trades:** finalized pool notifications + recovery scans → saved signature jobs → transaction receipts → Meteora decoder → SQLite trades.

**After a disconnect/restart:** resume pending jobs and saved recovery pages; find the old checkpoint without duplicating trades. A missing checkpoint is reported as a coverage gap.

**After graduation:** verify the migration receipt and new pool → save their link → collect DAMM trades and recover back to the migration signature. The old DBC history stays saved separately.

## Where development is now

Stage 2: restricted DBC/DAMM v2 decoding, local storage, missed-data recovery and verified migration following. Standalone collection starts with the latest 100 signatures; a linked DAMM pool recovers to its migration signature. Missing older migration evidence needs an explicit signature. Candles and the backend-to-chart connection are next. The frontend and collector are still separate programs. Wallet trading, token launches, authentication and profiles are not implemented.
