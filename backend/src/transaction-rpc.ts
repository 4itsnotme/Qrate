// RPC detail fetcher: notifications contain a signature, so fetch the transaction separately.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Transport returns JSON receipts; protocol interpretation belongs to separate decoders.
export async function getTransaction(
  rpcUrl: URL,
  signature: string,
  signal: AbortSignal,
  options: { commitment?: 'confirmed' | 'finalized'; fetcher?: typeof fetch } = {},
): Promise<Record<string, unknown>> {
  // Retry null results and transient failures: the HTTP node can lag behind notifications.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    signal.throwIfAborted();
    try {
      const response = await (options.fetcher ?? fetch)(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTransaction",
          params: [signature, {
            commitment: options.commitment ?? "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 1,
          }],
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      });
      const data: unknown = await response.json();
      if (response.ok && isRecord(data) && data.jsonrpc === "2.0" && data.id === 1 &&
          !("error" in data) && isRecord(data.result) &&
          Number.isSafeInteger(data.result.slot) && isRecord(data.result.transaction) &&
          Array.isArray(data.result.transaction.signatures) &&
          data.result.transaction.signatures[0] === signature) {
        return data.result;
      }
    } catch {
      // Never print raw network errors: they can include the API key in the URL.
      signal.throwIfAborted();
    }
    if (attempt < 3) {
      await new Promise<void>((resolve) => {
        const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
        const timer = setTimeout(done, 500 * 2 ** attempt);
        signal.addEventListener("abort", done, { once: true });
      });
    }
  }
  throw new Error("Transaction details unavailable after four attempts.");
}
