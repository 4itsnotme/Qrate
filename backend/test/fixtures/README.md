# DBC recorded receipts

Captured on 2026-10-28 through read-only Helius Solana Mainnet RPC. No API key, endpoint URL, wallet secret or off-chain customer data is included. Public wallet addresses and transaction receipts are intentionally preserved for independent verification. These tokens are observation references, not Qrate-launched video tokens.

| Fixture | Public chain evidence |
|---|---|
| `dbc-buy.json` | Signature `31tN2eYRWA1H2PD3AMymW1CoE4GgdrriYboNEriZk5rLdg2FdRcUUr15qverF8rCFhcqMJRKhuNGkPHqQfHK3rMj`, slot 462536749, outer instruction 5. User sends 56,171,396 lamports of WSOL and receives 114,549,982,220 raw base units (6 decimals). |
| `dbc-sell.json` | Signature `TUHkRzVtr7HS9WW2QdkgTAHN5B286NAAnM8ChkVmsS7ocrZtcpa5jBVFy23f2BqZ76wmU77UpLq1SyNxcGpRVkD`, slot 462536749, outer instruction 3. User sends 108,670,144,128 raw base units and receives 52,712,942 lamports of WSOL. |
| `dbc-accounts.json` | `getMultipleAccounts` snapshot at slot 462537098. Pool `9XRiEB6gCFeCFpozxttJLtU3Qt2oAgsGgez9vAJXMT9v`, its config, base/WSOL mints and both vaults. The pool had already migrated by the snapshot; historical receipts remain decodable. |

Each receipt is an original `getTransaction` result (`jsonParsed`, confirmed commitment). Account snapshot is an original `getMultipleAccounts` result plus its requested ordered `addresses`. Amount expectations come from the actual parsed token transfers, not an independently fabricated price. Tests mutate copies for adversarial cases; mutated/synthetic cases must never be treated as chain history or sent to the product.

`EvtSwap`, `EvtSwap2` and `EvtSwap3` in one invocation describe one trade. Price is the user's effective WSOL/token execution ratio, already reflecting DBC fees; it is not the pool's fee-free spot quote. Whole-transaction network fees are reported separately, not allocated/subtracted per invocation. Config/account layout source and license are documented in `vendor/meteora`.

## DAMM v2 and migration evidence

Captured 2026-10-28 using **finalized**, read-only RPC with no private endpoint/key in these files. These are the same historical token's real public receipts, not Qrate token launches.

| Fixture | Evidence |
|---|---|
| `dbc-damm-migration.json` | Signature `32fps2XzztyKB1yWzG9CU2T6oD4zYiXFeKa2iqmSU31aLqLEh1vCtUJRyVbJYugLzX1xbtJLLCbnjhBtaMrNEKvA`, slot **462536876**. DBC migration instruction 0 directly invokes DAMM `initialize_pool_with_dynamic_config`; destination `6RwUJcenBfx8DwwYKM7Dw8466pjCT7YSnVbw6oSbeEAx`. |
| `damm-buy.json` | Signature `2c92juYEGag8UqUJFMwgzwiqSPkfzgVtknUiEKxaMRzEVX4pM4yuMhLsLHkE69RxC7R2WgY2sQXLgJ5C4z1rnX5H`, slot **462548620**, routed invocation **6.0**. **300,000** WSOL lamports → **74,333,841,118,890** raw base units (6 decimals). |
| `damm-sell.json` | Signature `8G7EgwvektMQ9JbZGMYmQAibxPh3Aa63cNj1MPRPVmoorwWkSryWLyJGskMNDuM2d3gQNjZbegpD9Grzw2XmZEo`, slot **462548619**, invocation **4**. **2,937,510,166,127** raw base units → **10,872** WSOL lamports. |
| `damm-accounts.json` | Finalized snapshot at **462558088**, ordered pool/base mint/WSOL/base vault/quote vault. Token A is metadata-only Token-2022, Token B is WSOL, fee mode 0. |

Both real swaps use legacy `swap`. Test-only conversions exercise exact-input `swap2` and adversarial cases; those mutations are not recorded chain history. DAMM LP claiming fees are mapped to `fees.tradingRaw`; protocol fees are separate. Fee mode 0 charges the output token; fee mode 1 charges token B. Unsupported referral/compounding/transfer-fee cases never create price records. Runtime pool snapshots verify current state and do not prove every historical mint configuration.
