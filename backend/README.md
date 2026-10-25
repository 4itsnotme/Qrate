# Qrate Analytics Backend

This folder will contain Qrate's reusable Node.js and TypeScript analytics backend.

Its responsibilities will include:

- Receiving Solana transaction data through Helius RPC and WebSockets.
- Passing transactions through interchangeable protocol decoders.
- Calculating token prices, OHLC candlesticks, and market statistics.
- Storing local development data in SQLite.
- Serving historical data through an API and live updates through WebSockets.
- Supporting many tokens without creating a separate backend for each token.

The first implementation will observe one actively traded Solana mainnet token in read-only mode. Qrate token launches and wallet-authorized trading remain separate, devnet-first workflows.

## First selected token

`src/tracked-tokens.ts` stores the current read-only target:
`H74CYmXgMkYHYuSRsZt6RJb4NYp2u72Vw8BS5huApump`.
Discovery identifies it as LMAO! with a PumpSwap SOL pair. Helius verified that
the mint exists with 6 decimals and that the candidate pool is owned by the
PumpSwap program. Pool mint fields must still be decoded and verified before
recording trade prices. This configuration does not start a live subscription.

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
