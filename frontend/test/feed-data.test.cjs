const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const context = vm.createContext({ URL, AbortController, document: { baseURI: 'https://qrate.test/' }, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../feed-data.js'), 'utf8'), context);
  const appended = [];
  const states = [];
  const data = new context.window.QrateFeedData({ onAppend: entries => appended.push(...entries), onState: state => states.push(state) });
  return { data, appended, states };
}

test('feed pages append once per ID and reject an invalid page atomically', () => {
  const { data, appended } = setup();
  assert.equal(data.append([{ id: 'a', src: '/a.mp4' }, { id: 'a' }]), 1);
  assert.equal(appended[0].src, 'https://qrate.test/a.mp4');
  assert.throws(() => data.append([{ id: 'b' }, { id: 'unsafe/id' }]));
  assert.equal(data.entries.size, 1);
  assert.throws(() => data.append([{ id: 'x', src: 'javascript:alert(1)' }]));
});

test('concurrent pagination shares a request, retains cursor on failure, and permits retry', async () => {
  const { data, appended, states } = setup();
  let calls = 0;
  data.setLoader(async ({ cursor }) => {
    assert.equal(cursor, null);
    calls++;
    if (calls === 1) throw new Error('outage');
    return { items: [{ id: 'a' }, { id: 'a' }], hasMore: false };
  });
  const first = data.loadMore();
  assert.equal(first, data.loadMore());
  assert.equal(await first, 0);
  assert.equal(calls, 1);
  assert.equal(data.state().error, true);
  assert.equal(await data.loadMore(), 1);
  assert.equal(calls, 2);
  assert.equal(appended.length, 1);
  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).hasMore, false);
});

test('non-advancing pages cannot produce an endless automatic loading loop', async () => {
  const { data } = setup();
  data.setLoader(async () => ({ items: [{ id: 'a' }], hasMore: true, nextCursor: 'same' }), { cursor: 'same' });
  assert.equal(await data.loadMore(), 0);
  assert.equal(data.state().error, true);
  assert.equal(data.entries.size, 0);
});

test('changing providers aborts old work and ignores its late response', async () => {
  const { data, appended } = setup();
  let resolveOld;
  let oldSignal;
  data.setLoader(({ signal }) => { oldSignal = signal; return new Promise(resolve => { resolveOld = resolve; }); });
  const oldRequest = data.loadMore();
  await Promise.resolve();
  data.setLoader(async () => ({ items: [{ id: 'new' }], hasMore: false }));
  assert.equal(oldSignal.aborted, true);
  await data.loadMore();
  resolveOld({ items: [{ id: 'old' }], hasMore: false });
  await oldRequest;
  assert.deepEqual(appended.map(entry => entry.id), ['new']);
  assert.equal(data.state().loading, false);
});
