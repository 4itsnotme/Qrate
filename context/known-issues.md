# Qrate — Known Issues, Incidents and Open Risks

> This is a tracker, **not a claim that bugs have been observed**. Populate actual incidents only when supported by logs/reproduction steps.

## Confirmed bugs

The original repository audit was completed on 2026-10-27. No new unresolved decoder defect was observed in the covered stage-2 tests; coverage limits below remain open work, not production-readiness claims.

## Verified implementation limits — 2026-10-28

- Supported decoding is restricted: standard DBC/WSOL and DAMM token-A/WSOL-token-B exact-input swaps. Transfer fees/hooks, referrals, compounding, other quote currencies/orientations/modes and unknown optimized instructions remain unsupported and are explicitly rejected.
- Market collection now uses durable finalized jobs, exact trade deduplication and persisted recovery cursors. Initial coverage is the latest 100 signatures; older lifetime history is not collected. Missing/pruned checkpoint anchors are reported as gaps, not silently skipped. Sustained Mainnet throughput remains unverified; monitor pending jobs and recovery status.
- The legacy raw observer still has in-memory queue/deduplication (1,000 pending / 10,000 recent signatures), without durable recovery. Use `market:listen` / `market:recover` for the new storage path. Native SQLite requires Node >=22.13.0.
- Verified migration following is implemented and locally tested, including restart and destination recovery beyond 100 signatures. If old migration evidence falls outside DBC bootstrap, supply `--migration-signature`; a matching mint alone cannot establish a link. Active standalone destination collection must stop before extending its coverage. Sustained live Mainnet graduation/recovery remains unverified; fresh historical DAMM inspection passed.
- Market schema 2 adds migration tracking transactionally. Read-only status cannot upgrade schema 1; use a writable collection/recovery run. Older runtime versions deliberately refuse schema 2. Legacy `qrate.sqlite` remains separate.
- Ignored old analytics builds still have missing source/incompatible exports and must not be deployed as a complete server. Local PumpSwap records/artifacts are preserved, not adopted as product integrations.
- Windows tool restrictions can block npm.ps1 and default Node test subprocess isolation. npm.cmd and direct `node --test --test-isolation=none` work in this session; no execution policy was changed.

## Known architectural questions / risks (not confirmed bugs)

| ID | Area | Concern | Status / action |
|---|---|---|---|
| R-001 | Publishing | Whether video must be public before launch, or token launched with publication | **TBD product decision** |
| R-002 | Token permanence | Deleting video does not erase token; explain removal and trading-state behavior | Policy decided; implementation unverified |
| R-003 | Meteora fees | Validate 1.9% fees and 60/40 split against actual DBC/DAMM v2 configuration | Verification needed |
| R-004 | Fee claims | Ensure Qrate never holds creator earnings or has signing authority over user trading assets | Design/security review |
| R-005 | Refundable deposit | Ensure creator refund doesn't imply reversible chain fees or user-fund custody | Economics/implementation TBD |
| R-006 | Market data | WebSocket gaps, duplicate tx handling, DBC-to-DAMM migration | Restricted DBC/DAMM decoding, durable recovery and verified migration following locally tested; sustained Mainnet transitions/throughput and provider omissions remain unverified |
| R-007 | Video costs | Preloading and provider billing could increase effective cost per view | Benchmark providers |
| R-008 | Moderation | Prelaunch checking and appeals vs irreversible on-chain token | Workflow TBD |
| R-009 | Compliance | EU MiCA/CASP, public token offers, App Store crypto and UGC policy | Obtain jurisdiction-specific legal review |
| R-010 | Wallet model | Embedded wallet feature must not grant Qrate unilateral signing authority | Vendor/architecture TBD |

## Actual bug report template

```md
### ISSUE-### — [Short descriptive title]
- Status: new / investigating / fixed / verified / deferred
- Severity and affected systems:
- Expected behavior:
- Actual behavior:
- Steps to reproduce:
- Logs, errors, transaction signatures (redacted safely):
- Root cause (verified / suspected):
- Fix and changed files:
- Tests and regression checks performed:
- Rollback plan:
- Prevention / monitoring:
- Commit / owner / date:
```

## Debugging rules

- Reproduce, investigate and trace affected code before changing anything.
- Prefer one scoped root-cause fix rather than a broad guess-driven rewrite.
- Verify on-chain status before re-submitting ambiguous transactions.
- Deduplicate and backfill missing market data deterministically.
- Evaluate video buffering and bandwidth with measured data.
- Never test experimental fixes using live customers' funds.
- Explain failures and uncertain conclusions accurately.
