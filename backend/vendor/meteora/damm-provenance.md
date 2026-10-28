# DAMM v2 IDL provenance

`src/meteora/damm-schema.ts` contains data extracted from the official MIT SDK, not copied swap/quote implementation code.

- Repository: [MeteoraAg/damm-v2-sdk](https://github.com/MeteoraAg/damm-v2-sdk).
- Commit: `b66412daefab1edfddbc98f9655ddd2733fe021d`.
- Package: `@meteora-ag/cp-amm-sdk` **1.5.1**; IDL **0.2.5**, `src/idl/cp_amm.json`.
- Included: program address; Pool discriminator/layout dependencies; EvtSwap2 layout/discriminator; SwapParameters/SwapParameters2; instruction discriminators/account names. Non-swap discriminators identify known non-trading activity without fabricating trades.
- License: complete upstream MIT notice in `DAMM-SDK-LICENSE`. On-chain program source has a separate license and was consulted for semantics only, not copied.
- DBC migration discriminator/account names come from the already pinned DBC SDK `3a965ec0c0a527c2be3c48b8b479366705bf4926`, IDL 0.2.2; its existing license/provenance remains applicable.
- Program semantics checked against `MeteoraAg/damm-v2` commit `5398b5c7c534de014091132da37c6478cce671a8`, particularly `instructions/swap/{ix_swap,swap_exact_in}.rs` and the official event/instruction docs. No curve or fee quote algorithm is implemented.

Pool/event authorities are public deployed addresses, corroborated by the official SDK/program and recorded receipts. Unknown layouts and unsupported features fail closed. SDK updates require explicit schema review and fixture verification; this is not a dependency on unpinned `main` at runtime.
