// Small RPC adapter: keep provider/network code separate from the startup script.
// getSlot only reads chain state; it does not sign or submit any transaction.
export async function getSlot(rpcUrl: URL): Promise<number> {
  let response: Response;
  try {
    // JSON-RPC is a POST containing the method name and its arguments.
    // A timeout prevents a broken connection from hanging the test indefinitely.
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Raw network errors may contain the secret URL, so expose only a safe message.
    throw new Error("Helius request failed or timed out. Check your connection and API key.");
  }

  if (!response.ok) {
    throw new Error(`Helius returned HTTP ${response.status}. Check your API key and usage limits.`);
  }

  // Treat external JSON as unknown until its shape and returned slot are checked.
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Helius returned an unreadable JSON response.");
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("Helius returned an invalid RPC response.");
  }
  if ("error" in data) {
    throw new Error("Helius reported an RPC error. Check your API key and provider status.");
  }
  if (!("jsonrpc" in data) || data.jsonrpc !== "2.0" || !("id" in data) || data.id !== 1 ||
      !("result" in data) || typeof data.result !== "number" ||
      !Number.isSafeInteger(data.result) || data.result < 0) {
    throw new Error("Helius did not return a valid slot number.");
  }
  return data.result;
}
