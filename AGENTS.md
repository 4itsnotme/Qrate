# Qrate.fun — Coding Agent Project Documentation

> Project: **Qrate.fun** (formerly Curate)  
> Document: `AGENTS.md` — project context, implementation rules, and development direction  
> Status: Product specification for an MVP; several tokenomics and protocol parameters are **proposals pending verification**, not production commitments.

## 1. What Is Qrate?

**Qrate.fun is a short-form video social platform with native Solana token trading.** Imagine the discovery and entertainment experience of TikTok combined with the real-time token markets and trading interface associated with Solana memecoin platforms.

Users scroll a feed of videos, discover creators, follow accounts, like, comment, share, and upload videos. Alongside the social experience, eligible videos can have associated Solana tokens which users can buy and sell from within Qrate through their own connected wallets.

**Qrate is both a social network and a trading product. Neither is merely a feature bolted onto the other.** A person who never connects a crypto wallet should still be able to enjoy the social experience. A trader should be able to discover tokens through videos and evaluate market information without leaving the application.

### Mission
Build a platform where internet culture, creators, and markets meet: discover a video, understand its creator and community, and optionally trade the token connected to it.

### One-line pitch
**Watch the culture. Discover the tokens. Trade the moment.**

### Product boundaries
- A video is **content**, not a financial asset by itself.
- A token associated with a video is an **independent on-chain asset** with real financial risk; ownership does not grant ownership of the video or rights to its revenue or copyright unless separately and explicitly established.
- Likes, views, and shares are **social signals**, not guaranteed token-price inputs.
- Qrate must not imply that video popularity guarantees investment profit.

## 2. Who Uses Qrate?

1. **Viewer** — browses videos, searches, follows creators, likes, comments, and shares. Does not need a wallet for basic discovery.
2. **Creator** — creates a profile, uploads videos, builds an audience, and may participate in eligible token launches or permitted creator-fee programs.
3. **Trader** — discovers video-associated tokens, checks price charts and liquidity, connects a Solana wallet, buys or sells, and monitors owned positions.
4. **Moderator / Admin** — manages abuse reports, copyright claims, spam, impersonation, illegal material, and suspicious activity.

A user may occupy multiple roles. Do not create unnecessary role silos in the UI.

## 3. The Experience

### A. Discover and watch
- A mobile-first, full-screen, vertical, swipeable short-video feed.
- Autoplay the active video; pause videos that are off-screen.
- Show creator identity, caption, follow action, and social engagement controls.
- If a token exists, display a compact token chip with price/market information and an obvious route to the trading detail view.
- Social controls should remain prominent even when the video has a token.
- Support browsing without connecting a wallet.

### B. Create and publish
- Creator signs in, builds a profile, and uploads an original or licensed video.
- Video is uploaded to managed video infrastructure, processed, and assigned a playback URL / identifier.
- Video metadata and publication status are stored off-chain.
- The video can be published and discovered independently of whether a token is created.
- **Token association / launch is a separate explicit workflow until product policy is finalized.** Never automatically spend funds or mint an asset without clear user consent.

### C. Discover and trade a token
- Trader opens a video or its token detail page.
- Show token name, ticker, mint address, creator or issuer attribution (if verified), token supply, price, trading volume, liquidity, risk indicators, and charts where data exists.
- Trader connects a wallet such as Phantom through a supported Solana wallet interface.
- Trader requests a buy/sell quote; UI presents amount, expected tokens or SOL, network fees, protocol fees, price impact, minimum output, and slippage.
- Trader explicitly approves a wallet-signed transaction.
- Show clear states: awaiting signature, submitted, confirmed, failed, or expired.
- Confirm against on-chain transaction results before showing a trade as completed.

### D. Creator profile / token page
- Profile contains creator bio, videos, follower and engagement data, and linked tokens where relevant.
- A token detail page combines the associated video with market data, trading interface, transactions, and links to a trustworthy block explorer.
- Keep social identity and token-issuer identity distinct unless verified.

## 4. MVP Scope

**Core social MVP**
- Authentication and profile setup.
- Vertical video feed and video playback.
- Upload, processing status, thumbnails, publish/unpublish.
- Like, comment, follow, share, report.
- Creator pages and video detail views.
- Basic ranking: recent, engagement, and later personalized discovery.

**Core trading MVP**
- Solana wallet connect/disconnect.
- Distinct video-to-token association records.
- Token launch integration on Solana **devnet or isolated test environment first**, with supported on-chain liquidity mechanics.
- Buy/sell quotes and wallet-signed swaps.
- Live or near-live price, liquidity, and recent trades.
- Token chart and transaction status.
- Fee transparency, trade warnings, and operational monitoring.

**Operations MVP**
- Admin moderation panel with remove/unpublish and appeal records.
- Rate limits, spam controls, file validation, and upload authorization.
- Error tracking, logging, analytics, and alerts for trading/indexer failures.
- Clear Terms, privacy policy, trading disclosures, and a jurisdiction-specific compliance review before enabling real-money launch.

**Not automatically in v1:** livestreaming, direct messages, complex recommendation ML, fiat custody, leveraged trading, custodial wallet accounts, perpetual futures, or automatic rewards for views.

## 5. Proposed Technical Architecture

These are the previously discussed service choices. Treat them as preferred starting points, not immutable decisions.

| Layer | Preferred service / technology | Responsibility |
| --- | --- | --- |
| Frontend / web app | Next.js + TypeScript | Feed, upload UI, social screens, trading screens |
| Deployment | Vercel | Host the web frontend and API routes where appropriate |
| Database + auth | Supabase (Postgres/Auth/Realtime) | Accounts, profiles, videos, social graph, token references, cached market views |
| Video | Bunny Stream | Direct video uploads, transcoding, storage and playback |
| Chain | Solana | Token issuance, wallet-authorized swaps, on-chain settlement |
| Token launch/liquidity | Meteora Dynamic Bonding Curve (DBC) | Proposed initial token market / bonding-curve mechanism |
| After graduation | Meteora DAMM v2 | Proposed post-curve pool migration, subject to SDK/protocol confirmation |
| Chain data | Helius | Transaction/event indexing, webhooks, RPC as appropriate |
| Charts | TradingView charting library or compatible chart UI | Historical market data visualization; respect license / data-feed requirements |
| Background processing | Hetzner worker or equivalent | Event processing, reconciliation, market snapshots, retry queues |
| DNS / edge protection | Cloudflare | DNS, caching, WAF/rate limiting as applicable |
| Source control | GitHub | Repository, reviews, CI/CD and issue tracking |

### Key boundaries
- **Video bytes** live on video infrastructure, not on-chain and not as database blobs.
- **Profiles, comments, follows, feed ranking, and metadata** live in Postgres.
- **Token state, wallet balances, swaps, pool creation, and fee settlement** are verified from Solana and the actual protocol contracts/programs.
- **Cached prices and volume** are derived market data, not authoritative settlement state.
- **The user's wallet** signs transactions; Qrate never requests wallet seed phrases or private keys.

### High-level flow

```text
Creator uploads video
  -> authorized direct upload to video provider
  -> video transcode/processing webhook
  -> Supabase video metadata -> public video feed
                                 |
                                 +-> optional, explicit token launch
                                       -> Solana token mint + metadata
                                       -> Meteora DBC pool (if supported)
                                       -> confirmed on-chain mint/pool addresses
                                       -> token associated with video

Viewer / trader opens feed or token detail
  -> social data from Supabase
  -> price/market data from indexed Solana activity
  -> optional wallet connection
  -> trade quote and user review
  -> user wallet signs transaction
  -> Solana confirmation
  -> Helius/indexer worker reconciles and updates cached UI data
  -> possible protocol-defined pool graduation -> DAMM v2
```

## 6. Tokenomics: Working Assumptions, NOT Final Specifications

Earlier planning considered:
- Fixed supply per video token: **1,000,000,000 units**.
- Initial quote pair: **token / SOL**.
- Price discovery and initial trading through **Meteora DBC**.
- A possible pool-graduation target of roughly **85 SOL**, to be checked against current Meteora configuration options.
- Candidate default swap slippage: **1%**, adjustable, with warning for high impact.
- A **2.5% fee target** with a proposed **50% Qrate / 30% creator / 20% Meteora** allocation. This is an exploratory business model, **not** a verified protocol fee schedule or a guaranteed implementable split.

**Agent rule:** Do not hard-code any of those figures into production logic until they are independently verified against the protocol's current SDK and program constraints, the desired economic model, and legal obligations. Put controllable settings in typed configuration and document the exact fee denominator and recipient wallets. Never falsely claim creators receive a particular share before the actual on-chain distribution mechanism exists.

A token mint alone does not make a token tradable. Trading requires a real supported pool/liquidity mechanism; display an honest `not_tradable` state otherwise.

## 7. Suggested Data Model

Create schema and migrations around these conceptual entities:

- `profiles`: `id`, `handle`, `display_name`, `bio`, `avatar_url`, `created_at`, account flags.
- `videos`: `id`, `owner_id`, `caption`, `provider_video_id`, `thumbnail_url`, `status`, `duration`, `created_at`, `published_at`.
- `likes`: `user_id`, `video_id`, `created_at`; enforce unique user/video pair.
- `comments`: `id`, `video_id`, `author_id`, `parent_id`, `body`, `status`, `created_at`.
- `follows`: `follower_id`, `followed_id`, `created_at`; enforce unique pair and disallow self-follow.
- `tokens`: `id`, `video_id`, `mint_address`, `network`, `symbol`, `name`, `supply`, `launch_status`, `created_at`.
- `pools`: `token_id`, `program_id`, `pool_address`, `phase`, `quote_mint`, `status`, `graduated_at`.
- `market_snapshots`: `token_id`, `price_quote`, `liquidity_quote`, `volume_24h`, `as_of`, `source`.
- `trade_events`: `signature`, `token_id`, `wallet_address`, `side`, `quantity_in`, `quantity_out`, `slot`, `confirmation_status`.
- `reports`: `reporter_id`, `entity_type`, `entity_id`, `reason`, `status`, `created_at`.
- `audit_logs`: privileged changes, chain reconciliation, launch steps, and moderation actions.

Use database constraints, RLS, indexes, idempotency keys, and explicit on-chain network identifiers. Avoid storing user secret keys. Treat counts and market aggregates as derived/cached data.

## 8. Coding Agent Operating Rules

1. **Preserve dual-purpose UX.** Do not convert Qrate into a charts-only trading terminal or a video-only app.
2. **Build mobile-first.** The vertical feed is the central interface; desktop layouts should adapt gracefully.
3. **Write typed, maintainable code.** Use TypeScript strict mode, modular features, shared schemas, and lint/format/test tooling.
4. **Separate UI, domain logic, integrations, and persistence.** Avoid protocol SDK calls directly inside UI components.
5. **Use adapters.** Wrap Solana RPC, wallet, Meteora, Bunny, Helius and Supabase behind small interfaces to avoid vendor lock-in.
6. **Model asynchronous states explicitly.** Video processing and blockchain confirmation are not instant; show truthful pending/failed/retry states.
7. **Never fake markets or social metrics.** Mocked dev/demo data must be visually marked, and production must not show invented liquidity, views or prices.
8. **Verify on-chain actions.** Use correct cluster, program IDs, token mint addresses and transaction confirmations. Reconcile webhook/indexer events because they can be duplicated, delayed or out of order.
9. **Do not create hidden wallet actions.** All trading requires explicit user authorization; show amounts, fees and risks before signing.
10. **Security is a release requirement.** Validate uploads, verify webhooks, enforce authorization/RLS, apply rate limiting, protect secrets, sanitize user content, audit dependencies, and add abuse detection.
11. **Moderate responsibly.** Build copyright, impersonation, spam and safety reporting. Provide a way to remove or hide content without misrepresenting immutable blockchain records.
12. **Respect financial risk and regulation.** Don't promise returns or manufacture urgency. Require relevant legal/compliance review before real-money deployment.
13. **Prefer small verified increments.** Implement one working user flow end-to-end before scaling architecture.
14. **Do not silently invent product rules.** When a rule is undecided, implement safe configurable behavior and mark it `TODO: product decision`.
15. **Keep documentation current.** Update this file when product decisions, providers, contracts or architecture change.
16. **Explain code with navigation comments.** Add concise comments describing the purpose of each logical code section so the owner can navigate it easily. Follow this convention for all new and modified code.

## 9. Development Roadmap

### Phase 0 — Foundation
- Initialize Next.js/TypeScript app, Supabase project, environment variable validation, CI and error monitoring.
- Establish the design system, navigation and database migrations.
- Add devnet/testnet gating so test transactions cannot be mistaken for mainnet activity.

### Phase 1 — Working social platform
- Auth, profiles, vertical feed and Bunny upload/processing.
- Likes, comments, follows, shares and reporting.
- Moderator controls, upload abuse limits and responsive performance.
- **Exit criterion:** a user can publish an actual video and another user can discover and engage with it.

### Phase 2 — Wallet and read-only token data
- Wallet connection and network-aware token detail pages.
- Backend chain indexer + market cache; render price/volume history using real observed data.
- **Exit criterion:** associated tokens can be viewed accurately without executing a trade.

### Phase 3 — Devnet token launch and trading
- Integrate verified current Meteora/Solana SDKs.
- Explicit token creation and pool initialization flow.
- Wallet-signed buy/sell, transaction receipts, rejection/error states.
- **Exit criterion:** two test wallets can launch, buy and sell through a functioning test market with correct balances and records.

### Phase 4 — Reconciliation and market lifecycle
- Backfill indexer, update charts, handle RPC failures and chain reorganizations as relevant.
- Implement and test actual supported pool graduation/migration behavior.
- Verify fees and creator allocations from on-chain evidence.

### Phase 5 — Mainnet readiness
- Independent security review, abuse/market-integrity protections, legal analysis, monitoring and incident plan.
- Conduct limited rollout and load tests; remove all demo-only UI labels and devnet-only addresses.
- Only enable real-money trading after the required gates pass.

## 10. UI and Brand Direction

- Product name/domain: **Qrate.fun**, not Curate or Qurate.
- Brand mood: modern, minimal, playful but polished; dark/white/gray are the base palette.
- Q logo language: a recognizable **Q / magnifying-glass** motif associated with discovery.
- Possible restrained **liquid-glass** treatments; accent color on the **“fun”** part of wordmark, not the entire name.
- TikTok-like immersive video discovery is a UX reference, not a request to duplicate proprietary artwork or design wholesale.
- Trading elements should be clear and information-dense without covering the video or dominating the social experience.
- Support dark mode; keep controls readable and accessible.

## 11. Acceptance Criteria and Definition of Done

A feature is done only when:
- User-facing happy path works on mobile and desktop.
- Loading, no-data, error, retry and permission-denied states are covered.
- Real database queries and permissions are integrated; no production-critical fake values.
- Sensitive operations use server-verified authorization and correct wallet signatures.
- Chain and video processing operations are idempotent and observable.
- Appropriate unit/integration/end-to-end tests are included.
- Documentation and environment variable examples are updated.
- For token functionality: actual Solana addresses, receipts, network, market data provenance, and fee logic have been checked.

## 12. Decisions Still Open

Do **not** presume these have been finalized:
- Whether every creator can launch a video token, and launch eligibility/abuse restrictions.
- Who pays token creation, pool rent, and initial liquidity costs.
- How to attribute token ownership or verify creator identity and permissions.
- Final token supply, decimals, ticker policy, quote token, curve configuration, and graduation thresholds.
- Actual protocol fees, creator payouts, Qrate fee entitlement, and post-graduation fee distribution.
- Whether wallet identity is linked to login identity and how anonymous viewing works.
- Discovery ranking formula and any safeguards against bot-engagement/token manipulation.
- Supported regions, age restrictions, identity checks if needed, and trading/compliance launch policy.

**When coding from this document, prioritize the smallest production-grade vertical slice, call out unknown assumptions, and never treat a proposed number as verified on-chain behavior.**
