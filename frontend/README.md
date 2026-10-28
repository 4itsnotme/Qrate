# Qrate video prototype

Open `index.html` in a browser and use **Add video**. You can select multiple local videos. The first replaces the first preview; additional files fill empty slots and then append new entries. Nothing is uploaded or persisted. Plain deferred scripts work through `file://` as well as a static HTTP server.

`index.html` owns markup/styles, `feed.js` owns playback/navigation, and `feed-data.js` owns feed entries and optional pagination. No frontend installation or build is required. The empty trading tabs and glass Trade buttons remain available.

## Loading behavior

- Only the active video plays. Explicit pause, mute choice, background visibility and trading-tab return are respected.
- At most three video elements are attached: current, previously watched neighbor, and next. Next-video loading starts after the active video has data. A supplied poster can be prepared two positions ahead without attaching that video's media source.
- Save-Data / 2G disables speculative next-media loading; 3G requests metadata only. Without Network Information API support, normal browser-managed preloading is used.
- Distant media is paused, its source removed, `load()` called to cancel work, and its element removed. Returning recreates it and restores its saved position. Adjacent sources are not reset just because feed data is appended.
- `data-media-state` reports `unloaded`, `poster`, `preloading`, `ready`, `active`, `inactive` or `released`; separate `data-playback-state` reports loading, playing, paused, blocked or error conditions. Play/Retry controls recover blocked autoplay or media errors.
- Wheel/trackpad bursts advance one item; vertical touch scrolling uses CSS Scroll Snap. Keyboard arrows/Page Up/Page Down/Home/End navigate. Right swipe / Trade opens the selected video's empty tab.

`preload` is a browser hint, not a byte budget or buffering guarantee. Browsers may download a whole small file. Adaptive streaming/segment budgets require the later media-provider work. Light stage/poster shells remain in the DOM as entries append; heavy media elements are bounded, not total DOM size. Physical device memory, Safari and real trackpad hardware still need verification.

## Future feed adapter

The existing three slots start empty. There are no backend feed requests by default. A future integration can use:

```js
qrateFeed.appendVideos([
  { id: 'unique-video-id', title: 'Video title', src: '/media/video.mp4', poster: '/images/poster.jpg' },
]);

// Supply this callback only when an actual feed data source exists.
qrateFeed.setLoader(async ({ cursor, signal }) => {
  // Read from the chosen source, respecting signal. No endpoint is assumed by this prototype.
  return { items: [], nextCursor: null, hasMore: false };
});
```

IDs must use letters, digits, `_` or `-` and be at most 128 characters. Repeated IDs are ignored. Media/poster URLs may be HTTP(S), file or blob URLs; optional fields may be omitted. Omitted media stays empty. Metadata/posters must be supplied by the future data source; thumbnail extraction is not implemented.

When within three entries of the end, the controller requests one page. Concurrent requests share a promise; invalid/non-advancing pages fail with a separate Retry control. Providers can be replaced or disabled with `setLoader(null)`; old requests are aborted and late results ignored. `loadMore()` explicitly requests a page. Appending preserves existing IDs, sources and feed position. `getState()` exposes summary diagnostics. `destroy()` disconnects observers/listeners and releases media/object URLs.

## Verification

From the repository root, with the existing backend dependencies already present:

```powershell
node --check frontend/feed.js
node --check frontend/feed-data.js
node --test --test-isolation=none frontend/test/feed-data.test.cjs
```

For browser checks, start an **isolated** Chrome with a temporary profile, not your normal browser profile:

```powershell
$qaProfile = Join-Path (Get-Location) '.chrome-feed-check'
$qaArgs = @('--headless=new', '--remote-debugging-port=9338', ('--user-data-dir="' + $qaProfile + '"'), '--no-first-run', '--disable-background-networking', 'about:blank')
Start-Process -FilePath 'C:/Program Files/Google/Chrome/Application/chrome.exe' -ArgumentList $qaArgs -WindowStyle Hidden
node frontend/test/feed-browser-check.mjs
```

The browser check uses the existing backend `ws` dependency and a local, allowlisted HTTP fixture server. It generates a short QA video, exercises desktop/mobile-emulated input, and checks playback, network request scope, resource bounds, failure recovery, pagination and teardown. No external media, Helius, wallets, credentials or funds are used. Optional `QRATE_CDP_ENDPOINT` changes the default debug endpoint. Close the isolated Chrome after checking. Screenshot output `feed-mobile-check.png` and `.chrome*` profiles are ignored.
