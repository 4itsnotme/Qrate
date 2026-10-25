// dotenv reads backend/.env and makes its settings available through process.env.
import { config } from "dotenv";

// Resolve relative to this file so both src/config.ts and dist/config.js find backend/.env.
// Existing environment variables take priority, which also supports cloud deployments.
config({ path: new URL("../.env", import.meta.url), quiet: true });

// Validate before connecting: a missing key should produce a helpful, secret-free error.
export function getHeliusRpcUrl(): URL {
  const apiKey = process.env.HELIUS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set HELIUS_API_KEY in backend/.env before running the RPC test.");
  }

  // This URL is private because its query string contains the API key. Never log it.
  const url = new URL("https://mainnet.helius-rpc.com/");
  url.searchParams.set("api-key", apiKey);
  return url;
}
