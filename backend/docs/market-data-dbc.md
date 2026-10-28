# Stage 2.1 — read-only Meteora DBC decoding

Status: implemented read-only decoding slice, 2026-10-28. The user explicitly moved development to stage 2; remaining stage-1 profile/device work is deferred, not complete. The full market-data stage is not complete.

This records the stage-2.1 boundary. Durable collection, finalized jobs and restart/disconnect recovery have since been implemented in [stage 2.2](market-storage-recovery.md); the limitations below describe the original decoder slice unless stated otherwise.

1. **Goal:** turn a supported, successful DBC swap receipt into one exact, identifiable buy/sell record suitable for later persistence and candles.
2. **Scope:** standard VirtualPool / wrapped-SOL pairs, `swap` and exact-input `swap2`, SPL Token or Token-2022 with metadata-only extensions. Reject transfer fees/hooks, referral swaps, other quote tokens, unsupported modes/layouts and failed transactions. DAMM v2, persistence/recovery, APIs, charts, token launching and signing are later slices.
3. **Requirements:** verify on-chain pool/config owners, discriminators, immutable mint/vault relationships, decimals and token programs; authenticate per-invocation event CPIs; cross-check exact event amounts against direct SPL transfers. Never infer trades from transaction-wide balance deltas or untrusted log text.
4. **Dependencies:** existing Node/TypeScript, native fetch/Buffer/BigInt, existing `ws` observer. No new npm package. Pin the MIT-licensed official SDK's IDL subset at commit `3a965ec0c0a527c2be3c48b8b479366705bf4926` (SDK 2.0.0 / IDL 0.2.2); retain license and provenance. On-chain Rust is consulted for semantics, not copied or relicensed.
5. **Implementation:** `src/meteora/` schema, byte/address reader, pool verifier/RPC adapter and decoder; `src/market.ts` inspect/listen commands; small optional pool-mentions/failed-notification filters in existing listener. Remove the legacy PumpSwap default and require an explicit DBC pool. Recorded public DBC references are historical fixtures, unrelated to Qrate video tokens; the sampled pool migrated before account capture, so it is not made a live default.
6. **Data flow:** CLI pool → verified account snapshot → existing getTransaction / pool logs subscription → frame-local DBC decoding → normalized console JSON. Output identity includes network, signature, pool and instruction path; overlapping event versions yield one swap per invocation.
7. **Failure handling:** fail closed on unknown layouts, mismatched event/transfer/account evidence, missing stack heights or status; return explicit rejection reasons. Keep existing bounded transport retry/reconnect behavior. Do not call this a complete indexer: offline gaps and process restarts are not repaired by this slice.
8. **Security/authorization:** read-only RPC, no wallet keys/signing/submission. Provider key remains server-side; network failures use sanitized errors. Validate public addresses, signatures, binary lengths and all external JSON before use. Test mutations cannot enter the live feed.
9. **Verification:** recorded real Mainnet buy/sell receipts and pool/account snapshot; compare exact raw quantities with SPL transfer receipts. Test failed/wrong-pool/altered/truncated/duplicate/unsupported/CPI cases and pool subscription parameters. Existing observer tests, strict types and build must pass. Use bounded live reads only; no trading/funds.
10. **Performance:** fixed-size account/event parsing, bounded encoded instruction lengths, one selected pool/worker using existing queue bounds; no global all-token subscription. No production throughput claim.
11. **Costs:** a few account/detail RPC reads and an optional pool subscription under the existing Helius plan. No new vendor or pricing assumption. No new dependencies installed.
12. **Rollback:** current source baseline `eabc231`; revert only scoped new market modules/scripts/listener options/sample config. Preserve local ignored analytics/database remnants and pre-existing context changes. No schema migration/data deletion.
13. **Documentation:** update backend README, this specification's results, `context/codebase-map.md`, `progress.md` and architecture's verified market-data boundary. Leave overall stage 2 incomplete until storage, recovery, DAMM v2 and chart pipeline exist.

## References

- [Pinned official SDK IDL](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/blob/3a965ec0c0a527c2be3c48b8b479366705bf4926/packages/dynamic-bonding-curve/src/idl/dynamic-bonding-curve/idl.json)
- [DBC events](https://docs.meteora.ag/developer-guides/dbc/program/events), [accounts](https://docs.meteora.ag/developer-guides/dbc/program/accounts)
- [Pinned program swap semantics](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/91e696eef6a3764157220f6c104f079b7830fc04/programs/dynamic-bonding-curve/src/instructions/swap/ix_swap.rs)
- [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction), [logsSubscribe](https://solana.com/docs/rpc/websocket/logssubscribe)

The full SDK is the natural option for future transaction construction/quotes. For this restricted read-only slice, a pinned IDL reader avoids installing Anchor/web3.js and avoids their current TypeScript peer-version mismatch with this repository. No swap curve or quote math is reimplemented.

## Observed results

Recorded Mainnet buy and sell at slot 462536749 each decode to one trade matching the two direct token transfers. A fresh read through `node dist/market.js inspect --pool 9XRiEB6gCFeCFpozxttJLtU3Qt2oAgsGgez9vAJXMT9v --signature 31tN2eYRWA1H2PD3AMymW1CoE4GgdrriYboNEriZk5rLdg2FdRcUUr15qverF8rCFhcqMJRKhuNGkPHqQfHK3rMj` also succeeded. The same pool's live command correctly exits 1 because it is migrated. The test suite verifies pool subscription/failed-notification filtering locally; sustained collection against a currently active Mainnet pool is not yet verified.

Automated rejection/transport cases include account owners/relationships/decimals/extensions/layouts, stale account bundles, altered quantities, conflicting/duplicate/missing event CPIs, failed receipts, CPI scopes, replay identity, unsupported modes/referrals and secret-free errors. The byte reader accepts only the pinned fixed structs. Future SDK/program upgrades require explicit review and fixture coverage.

Final checks: `npm.cmd run typecheck` and `npm.cmd run build` passed; `node --test --test-isolation=none test/*.test.mjs` passed **17/17** backend tests. Frontend data regressions passed **4/4**. No application database or dependency installation was involved.
