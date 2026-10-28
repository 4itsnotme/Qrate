// Real Lightweight Charts canvas, intentionally empty until the verified candle API exists.
(() => {
  'use strict';

  const host = document.querySelector('#trading-chart');
  const message = document.querySelector('.trading-chart-message');
  let chart = null;
  let videoId = null;

  function close() {
    chart?.remove(); // Also disconnects the library's resize observer and pointer listeners.
    chart = null;
    videoId = null;
    delete host.dataset.videoId;
    host.dataset.state = 'closed';
  }

  function open(id, title) {
    if (chart && videoId === id) return;
    close();
    host.dataset.videoId = id;
    host.setAttribute('aria-label', `${title} price chart — no candle data available`);
    message.textContent = 'No price data yet.';
    try {
      const library = window.LightweightCharts;
      if (!library) throw new Error('Chart library unavailable.');
      chart = library.createChart(host, {
        autoSize: true,
        layout: { background: { type: library.ColorType.Solid, color: '#111111' }, textColor: '#999999', attributionLogo: true },
        grid: { vertLines: { color: '#1d1d1d' }, horzLines: { color: '#1d1d1d' } },
        rightPriceScale: { borderColor: '#2a2a2a', minimumWidth: 60 },
        timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      });
      const candles = chart.addSeries(library.CandlestickSeries, {
        upColor: '#46c6a0', downColor: '#ef717a', borderVisible: false,
        wickUpColor: '#46c6a0', wickDownColor: '#ef717a',
      });
      candles.setData([]);
      videoId = id;
      host.dataset.state = 'empty';
    } catch {
      close();
      host.dataset.videoId = id;
      host.dataset.state = 'error';
      message.textContent = 'Chart unavailable. Reload to retry.';
    }
  }

  window.qrateTradingChart = Object.freeze({ open, close, destroy: close });
})();
