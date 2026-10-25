// Connection test entry point: load configuration, read a slot, and report the result.
import { getHeliusRpcUrl } from "./config.js";
import { getSlot } from "./helius.js";

// The .js import extensions also work after TypeScript emits the compiled files.
try {
  const slot = await getSlot(getHeliusRpcUrl());
  console.log("Connected to Helius — Solana Mainnet (read-only test).");
  console.log(`Current confirmed Solana slot: ${slot}`);
} catch (error) {
  // Our adapter only throws sanitized messages; never print the RPC URL or API key.
  console.error(error instanceof Error ? error.message : "Helius connection test failed.");
  process.exitCode = 1;
}
