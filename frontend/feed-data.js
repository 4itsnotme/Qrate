// Feed data stays independent of media playback. A future API only supplies loadPage.
(() => {
  'use strict';

  function mediaUrl(value) {
    if (!value) return '';
    if (typeof value !== 'string') throw new TypeError('Media URL must be a string.');
    const url = new URL(value, document.baseURI);
    if (!['http:', 'https:', 'blob:', 'file:'].includes(url.protocol)) {
      throw new TypeError('Unsupported media URL.');
    }
    return url.href;
  }

  class FeedData {
    constructor({ onAppend, onState }) {
      this.entries = new Map();
      this.onAppend = onAppend;
      this.onState = onState;
      this.loader = null;
      this.cursor = null;
      this.hasMore = false;
      this.loading = false;
      this.error = false;
      this.generation = 0;
      this.pending = null;
      this.controller = null;
    }

    normalize(entry) {
      if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(entry.id)) {
        throw new TypeError('Feed entries need a unique, URL-safe video ID.');
      }
      return Object.freeze({
        id: entry.id,
        title: typeof entry.title === 'string' ? entry.title : 'Video',
        src: mediaUrl(entry.src),
        poster: mediaUrl(entry.poster),
      });
    }

    append(entries) {
      if (!Array.isArray(entries)) throw new TypeError('Feed entries must be an array.');
      // Validate the full page before changing anything; malformed pages cannot partly append.
      const normalized = entries.map((entry) => this.normalize(entry));
      const added = [];
      for (const entry of normalized) {
        if (this.entries.has(entry.id)) continue;
        this.entries.set(entry.id, entry);
        added.push(entry);
      }
      if (added.length) this.onAppend(added);
      return added.length;
    }

    replace(entry) {
      const normalized = this.normalize(entry);
      if (!this.entries.has(normalized.id)) throw new TypeError('Cannot replace an unknown video.');
      this.entries.set(normalized.id, normalized);
      return normalized;
    }

    state() {
      return { loading: this.loading, error: this.error, hasMore: this.hasMore };
    }

    setLoader(loader, { cursor = null, hasMore = true } = {}) {
      if (loader !== null && typeof loader !== 'function') throw new TypeError('loadPage must be a function.');
      this.controller?.abort();
      this.generation += 1;
      this.pending = null;
      this.loader = loader;
      this.cursor = cursor;
      this.hasMore = Boolean(loader && hasMore);
      this.loading = false;
      this.error = false;
      this.onState(this.state());
    }

    loadMore() {
      if (this.pending) return this.pending;
      if (!this.loader || !this.hasMore) return Promise.resolve(0);
      const generation = this.generation;
      const cursor = this.cursor;
      const controller = new AbortController();
      const loader = this.loader;
      this.controller = controller;
      this.loading = true;
      this.error = false;
      this.onState(this.state());
      // Defer invocation until pending is set, so synchronous providers cannot start a second request.
      this.pending = Promise.resolve().then(() => loader({ cursor, signal: controller.signal })).then((page) => {
        if (generation !== this.generation || controller.signal.aborted) return 0;
        if (!page || !Array.isArray(page.items) || typeof page.hasMore !== 'boolean' ||
            (page.hasMore && (typeof page.nextCursor !== 'string' || page.nextCursor === cursor))) {
          throw new TypeError('Invalid feed page or non-advancing cursor.');
        }
        const count = this.append(page.items);
        this.cursor = page.nextCursor ?? null;
        this.hasMore = page.hasMore;
        return count;
      }).catch(() => {
        if (generation === this.generation && !controller.signal.aborted) this.error = true;
        return 0;
      }).finally(() => {
        if (generation !== this.generation) return;
        this.loading = false;
        this.pending = null;
        this.onState(this.state());
      });
      return this.pending;
    }

    destroy() {
      this.controller?.abort();
      this.generation += 1;
      this.pending = null;
    }
  }

  window.QrateFeedData = FeedData;
})();
