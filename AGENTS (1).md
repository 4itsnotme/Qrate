# Qrate — Project Context

**Qrate (Qrate.fun)** is a Solana token discovery platform that will later support launching tokens through **Meteora Dynamic Bonding Curve (DBC)**. We are building **one reusable analytics backend** to track many Solana tokens, including Qrate launches and tokens traded through other supported protocols—not a separate backend for each coin.

**Data flow:** Solana trades → **Helius RPC/WebSockets** → **Node.js/TypeScript backend** → protocol-specific trade decoder → shared price, candlestick (OHLC), and statistics calculations → database → API/live WebSockets → Qrate frontend with **TradingView Lightweight Charts**.

**Development approach:** Start locally on a PC, with **SQLite** and **one existing actively trading Solana mainnet token** to test the complete flow. The architecture must already allow multiple tokens and interchangeable decoders (e.g. Meteora, Pump.fun/PumpSwap, Raydium). Later, deploy the same backend to cloud infrastructure, add more data and protocols, and connect Qrate's own Meteora-based token launches. We are **not building our own bonding curve**.
