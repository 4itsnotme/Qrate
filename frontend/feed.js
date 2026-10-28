(() => {
  'use strict';

  const feed = document.querySelector('.video-feed');
  const initialStages = [...feed.querySelectorAll('.player-stage')];
  const stageTemplate = initialStages[0].cloneNode(true);
  const navigation = document.querySelector('.app-navigation');
  const picker = document.querySelector('#video-file-input');
  const pickerStatus = document.querySelector('.video-picker-status');
  const tradingTab = document.querySelector('#trading-tab');
  const tradingTitle = document.querySelector('#trading-title');
  const backButton = document.querySelector('.back-to-feed');
  const pageStatus = document.querySelector('.feed-load-status');
  const pageMessage = pageStatus.querySelector('span');
  const pageRetry = pageStatus.querySelector('button');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const phoneLayout = matchMedia('(max-width: 767px)');
  const connection = navigator.connection;
  const lifetime = new AbortController();
  const records = [];
  const byId = new Map();
  const byStage = new WeakMap();
  const byVideo = new WeakMap();
  const attached = new Set();
  const posters = new Set();
  const visible = new Map();
  const ownedUrls = new Set();
  let activeIndex = -1;
  let navigationTarget = null;
  let soundEnabled = false;
  let tradingOpen = false;
  let feedSnapshot = null;
  let updateFrame = 0;
  let suppressClickUntil = 0;
  let localSequence = 0;
  let destroyed = false;
  let scrolling = false;
  let scrollTimer;

  function listen(target, name, handler, options = {}) {
    target.addEventListener(name, handler, { ...options, signal: lifetime.signal });
  }

  function setState(record, media, playback = record.stage.dataset.playbackState) {
    record.stage.dataset.mediaState = media;
    record.stage.dataset.playbackState = playback;
    const messages = { loading: 'Loading video…', blocked: 'Tap Play to start this video.', error: 'This video could not be loaded.', paused: 'Video paused.' };
    record.message.textContent = messages[playback] ?? '';
    record.action.textContent = playback === 'error' ? 'Retry' : 'Play';
    record.action.hidden = !['blocked', 'error', 'paused'].includes(playback);
    record.feedback.hidden = !messages[playback] || record.index !== activeIndex;
  }

  function canPlay(record, video = record.video) {
    return !destroyed && !document.hidden && !tradingOpen && record.index === activeIndex &&
      record.video === video && record.wantsToPlay;
  }

  function applySound(record) {
    const audible = soundEnabled && record.index === activeIndex && !tradingOpen;
    if (record.video) record.video.muted = !audible;
    record.sound.setAttribute('aria-pressed', String(audible));
    record.sound.setAttribute('aria-label', audible ? 'Turn sound off' : 'Turn sound on');
    record.sound.hidden = !record.entry.src;
  }

  function pause(record) {
    record.wantsToPlay = false;
    record.video?.pause();
    if (record.video) setState(record, 'inactive', record.failed ? 'error' : 'paused');
  }

  function release(record) {
    const video = record.video;
    if (!video) return;
    record.time = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    record.video = null;
    record.pendingPlay = null;
    record.wantsToPlay = false;
    attached.delete(record);
    video.pause();
    video.removeAttribute('src');
    video.load(); // Cancels pending media work; stale play promises are guarded by element identity.
    video.remove();
    setState(record, 'released', 'idle');
  }

  function showPoster(record, show) {
    if (show && record.entry.poster) {
      if (record.poster.getAttribute('src') !== record.entry.poster) record.poster.src = record.entry.poster;
      record.poster.hidden = false;
      posters.add(record);
    } else {
      record.poster.removeAttribute('src');
      record.poster.hidden = true;
      posters.delete(record);
    }
  }

  function attach(record, preload) {
    if (!record.entry.src) return null;
    if (record.video) {
      // Changing a hint does not reset the source or discard already buffered media.
      record.video.preload = preload;
      return record.video;
    }
    const video = document.createElement('video');
    video.loop = true;
    video.playsInline = true;
    video.muted = true;
    video.preload = preload;
    video.setAttribute('aria-label', record.entry.title);
    video.src = record.entry.src;
    record.video = video;
    record.failed = false;
    byVideo.set(video, record);
    attached.add(record);
    record.frame.prepend(video);
    setState(record, 'preloading', 'loading');
    return video;
  }

  function nextPreload() {
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return 'none';
    return connection?.effectiveType === '3g' ? 'metadata' : 'auto';
  }

  function prepareWindow() {
    // Keep only N−1 / N / N+1 media elements. N+2 gets a poster, never a media URL.
    for (const record of attached) {
      if (Math.abs(record.index - activeIndex) > 1) release(record);
    }
    for (const record of posters) {
      if (record.index < activeIndex - 1 || record.index > activeIndex + 2) showPoster(record, false);
    }
    for (let index = activeIndex - 1; index <= activeIndex + 2; index += 1) {
      if (records[index]) showPoster(records[index], true);
    }
    const current = records[activeIndex];
    if (!current) return;
    attach(current, 'auto');
    if (current.failed) setState(current, 'inactive', 'error');
    else if (!current.entry.src) setState(current, 'unloaded', 'idle');
    const previous = records[activeIndex - 1];
    if (previous?.video) previous.video.preload = 'none';
    const next = records[activeIndex + 1];
    const preload = nextPreload();
    const mayWarmNext = !document.hidden && !tradingOpen && (!current.entry.src || current.failed || current.video?.readyState >= 2);
    if (next && preload !== 'none' && mayWarmNext) attach(next, preload);
    else if (next?.video) release(next);
    const ahead = records[activeIndex + 2];
    if (ahead && !ahead.video) setState(ahead, ahead.entry.poster ? 'poster' : 'unloaded', 'idle');
    applySound(current);
  }

  function requestPlay(record, retryAllowed = true) {
    if (!record || !record.entry.src || record.failed) return;
    record.wantsToPlay = true;
    const video = record.video ?? attach(record, 'auto');
    if (!canPlay(record, video)) return;
    applySound(record);
    if (record.pendingPlay) return;
    setState(record, video.readyState >= 3 ? 'ready' : 'preloading', 'loading');
    const promise = video.play();
    let retryAborted = false;
    record.pendingPlay = promise;
    promise.then(() => {
      if (!canPlay(record, video)) { video.pause(); return; }
      setState(record, 'active', 'playing');
    }).catch((error) => {
      if (!canPlay(record, video)) return;
      if (error.name === 'AbortError') {
        if (retryAllowed) retryAborted = true;
        else { record.wantsToPlay = false; setState(record, 'inactive', 'blocked'); }
        return;
      }
      record.wantsToPlay = false;
      const blocked = error.name === 'NotAllowedError';
      record.failed = !blocked;
      setState(record, 'inactive', blocked ? 'blocked' : 'error');
    }).finally(() => {
      if (record.pendingPlay === promise) record.pendingPlay = null;
      // A quick pause/resume can cancel the previous promise before the new request is allowed to run.
      if (retryAborted && canPlay(record, video)) requestPlay(record, false);
    });
  }

  function maybeLoadMore() {
    const nearEnd = activeIndex >= records.length - 3;
    if (nearEnd && !tradingOpen && !source.error) void source.loadMore();
  }

  function setActiveIndex(index, { autoplay = true } = {}) {
    if (!records[index]) return;
    const previous = records[activeIndex];
    if (previous && previous.index !== index) {
      pause(previous);
      previous.stage.removeAttribute('aria-current');
      previous.feedback.hidden = true;
      if (previous.video) previous.video.muted = true;
      previous.sound.setAttribute('aria-pressed', 'false');
    }
    activeIndex = index;
    records[index].stage.setAttribute('aria-current', 'true');
    prepareWindow();
    if (autoplay) requestPlay(records[index]);
    else pause(records[index]);
    if (navigationTarget === index) navigationTarget = null;
    maybeLoadMore();
  }

  function resolveActive() {
    updateFrame = 0;
    if (tradingOpen) return;
    let best;
    let ratio = 0;
    for (const [record, visibility] of visible) {
      if (visibility > ratio) { best = record; ratio = visibility; }
    }
    if (ratio >= 0.6 && best.index !== activeIndex) setActiveIndex(best.index);
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const record = byStage.get(entry.target);
      if (entry.intersectionRatio > 0) visible.set(record, entry.intersectionRatio);
      else visible.delete(record);
    }
    if (!updateFrame) updateFrame = requestAnimationFrame(resolveActive);
  }, { root: feed, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] });

  function addEntries(entries) {
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const index = records.length;
      const stage = initialStages[index] ?? stageTemplate.cloneNode(true);
      stage.dataset.videoId = entry.id;
      stage.setAttribute('aria-label', `Video ${index + 1}`);
      stage.removeAttribute('aria-current');
      stage.querySelectorAll('video').forEach((video) => video.remove());
      const frame = stage.querySelector('.video-container');
      const poster = document.createElement('img');
      poster.className = 'video-poster';
      poster.alt = '';
      poster.decoding = 'async';
      poster.hidden = true;
      const feedback = document.createElement('div');
      feedback.className = 'media-feedback';
      feedback.hidden = true;
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'playback-action';
      action.setAttribute('aria-label', `Play or retry video ${index + 1}`);
      action.hidden = true;
      feedback.append(message, action);
      frame.prepend(poster);
      frame.append(feedback);
      const record = { entry, index, stage, frame, poster, feedback, message, action,
        sound: stage.querySelector('.sound-toggle'), video: null, pendingPlay: null, wantsToPlay: false, failed: false, time: 0 };
      record.sound.hidden = !entry.src;
      stage.querySelector('.trade-button').setAttribute('aria-label', `Trade video ${index + 1}`);
      records.push(record);
      byId.set(entry.id, record);
      byStage.set(stage, record);
      setState(record, 'unloaded', 'idle');
      if (!stage.isConnected) fragment.append(stage);
      observer.observe(stage);
    }
    feed.append(fragment);
    if (activeIndex < 0 && records.length) setActiveIndex(0);
    else prepareWindow();
    if (!tradingOpen) renderRoute();
  }

  function showPageState(state) {
    feed.setAttribute('aria-busy', String(state.loading));
    pageStatus.hidden = !state.loading && !state.error;
    pageMessage.textContent = state.error ? 'Could not load more videos.' : 'Loading more videos…';
    pageRetry.hidden = !state.error;
  }

  const source = new window.QrateFeedData({ onAppend: addEntries, onState: showPageState });

  function navigateTo(index, instant = false) {
    if (!records.length || tradingOpen) return;
    const destination = Math.max(0, Math.min(index, records.length - 1));
    if (destination !== activeIndex) pause(records[activeIndex]);
    navigationTarget = destination;
    feed.scrollTo({ top: destination * feed.clientHeight, behavior: instant || reduceMotion.matches ? 'instant' : 'smooth' });
    // The observer owns playback; asking to stay on this item must not override a manual pause.
    if (destination === activeIndex) navigationTarget = null;
  }

  // One step per wheel/trackpad burst, including its momentum tail. Native touch snap is unchanged.
  let wheel = { last: 0, total: 0, direction: 0, acted: false, until: 0 };
  listen(feed, 'wheel', (event) => {
    if (tradingOpen || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    if (!event.cancelable) return;
    event.preventDefault();
    const now = performance.now();
    const direction = Math.sign(event.deltaY);
    if ((now - wheel.last > 180 && now >= wheel.until) || direction !== wheel.direction) {
      wheel = { last: now, total: 0, direction, acted: false, until: wheel.until };
    }
    wheel.last = now;
    if (wheel.acted) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? feed.clientHeight : 1;
    wheel.total += Math.abs(event.deltaY) * unit;
    if (wheel.total < 36) return;
    wheel.acted = true;
    wheel.until = now + 450;
    navigateTo((navigationTarget ?? activeIndex) + direction);
  }, { passive: false });

  listen(feed, 'scroll', () => {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; }, 160);
  }, { passive: true });

  listen(feed, 'keydown', (event) => {
    if (tradingOpen || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    const start = navigationTarget ?? activeIndex;
    const destinations = { ArrowDown: start + 1, PageDown: start + 1, ArrowUp: start - 1, PageUp: start - 1, Home: 0, End: records.length - 1 };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    navigateTo(destinations[event.key]);
  });

  // Delegated controls and media events work for appended/recreated videos without per-item listeners.
  listen(feed, 'click', (event) => {
    const record = byStage.get(event.target.closest('.player-stage'));
    if (!record) return;
    if (event.target.closest('.trade-button')) { openTrading(record); return; }
    if (record.index !== activeIndex || !record.entry.src) return;
    if (event.target.closest('.sound-toggle')) {
      soundEnabled = !soundEnabled;
      applySound(record);
      if (record.wantsToPlay || record.stage.dataset.playbackState === 'blocked') requestPlay(record);
    } else if (event.target.closest('.playback-action')) {
      if (record.failed) { release(record); record.failed = false; prepareWindow(); }
      requestPlay(record);
    } else if (event.target instanceof HTMLVideoElement) {
      if (record.wantsToPlay) pause(record);
      else requestPlay(record);
    }
  });

  function mediaEvent(event) {
    const video = event.target;
    const record = byVideo.get(video);
    if (!record || record.video !== video) return;
    if (event.type === 'loadedmetadata' && record.time > 0 && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(record.time, Math.max(0, video.duration - 0.01));
    } else if (event.type === 'loadeddata' && record.index === activeIndex) {
      prepareWindow();
    } else if (event.type === 'error') {
      record.failed = true;
      record.wantsToPlay = false;
      setState(record, 'inactive', 'error');
    } else if (event.type === 'playing') {
      if (!canPlay(record)) { video.pause(); return; }
      setState(record, 'active', 'playing');
    } else if (event.type === 'waiting' && canPlay(record)) {
      setState(record, 'preloading', 'loading');
    } else if (event.type === 'canplay' && record.index !== activeIndex) {
      setState(record, 'ready', 'idle');
    }
  }
  for (const name of ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'error']) listen(feed, name, mediaEvent, { capture: true });

  function openTrading(record) {
    if (tradingOpen || !record) return;
    // Finish any in-flight scroll before snapshotting, rather than letting it drift behind the tab.
    feed.scrollTo({ top: record.index * feed.clientHeight, behavior: 'instant' });
    if (record.index !== activeIndex) setActiveIndex(record.index, { autoplay: false });
    history.pushState({ qrateTrade: true }, '', `#trade/${record.entry.id}`);
    renderRoute();
  }

  function renderRoute() {
    const record = records.find((item) => location.hash === `#trade/${item.entry.id}`);
    if (record) {
      if (!tradingOpen) {
        feedSnapshot = { index: record.index, height: feed.clientHeight,
          scrollTop: record.index === activeIndex ? feed.scrollTop : record.index * feed.clientHeight,
          playing: record.index === activeIndex && record.wantsToPlay, focus: document.activeElement };
      }
      tradingOpen = true;
      for (const item of attached) pause(item);
      tradingTab.dataset.videoId = record.entry.id;
      tradingTitle.textContent = `Trade — ${record.entry.title}`;
      tradingTab.hidden = false;
      document.body.classList.add('trading-open');
      backButton.disabled = false;
      backButton.focus({ preventScroll: true });
      feed.inert = navigation.inert = pageStatus.inert = true;
      document.title = `Qrate.fun — Trade ${record.entry.title}`;
      return;
    }
    if (!tradingOpen) return;
    tradingOpen = false;
    tradingTab.hidden = true;
    delete tradingTab.dataset.videoId;
    document.body.classList.remove('trading-open');
    feed.inert = navigation.inert = pageStatus.inert = false;
    document.title = 'Qrate.fun — Video';
    const snapshot = feedSnapshot;
    feedSnapshot = null;
    if (snapshot) {
      feed.scrollTo({ top: snapshot.height === feed.clientHeight ? snapshot.scrollTop : snapshot.index * feed.clientHeight, behavior: 'instant' });
      setActiveIndex(snapshot.index, { autoplay: snapshot.playing });
      const focus = snapshot.focus instanceof HTMLElement && snapshot.focus.isConnected && snapshot.focus !== document.body ? snapshot.focus : feed;
      focus.focus({ preventScroll: true });
    }
  }

  function returnToFeed() {
    if (!tradingOpen || backButton.disabled) return;
    if (history.state?.qrateTrade) { backButton.disabled = true; history.back(); }
    else {
      const url = new URL(location.href);
      url.hash = '';
      history.replaceState(null, '', url);
      renderRoute();
    }
  }
  listen(backButton, 'click', returnToFeed);
  listen(window, 'popstate', renderRoute);
  listen(window, 'hashchange', renderRoute);
  listen(document, 'keydown', (event) => {
    if (tradingOpen && event.key === 'Escape') { event.preventDefault(); returnToFeed(); }
  });

  function addPhoneSwipe(surface, direction, onSwipe) {
    let gesture;
    listen(surface, 'touchstart', (event) => {
      gesture = null;
      if (!phoneLayout.matches || event.touches.length !== 1 || event.target.closest('button, input, a')) return;
      const touch = event.touches[0];
      if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, started: performance.now(), index: activeIndex, vertical: false };
    }, { passive: true });
    listen(surface, 'touchmove', (event) => {
      if (!gesture) return;
      if (event.touches.length !== 1) { gesture = null; return; }
      const touch = event.touches[0];
      if (Math.abs(touch.clientY - gesture.y) > 12 && Math.abs(touch.clientY - gesture.y) >= Math.abs(touch.clientX - gesture.x)) gesture.vertical = true;
    }, { passive: true });
    listen(surface, 'touchend', (event) => {
      const start = gesture;
      gesture = null;
      if (!start || start.vertical || event.touches.length || start.index !== activeIndex || performance.now() - start.started > 1000) return;
      const touch = [...event.changedTouches].find((item) => item.identifier === start.id);
      if (!touch) return;
      const dx = (touch.clientX - start.x) * direction;
      if (dx < 64 || dx < Math.abs(touch.clientY - start.y) * 1.5) return;
      suppressClickUntil = performance.now() + 500;
      onSwipe();
    }, { passive: true });
    listen(surface, 'touchcancel', () => { gesture = null; }, { passive: true });
  }
  addPhoneSwipe(feed, 1, () => openTrading(records[activeIndex]));
  addPhoneSwipe(tradingTab, -1, returnToFeed);
  listen(document, 'click', (event) => {
    if (performance.now() < suppressClickUntil && event.detail !== 0) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, { capture: true });

  function replaceEntry(record, entry) {
    const previousUrl = record.entry.src;
    release(record);
    record.entry = source.replace(entry);
    record.time = 0;
    record.failed = false;
    if (ownedUrls.delete(previousUrl)) URL.revokeObjectURL(previousUrl);
  }

  listen(document.querySelector('.add-video-button'), 'click', () => picker.click());
  listen(picker, 'change', () => {
    const files = [...picker.files];
    picker.value = '';
    const videos = files.filter((file) => file.type.startsWith('video/'));
    if (!videos.length) { if (files.length) pickerStatus.textContent = 'Please choose video files.'; return; }
    for (const [index, file] of videos.entries()) {
      const url = URL.createObjectURL(file);
      ownedUrls.add(url);
      const target = index === 0 ? records[0] : records.find((record) => !record.entry.src);
      let id = target?.entry.id;
      if (!id) { do { id = `local-${++localSequence}`; } while (byId.has(id)); }
      const entry = { id, title: file.name, src: url };
      if (target) replaceEntry(target, entry);
      else source.append([entry]);
    }
    pickerStatus.textContent = `${videos.length} video${videos.length === 1 ? '' : 's'} ready to preview.${videos.length !== files.length ? ' Non-video files were skipped.' : ''}`;
    feed.scrollTo({ top: 0, behavior: 'instant' });
    setActiveIndex(0);
  });

  listen(pageRetry, 'click', () => { void source.loadMore(); });
  let resumeAfterHidden = false;
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      resumeAfterHidden = Boolean(records[activeIndex]?.wantsToPlay);
      for (const record of attached) pause(record);
    } else if (!tradingOpen) {
      prepareWindow();
      if (resumeAfterHidden) requestPlay(records[activeIndex]);
    }
  });
  if (connection) listen(connection, 'change', prepareWindow);

  // Re-anchor only after a settled resize; mobile browser chrome must not fight a touch scroll.
  let resizeTimer;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!tradingOpen && !scrolling) navigateTo(activeIndex, true);
    }, 180);
  });
  resizeObserver.observe(feed);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    lifetime.abort();
    source.destroy();
    observer.disconnect();
    resizeObserver.disconnect();
    cancelAnimationFrame(updateFrame);
    clearTimeout(scrollTimer);
    clearTimeout(resizeTimer);
    for (const record of attached) release(record);
    for (const url of ownedUrls) URL.revokeObjectURL(url);
    ownedUrls.clear();
  }
  listen(window, 'pagehide', (event) => {
    if (event.persisted) { for (const record of attached) record.video?.pause(); }
    else destroy();
  });
  listen(window, 'pageshow', (event) => {
    if (event.persisted && !tradingOpen && records[activeIndex]?.wantsToPlay) requestPlay(records[activeIndex]);
  });

  // No backend is called by default. A loader must explicitly be supplied by a future integration.
  window.qrateFeed = Object.freeze({
    appendVideos: (entries) => source.append(entries),
    setLoader: (loader, options) => { source.setLoader(loader, options); maybeLoadMore(); },
    loadMore: () => source.loadMore(),
    getState: () => ({ activeId: records[activeIndex]?.entry.id, activeIndex, tradingOpen,
      attachedVideos: attached.size, totalEntries: records.length, pagination: source.state() }),
    destroy,
  });
  source.append(initialStages.map((stage, index) => ({ id: stage.dataset.videoId, title: `Video ${index + 1}` })));
})();
