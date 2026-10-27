# Qrate — UI and Product Experience Context

> Functional interaction decisions only. Visual design system, typography, colors, spacing, complete screens and exact component layouts are **deferred to UI development**.

## Core product feel

- Video-first, fast vertical scrolling experience, inspired by established short-form video apps, with token trading seamlessly accessible.
- Avoid making the app feel like a complicated professional trading terminal.
- Accessible market-swap controls inspired by familiar Meteora/Pump.fun trading patterns, without copying another product's protected assets.

## Navigation — agreed

- **Swipe up / down:** Previous/next video in feed.
- **Swipe right on a video:** Open that video's **separate trading tab/page** (not creator profile).
- **Tap Trade:** Open exactly the same trading interface as swipe right.
- **Tap creator profile picture or username:** Open creator profile.
- **Back/swipe back:** Return to video feed where the user left off.
- Dedicated trading page layout (video preview vs chart size, etc.) is **TBD**.

## Feed and media

- MVP tabs: **For You, Trending, Following**. Simple ranking initially; more advanced ranking later.
- Consistent **9:16 video container**, accepting multiple uploaded ratios without distortion.
- Automatic quality selection and smart preloading. Playback UX must prioritize quick startup and smooth scrolling.
- Show likes, comments, shares, bookmarks and follows; detailed placement TBD.

## Trading UI

- SOL quoting, optional USD approximations; market swaps only in the MVP baseline.
- Quick amount presets **0.1 / 0.5 / 1 SOL** and custom input.
- Show estimated token amount, fees, price impact/slippage and transaction status.
- Auto slippage with optional manual controls; advanced order types not finalized.
- Live chart and trading history on token trading page; visual arrangements TBD.
- Portfolio presents holdings, value, realized/unrealized PnL and transaction history with transparent estimates.

## Token metadata presentation

- Default token name from video title; creator can edit before launch.
- Ticker auto-generated and can be visually deemphasized.
- Thumbnail extracted from video; custom thumbnails beyond MVP.

## Removed video state — approved wording

Headline: **“What happens on blockchain stays on blockchain...”**

Supporting explanation: **“This video has been removed from Qrate. Its associated token remains on Solana, and its on-chain ownership and transaction history still exist.”**

Show a public, standardized removal reason where appropriate (creator request, copyright, community guidelines, legal requirements). Preserve chart/token records where legally and technically appropriate. Do not expose sensitive moderation information. Make the blockchain permanence warning prominent in launch/purchase flows.

## Creator verification

Potential badge for linked/verified TikTok, Instagram or YouTube accounts; ownership evidence + existing external verification + follower thresholds may inform status. Exact badges and thresholds **TBD**; do not present linked accounts as platform endorsement.

## Deferred interfaces

- Detailed dashboard designs
- Creator verification flow/badges
- Video boosting
- In-app recording/editing
- Paid subscriptions
- Embeddable wallets/fiat on-ramp
- Detailed moderation and appeals UX

## Accessibility and performance expectations

- Support readable status messages, accessible tap targets, captions where possible, reduced-motion behavior and non-gesture alternatives (e.g., Trade button).
- Display loading/retry/error states accurately; never show a trade as confirmed before on-chain confirmation.
