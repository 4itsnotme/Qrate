# Qrate — Code Standards and Invariants

> Apply to all agents and contributors. Validate exact language/framework conventions against the inspected repository; this document is not a license to replace its architecture.

## Non-negotiable product and funds rules

1. Never take custody of user trading funds or private keys.
2. Never deploy Qrate-controlled signing/transfer authority that can unilaterally redirect user assets.
3. All trading and token ownership settle on-chain through configured Meteora protocols.
4. Never fabricate confirmed trades, balances, market cap, candles or token launches.
5. Never identify a video as tokenized until launch has been confirmed on-chain.
6. Never assume a deleted video can delete its token; preserve chain history and communicate the distinction.
7. Treat the publication/token sequence as **TBD**, not a fixed implementation rule.
8. Keep user data isolated through authenticated authorization checks; never trust client input for privileged operations.

## Engineering consistency

- Inspect existing code, conventions and dependencies first. Prefer reusing modules to reimplementing them.
- Make small, scoped changes; avoid modifying unrelated files, renaming wide APIs, or broad refactors without approval.
- Keep boundaries between UI, domain business logic, provider adapters, indexing/aggregation and storage.
- Use clear names and typed interfaces where supported by the existing stack. Validate all untrusted input at boundaries.
- Handle timeouts, retries, stale reads, rate limiting, partial completion, idempotency and cancellations explicitly.
- Never log secrets, seed phrases, session tokens, sensitive user data or raw privileged credentials.
- Never add a package unless it has a demonstrated purpose, acceptable license, supported version and no simpler existing equivalent.
- Maintain lockfiles, pin versions reproducibly and evaluate security advisories.
- Add tests aligned to each feature's acceptance criteria and failure modes; use fixtures/mocks for external outages.
- Explain changes with file paths, system flow, testing instructions and unresolved limitations.

## On-chain-specific practices

- Confirm transaction outcomes by signature and chain state; RPC send success is not transaction success.
- Prevent duplicate launches and unsafe duplicate swap submissions after ambiguous timeouts.
- Distinguish token price from view count and market value from realizable liquidation proceeds.
- Reconcile Helius/WebSocket gaps with idempotent on-chain backfills. Track migrations between Meteora pool types.
- Keep API keys and wallet authority separated by security boundary; never place privileged secrets in client code.
- Test devnet/controlled setups before mainnet; never test experimental financial operations against real user funds.

## Video-specific practices

- Prefer adaptive playback and measured prefetching over fetching full videos in advance.
- Preserve original aspect ratio; never stretch horizontal/square inputs to a 9:16 frame.
- Treat upload validation, media processing, moderation, token launch and publication as separate states.
- Ensure draft access is private; authorize upload, deletion, visibility and metadata changes.
- Use measured data to optimize cloud storage/streaming cost, quality and startup performance.

## Change completion criteria

- Relevant checks pass and have been actually run (tests/build/types/security/performance as appropriate).
- Important failures and untested paths are documented honestly.
- Relevant context docs are updated (`architecture`, `codebase-map`, `progress`, `known-issues`, etc.).
- A reviewed, coherent Git commit is created for verified work when appropriate.
