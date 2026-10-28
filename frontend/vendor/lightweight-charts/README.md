# Lightweight Charts browser bundle

- Version: **5.2.1**, unmodified standalone production IIFE (includes dependencies).
- Upstream: https://github.com/tradingview/lightweight-charts/tree/v5.2.1
- Published bundle: https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js
- SHA-256: `e21cc5caa0226ef30bd8549c50b9ef926615f2a4ee6b4e486353477a55f598cf`
- License: Apache-2.0; upstream `LICENSE` and `NOTICE` are retained here. Page attribution and built-in TradingView attribution remain visible.
- Included `fancy-canvas@2.1.0` uses MIT; its upstream notice is retained as `LICENSE.fancy-canvas` (tag `2.1.0`, commit `7ece7601f05b624496f485cee65789ad691427df`).

The existing local 5.2.1 bundle was compared byte-for-byte with the pinned published distribution before copying. This tracked asset makes the buildless/file:// frontend reproducible without depending on ignored node_modules or a runtime CDN. No npm installation or backend dependency changes were needed. Review license/API compatibility and update the recorded hash when changing this asset.
