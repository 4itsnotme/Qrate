# Pinned Meteora schema data

`src/meteora/dbc-schema.ts` is a data-only subset of the official SDK IDL, not the SDK implementation or on-chain program source.

- Repository: https://github.com/MeteoraAg/dynamic-bonding-curve-sdk
- Commit: `3a965ec0c0a527c2be3c48b8b479366705bf4926`
- SDK package version: `2.0.0`; IDL metadata version: `0.2.2`.
- Path: `packages/dynamic-bonding-curve/src/idl/dynamic-bonding-curve/idl.json`
- License: MIT, reproduced in `LICENSE` in this directory. The SDK's MIT license does not license its separately published on-chain program.
- Included: `VirtualPool`, `PoolConfig` and their fixed nested structs; `swap`/`swap2` account lists/discriminators; `EvtSwap2`/`EvtSwap3` payloads. Documentation and unrelated IDL types were omitted; field order/types/discriminators were preserved.

Qrate's restricted reader fails on unknown account/event lengths and economic token extensions. No SDK dependencies were installed. Upgrading this schema requires reviewing layouts, event semantics, license and compatibility, then rerunning recorded-receipt and rejection tests.
