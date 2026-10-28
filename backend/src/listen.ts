// Terminal command: connect the existing secret configuration and selected mint to the listener.
import { getHeliusRpcUrl, getHeliusWebSocketUrl } from "./config.js";
import { startLogsListener } from "./logs-listener.js";
import { trackedTokens } from "./tracked-tokens.js";

try {
  const token = trackedTokens[0];
  if (!token) {
    console.error("No default tracking token. Use npm run market:listen -- --pool <DBC_POOL_ADDRESS>, or configure a Meteora reference in src/tracked-tokens.ts.");
    process.exitCode = 1;
  } else {
    const listener = startLogsListener({
      rpcUrl: getHeliusRpcUrl(), webSocketUrl: getHeliusWebSocketUrl(), mint: token.mint,
    });

    // Ctrl+C and service shutdown both stop network work cleanly.
    process.once("SIGINT", () => listener.stop());
    process.once("SIGTERM", () => listener.stop());
  }
} catch {
  console.error("Cannot start listener. Check HELIUS_API_KEY in backend/.env and the tracking configuration.");
  process.exitCode = 1;
}
