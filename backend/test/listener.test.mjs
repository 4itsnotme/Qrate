// Integration test: local HTTP/WebSocket servers exercise the real listener without API credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { startLogsListener } from '../dist/logs-listener.js';
import { getTransaction } from '../dist/transaction-rpc.js';

// Poll asynchronously until the expected event occurs, with a bounded test timeout.
async function until(condition) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for listener event.');
}

test('subscribe, fetch after null, deduplicate across reconnect, and stop', { timeout: 12000 }, async (t) => {
  const signature = '2'.repeat(88);
  let requests = 0;
  let subscriptions = 0;
  const outputs = [];
  const logs = [];
  const subscriptionRequests = [];

  // Simulate the HTTP node lagging: first response is null, second contains transaction details.
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    subscriptionRequests.push(rpc);
    requests += 1;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 1,
      result: requests === 1 ? null : { slot: 100, transaction: { signatures: [signature] }, meta: { err: null } },
    }));
  });
  const wss = new WebSocketServer({ server });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const mint = 'H74CYmXgMkYHYuSRsZt6RJb4NYp2u72Vw8BS5huApump';
  let listener;
  t.after(async () => {
    listener?.stop();
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });

  // Repeated notifications arrive before and after a forced reconnection.
  wss.on('connection', socket => {
    socket.on('message', raw => {
      const request = JSON.parse(raw.toString());
      assert.equal(request.method, 'logsSubscribe');
      assert.deepEqual(request.params, [{ mentions: [mint] }, { commitment: 'confirmed' }]);
      subscriptions += 1;
      socket.send(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 7 }));
      const notification = JSON.stringify({ jsonrpc: '2.0', method: 'logsNotification',
        params: { subscription: 7, result: { context: { slot: 100 }, value: { signature, err: null, logs: [] } } },
      });
      socket.send('malformed JSON');
      socket.send(notification);
      socket.send(notification);
    });
  });
  listener = startLogsListener({ rpcUrl: new URL(`http://127.0.0.1:${port}`),
    webSocketUrl: new URL(`ws://127.0.0.1:${port}`), mint,
    log: message => logs.push(message), onTransaction: (sig, details) => outputs.push({ sig, details }),
  });
  await until(() => outputs.length === 1);
  for (const client of wss.clients) client.terminate();
  await until(() => subscriptions === 2);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(requests, 2);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].details.slot, 100);
  assert.equal(subscriptionRequests[0].method, 'getTransaction');
  assert.equal(subscriptionRequests[0].params[1].maxSupportedTransactionVersion, 1);
  assert.equal(logs.filter(line => line.startsWith('Transaction signature:')).length, 1);
  listener.stop();
  await new Promise(resolve => setTimeout(resolve, 1300));
  assert.equal(subscriptions, 2, 'shutdown must not reconnect');
});

test('aborted transaction fetch stops without leaking the private URL', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(getTransaction(new URL('http://127.0.0.1:1/?api-key=test-secret'), '2'.repeat(88), controller.signal),
    error => !String(error).includes('test-secret'));
});
