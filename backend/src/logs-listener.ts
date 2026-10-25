// Listener transport: ws supplies ping/pong health checks on supported Node.js versions.
import WebSocket from "ws";
import { getTransaction, isRecord } from "./transaction-rpc.js";

// Inject endpoints and output handlers so tests can use local servers without real credentials.
export interface ListenerOptions {
  rpcUrl: URL;
  webSocketUrl: URL;
  mint: string;
  log?: (message: string) => void;
  onTransaction?: (signature: string, details: Record<string, unknown>) => void;
}

// One listener owns its socket, retry timers, pending work, and recently completed signatures.
export function startLogsListener(options: ListenerOptions): { stop: () => void } {
  const log = options.log ?? console.log;
  const output = options.onTransaction ?? ((signature, details) => {
    console.log(`Transaction details: ${signature}`);
    console.log(JSON.stringify(details, null, 2));
  });
  const controller = new AbortController();
  const completed = new Set<string>();
  const pending = new Set<string>();
  const queue: string[] = [];
  let processing = false;
  let stopped = false;
  let socket: WebSocket | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let connectionAttempts = 0;

  // Sequential worker: one RPC request at a time avoids bursts and overlapping duplicate work.
  async function drain(): Promise<void> {
    if (processing) return;
    processing = true;
    try {
      while (queue.length && !stopped) {
        const signature = queue.shift()!;
        try {
          const details = await getTransaction(options.rpcUrl, signature, controller.signal);
          if (stopped) break;
          output(signature, details);
          completed.add(signature);
          // Bounded memory: remember the most recent 10,000 successful signatures this run.
          if (completed.size > 10_000) completed.delete(completed.values().next().value!);
        } catch {
          if (!stopped) log(`Could not fetch ${signature} after retries; a later notification may retry it.`);
        } finally {
          pending.delete(signature);
        }
      }
    } finally {
      processing = false;
    }
  }

  // Backoff: reconnect with jitter, growing from one second to a maximum of 30 seconds.
  function scheduleReconnect(): void {
    if (stopped || reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(connectionAttempts++, 5));
    log(`WebSocket disconnected. Reconnecting in about ${Math.ceil(delay / 1000)}s.`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay + Math.floor(Math.random() * 250));
  }

  // Each connection subscribes afresh; the server assigns a new subscription ID every time.
  function connect(): void {
    if (stopped) return;
    log("Connecting to Helius Mainnet WebSocket...");
    const current = new WebSocket(options.webSocketUrl, { handshakeTimeout: 15_000 });
    socket = current;
    let subscriptionId: number | undefined;
    let awaitingPong = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let acknowledgementTimer: ReturnType<typeof setTimeout> | undefined;
    let stableTimer: ReturnType<typeof setTimeout> | undefined;

    // Subscription timeout and heartbeat detect sockets that remain open but stop responding.
    current.on("open", () => {
      current.send(JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "logsSubscribe",
        params: [{ mentions: [options.mint] }, { commitment: "confirmed" }],
      }));
      acknowledgementTimer = setTimeout(() => current.terminate(), 15_000);
      heartbeat = setInterval(() => {
        if (awaitingPong) { current.terminate(); return; }
        awaitingPong = true;
        current.ping();
      }, 30_000);
    });
    current.on("pong", () => { awaitingPong = false; });

    // Validate untrusted JSON before using its signature or subscription identifier.
    current.on("message", (raw) => {
      if (stopped) return;
      let message: unknown;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (!isRecord(message) || message.jsonrpc !== "2.0") return;
      if (message.id === 1) {
        if ("error" in message || typeof message.result !== "number" || !Number.isSafeInteger(message.result)) {
          log("Helius rejected logsSubscribe; check the API key and subscription limits.");
          current.terminate();
          return;
        }
        subscriptionId = message.result;
        clearTimeout(acknowledgementTimer);
        // Reset backoff only after a stable minute, avoiding a rapid connect/drop loop.
        stableTimer = setTimeout(() => { connectionAttempts = 0; }, 60_000);
        log(`Subscribed to mint ${options.mint} (subscription ${subscriptionId}).`);
        return;
      }
      if (message.method !== "logsNotification" || !isRecord(message.params) ||
          subscriptionId === undefined || message.params.subscription !== subscriptionId ||
          !isRecord(message.params.result) || !isRecord(message.params.result.value)) return;
      const signature = message.params.result.value.signature;
      if (typeof signature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return;
      if (completed.has(signature) || pending.has(signature)) return;
      // Bound queue growth explicitly; report overflow instead of consuming unlimited memory.
      if (pending.size >= 1000) {
        log(`Queue full: not fetching ${signature}. This terminal demo needs a durable queue for heavy traffic.`);
        return;
      }
      pending.add(signature);
      queue.push(signature);
      log(`Transaction signature: ${signature}`);
      void drain();
    });

    // Do not print raw socket errors or close reasons because they may contain credentials.
    current.on("error", () => {
      log("WebSocket connection error; checking connection and retrying.");
      current.terminate();
    });
    current.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(acknowledgementTimer);
      clearTimeout(stableTimer);
      scheduleReconnect();
    });
  }

  // Shutdown cancels retries, aborts HTTP work, and closes the socket without reconnecting.
  function stop(): void {
    if (stopped) return;
    stopped = true;
    clearTimeout(reconnectTimer);
    controller.abort();
    queue.length = 0;
    pending.clear();
    socket?.terminate();
    log("Transaction listener stopped.");
  }

  connect();
  return { stop };
}
