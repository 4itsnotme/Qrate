// Run against an isolated Chrome started with --headless=new --remote-debugging-port=9338.
// Uses the existing backend ws dependency and serves only local app files/QA media.
import WebSocket from '../../backend/node_modules/ws/wrapper.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';

const appRoot = new URL('../', import.meta.url);
let fixture;
let failMedia = true;
const mediaRequests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/media/')) {
    mediaRequests.push(url.pathname);
    if (!fixture || (url.pathname === '/media/fail.webm' && failMedia)) {
      response.writeHead(404); response.end(); return;
    }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = Number(range?.[1] ?? 0);
    const end = Math.min(Number(range?.[2] || fixture.length - 1), fixture.length - 1);
    const headers = { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600', 'Content-Length': end - start + 1 };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${fixture.length}`;
    response.writeHead(range ? 206 : 200, headers);
    response.end(fixture.subarray(start, end + 1));
    return;
  }
  const assets = { '/': ['index.html', 'text/html'], '/feed.js': ['feed.js', 'text/javascript'], '/feed-data.js': ['feed-data.js', 'text/javascript'],
    '/trading-chart.js': ['trading-chart.js', 'text/javascript'],
    '/vendor/lightweight-charts/lightweight-charts.standalone.production.js': ['vendor/lightweight-charts/lightweight-charts.standalone.production.js', 'text/javascript'] };
  if (!assets[url.pathname]) { response.writeHead(404); response.end(); return; }
  const [path, type] = assets[url.pathname];
  response.writeHead(200, { 'Content-Type': type });
  response.end(await readFile(new URL(path, appRoot)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const debug = process.env.QRATE_CDP_ENDPOINT ?? 'http://127.0.0.1:9338';
let socket;
let targetId;
try {
  const tabs = await (await fetch(`${debug}/json/list`, { signal: AbortSignal.timeout(3000) })).json();
  const target = tabs.find(tab => tab.type === 'page');
  if (!target) throw new Error('The isolated Chrome session needs an open page.');
  targetId = target.id;
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
} catch (error) {
  socket?.terminate();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  throw new Error('Start isolated Chrome with remote debugging before running this check.', { cause: error });
}
let nextId = 0;
const pending = new Map();
const exceptions = [];
socket.on('message', raw => {
  const message = JSON.parse(raw);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  clearTimeout(item.timer);
  message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(expression)) return;
    await delay(40);
  }
  throw new Error(`Condition failed: ${expression}; state: ${JSON.stringify(await evaluate('window.qrateFeed?.getState()'))}`);
}
async function navigate(url = origin) {
  await cdp('Page.navigate', { url });
  await until('document.readyState === "complete" && !!window.qrateFeed');
  await delay(250);
}
async function click(selector) {
  const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function key(key, code, value) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: value });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: value });
}
async function go(index) {
  await evaluate(`document.querySelector('.video-feed').scrollTo({top:${index}*document.querySelector('.video-feed').clientHeight,behavior:'instant'})`);
  await until(`qrateFeed.getState().activeIndex === ${index}`);
}
async function swipe(x1, y1, x2, y2) {
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 1 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 8, y: y1 + (y2 - y1) * i / 8, id: 1 }] });
    await delay(20);
  }
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(200);
}
async function wheelBurst(deltaY, count, gap = 15) {
  for (let i = 0; i < count; i++) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 760, y: 450, deltaX: 0, deltaY });
    await delay(gap);
  }
  await delay(650);
}
async function assertSinglePlayback() {
  assert.equal(await evaluate(`(()=>{const playing=[...document.querySelectorAll('video')].filter(v=>!v.paused);return playing.length<=1&&playing.every(v=>v.closest('[aria-current="true"]'));})()`), true);
  assert.ok(await evaluate('document.querySelectorAll("video").length') <= 3);
}
async function feedListenerCount() {
  const object = await cdp('Runtime.evaluate', { expression: 'document.querySelector(".video-feed")' });
  const result = await cdp('DOMDebugger.getEventListeners', { objectId: object.result.objectId });
  return result.listeners.length;
}

try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate();
  const listenerCount = await feedListenerCount();
  assert.equal(await evaluate('document.querySelectorAll("video").length'), 0);
  const encoded = await evaluate(`(async()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    const context=canvas.getContext('2d');const stream=canvas.captureStream(15),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
    recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(r=>recorder.onstop=r);
    recorder.start();const paint=setInterval(()=>{context.fillStyle=Date.now()%2?'#527a8a':'#6193a6';context.fillRect(0,0,160,90);},30);
    await new Promise(r=>setTimeout(r,800));recorder.stop();await stopped;clearInterval(paint);stream.getTracks().forEach(t=>t.stop());
    window.qaBlob=new Blob(chunks,{type:'video/webm'});
    return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(qaBlob);});
  })()`);
  fixture = Buffer.from(encoded, 'base64');
  assert.ok(fixture.length > 200);
  await evaluate(`qrateFeed.appendVideos(Array.from({length:160},(_,i)=>({id:'clip-'+i,title:'Clip '+i,src:${JSON.stringify(origin)}+'/media/'+i+'.webm'})))`);
  assert.equal(await evaluate('qrateFeed.appendVideos([{id:"clip-0"}])'), 0);
  assert.equal(await evaluate('qrateFeed.getState().totalEntries'), 163);
  assert.equal(mediaRequests.length, 0, 'distant sources must not be requested');
  await go(3);
  await until('document.querySelector("[aria-current] video")?.readyState>=3 && !document.querySelector("[aria-current] video").paused');
  await until('document.querySelector("[data-video-id=clip-1]")?.dataset.mediaState === "ready"');
  assert.ok(mediaRequests.includes('/media/0.webm'));
  assert.ok(mediaRequests.includes('/media/1.webm'));
  assert.equal(mediaRequests.includes('/media/2.webm'), false, 'N+2 must not fetch media');
  await evaluate('window.keptVideo=document.querySelector("[aria-current] video")');
  const requestsBefore = mediaRequests.length;
  await evaluate('qrateFeed.appendVideos([{id:"extra"}])');
  assert.equal(await evaluate('window.keptVideo===document.querySelector("[aria-current] video")'), true);
  assert.equal(mediaRequests.length, requestsBefore, 'appending must not restart existing media');
  console.log('PASS: dynamic append/deduplication, active playback, next-video readiness, N+2/distant request avoidance and media reuse.');

  await wheelBurst(120, 15);
  assert.equal(await evaluate('qrateFeed.getState().activeIndex'), 4);
  await wheelBurst(-120, 15);
  assert.equal(await evaluate('qrateFeed.getState().activeIndex'), 3);
  await wheelBurst(4, 25, 12);
  assert.equal(await evaluate('qrateFeed.getState().activeIndex'), 4);
  await assertSinglePlayback();
  assert.equal(await evaluate('window.scrollY'), 0);
  console.log('PASS: wheel bursts and trackpad-like momentum advance one item; reverse scrolling works inside the feed.');

  await evaluate('document.querySelector(".video-feed").focus()');
  await key('ArrowDown', 'ArrowDown', 40);
  await until('qrateFeed.getState().activeIndex===5');
  await key('ArrowUp', 'ArrowUp', 38);
  await until('qrateFeed.getState().activeIndex===4');
  for (const index of [35, 100, 20, 150, 4, 80, 3]) {
    await go(index);
    await assertSinglePlayback();
  }
  await until('!document.querySelector("[aria-current] video").paused');
  assert.equal(await evaluate('document.querySelector("[data-video-id=clip-147] video")'), null);
  assert.equal(await evaluate('document.querySelector("[data-video-id=clip-147]").dataset.mediaState'), 'released');
  console.log('PASS: keyboard and rapid long-feed navigation; distant media released; at most three video elements and one playing.');
  assert.equal(await feedListenerCount(), listenerCount, 'long feeds must not accumulate listeners');

  await click('[aria-current] .sound-toggle');
  assert.equal(await evaluate('document.querySelector("[aria-current] video").muted'), false);
  const saved = await evaluate('document.querySelector(".video-feed").scrollTop');
  await click('[aria-current] .trade-button');
  await until('qrateFeed.getState().tradingOpen');
  assert.equal(await evaluate('location.hash'), '#trade/clip-0');
  await until('document.querySelector("#trading-chart").dataset.state === "empty"');
  assert.equal(await evaluate('document.querySelector("#trading-chart").dataset.videoId'), 'clip-0');
  assert.ok(await evaluate('document.querySelectorAll("#trading-chart canvas").length') > 0);
  assert.ok(await evaluate('document.querySelector("#trading-chart").clientWidth') > 100);
  assert.ok(await evaluate('document.querySelector("#trading-chart").clientHeight') > 100);
  assert.equal(await evaluate('document.querySelector(".trading-chart-message").textContent'), 'No price data yet.');
  assert.equal(await evaluate('[...document.querySelectorAll("video")].every(v=>v.paused)'), true);
  await click('.back-to-feed'); await until('!qrateFeed.getState().tradingOpen');
  assert.equal(await evaluate('document.querySelectorAll("#trading-chart canvas").length'), 0);
  assert.equal(await evaluate('document.querySelector(".video-feed").scrollTop'), saved);
  await until('!document.querySelector("[aria-current] video").paused');
  await click('[aria-current] video');
  await click('[aria-current] .trade-button'); await click('.back-to-feed');
  await until('!qrateFeed.getState().tradingOpen');
  assert.equal(await evaluate('document.querySelector("[aria-current] video").paused'), true);
  console.log('PASS: sound, per-video trading route, feed-position restoration and manually paused playback.');

  await evaluate(`qrateFeed.appendVideos([{id:'broken',src:${JSON.stringify(origin + '/media/fail.webm')}}])`);
  const brokenIndex = await evaluate('qrateFeed.getState().totalEntries-1');
  await go(brokenIndex);
  await until('document.querySelector("[aria-current]").dataset.playbackState==="error"');
  failMedia = false;
  await click('[aria-current] .playback-action');
  await until('!document.querySelector("[aria-current] video").paused && document.querySelector("[aria-current]").dataset.playbackState==="playing"');
  await evaluate(`window.realPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('QA policy','NotAllowedError'));}`);
  await go(3);
  await until('document.querySelector("[aria-current]").dataset.playbackState==="blocked"');
  await evaluate('HTMLMediaElement.prototype.play=window.realPlay');
  await click('[aria-current] .playback-action');
  await until('!document.querySelector("[aria-current] video").paused');
  console.log('PASS: failed media Retry and rejected-autoplay Play recovery.');

  await evaluate(`window.abortCalls=0;HTMLMediaElement.prototype.play=function(){window.abortCalls++;return window.abortCalls===1?Promise.reject(new DOMException('QA cancellation','AbortError')):window.realPlay.call(this);}`);
  await go(15);
  await until('!document.querySelector("[aria-current] video").paused');
  assert.equal(await evaluate('window.abortCalls'), 2);
  await evaluate(`window.abortCalls=0;HTMLMediaElement.prototype.play=function(){window.abortCalls++;return Promise.reject(new DOMException('QA repeated cancellation','AbortError'));}`);
  await go(20);
  await until('document.querySelector("[aria-current]").dataset.playbackState==="blocked"');
  assert.equal(await evaluate('window.abortCalls'), 2, 'cancellation retries must be bounded');
  await evaluate('HTMLMediaElement.prototype.play=window.realPlay');
  await click('[aria-current] .playback-action');
  await until('!document.querySelector("[aria-current] video").paused');
  console.log('PASS: canceled play retries once; repeated cancellation exposes recovery without a retry loop.');

  await evaluate('Object.defineProperty(navigator.connection,"saveData",{value:true,configurable:true});navigator.connection.dispatchEvent(new Event("change"))');
  await go(55);
  await until('document.querySelector("[aria-current] video").readyState>=3');
  assert.equal(mediaRequests.includes('/media/53.webm'), false, 'Save-Data must not start next-video preloading');
  await evaluate('delete navigator.connection.saveData;navigator.connection.dispatchEvent(new Event("change"))');
  await until('document.querySelector("[data-video-id=clip-53] video")?.readyState>=2');
  const backgroundTab = await cdp('Target.createTarget', { url: 'about:blank' });
  await cdp('Target.activateTarget', { targetId: backgroundTab.targetId });
  await until('document.hidden');
  assert.equal(await evaluate('[...document.querySelectorAll("video")].every(v=>v.paused)'), true);
  await cdp('Target.activateTarget', { targetId });
  await until('!document.hidden && !document.querySelector("[aria-current] video").paused');
  await cdp('Target.closeTarget', { targetId: backgroundTab.targetId });
  console.log('PASS: Save-Data disables speculative media; returning from a background tab resumes the active video.');

  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await delay(450); await go(3); await delay(200);
  await swipe(190, 640, 195, 170);
  await until('qrateFeed.getState().activeIndex===4');
  assert.equal(await evaluate('qrateFeed.getState().tradingOpen'), false);
  await swipe(100, 300, 280, 305);
  await until('qrateFeed.getState().tradingOpen');
  assert.equal(await evaluate('location.hash'), '#trade/clip-1');
  await until('document.querySelector("#trading-chart").dataset.state === "empty"');
  assert.equal(await evaluate('document.querySelector("#trading-chart").dataset.videoId'), 'clip-1');
  await writeFile(new URL('../../trading-chart-mobile-check.png', import.meta.url), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await swipe(300, 300, 100, 302);
  await until('!qrateFeed.getState().tradingOpen');
  assert.equal(await evaluate('qrateFeed.getState().activeIndex'), 4);
  await assertSinglePlayback();
  await writeFile(new URL('../../feed-mobile-check.png', import.meta.url), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  console.log('PASS: phone vertical snap, right swipe into the correct trading tab and left swipe back.');

  await go(brokenIndex);
  await evaluate(`window.pageCalls=0;qrateFeed.setLoader(async({cursor})=>{window.pageCalls++;await new Promise(r=>setTimeout(r,250));return {items:[{id:'paged',src:${JSON.stringify(origin + '/media/paged.webm')}}],hasMore:false};});qrateFeed.loadMore();qrateFeed.loadMore();void 0;`);
  assert.equal(await evaluate('qrateFeed.getState().pagination.loading'), true);
  await until('!qrateFeed.getState().pagination.loading');
  assert.equal(await evaluate('window.pageCalls'), 1);
  assert.equal(await evaluate('document.querySelectorAll("[data-video-id=paged]").length'), 1);
  await evaluate(`window.pageCalls=0;qrateFeed.setLoader(async()=>{window.pageCalls++;if(window.pageCalls===1)throw new Error('QA outage');return {items:[{id:'retry-page'}],hasMore:false};});void 0;`);
  await until('qrateFeed.getState().pagination.error');
  await click('.feed-load-status button');
  await until('!qrateFeed.getState().pagination.error && !qrateFeed.getState().pagination.loading');
  assert.equal(await evaluate('window.pageCalls'), 2);
  console.log('PASS: near-end pagination, separate loading state and no duplicate concurrent requests.');

  await navigate();
  await evaluate(`(async()=>{
    const response=await fetch(${JSON.stringify(origin + '/media/0.webm')});const blob=await response.blob();
    const transfer=new DataTransfer();for(let i=0;i<5;i++)transfer.items.add(new File([blob],'local-'+i+'.webm',{type:'video/webm'}));
    const input=document.querySelector('#video-file-input');input.files=transfer.files;input.dispatchEvent(new Event('change'));
  })()`);
  await until('qrateFeed.getState().totalEntries===5 && !document.querySelector("[aria-current] video").paused');
  await go(4); await go(0); await assertSinglePlayback();
  const fileOrigin = new URL('index.html', appRoot).href;
  await navigate(fileOrigin + '#trade/video-2');
  await until('qrateFeed.getState().tradingOpen');
  await until('document.querySelector("#trading-chart").dataset.state === "empty"');
  assert.equal(await evaluate('LightweightCharts.version()'), '5.2.1');
  await click('.back-to-feed'); await until('!qrateFeed.getState().tradingOpen');
  assert.equal(await evaluate('qrateFeed.getState().activeIndex'), 1);
  await evaluate('window.qaChartLibrary=window.LightweightCharts;window.LightweightCharts=undefined');
  await click('[aria-current] .trade-button');
  await until('document.querySelector("#trading-chart").dataset.state === "error"');
  assert.equal(await evaluate('document.querySelector(".trading-chart-message").textContent'), 'Chart unavailable. Reload to retry.');
  await click('.back-to-feed'); await until('!qrateFeed.getState().tradingOpen');
  await evaluate('window.LightweightCharts=window.qaChartLibrary');
  await evaluate('qrateFeed.destroy()');
  assert.equal(await evaluate('document.querySelectorAll("video").length'), 0);
  assert.equal(await feedListenerCount(), 0);
  assert.deepEqual(exceptions, []);
  console.log('PASS: multiple local previews, file:// operation, direct trading links and no JavaScript exceptions.');
  console.log('PASS: real empty Lightweight Charts canvas, per-video identity, resize, chart teardown and missing-library recovery.');
} finally {
  await cdp('Page.navigate', { url: 'about:blank' }).catch(() => {});
  socket.close();
  for (const item of pending.values()) clearTimeout(item.timer);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
