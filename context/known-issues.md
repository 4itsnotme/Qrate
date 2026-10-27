# Qrate — Known Issues, Incidents and Open Risks

> This is a tracker, **not a claim that bugs have been observed**. Populate actual incidents only when supported by logs/reproduction steps.

## Confirmed bugs

**None recorded from inspected source.** Repository audit has not occurred for this documentation pass.

## Known architectural questions / risks (not confirmed bugs)

| ID | Area | Concern | Status / action |
|---|---|---|---|
| R-001 | Publishing | Whether video must be public before launch, or token launched with publication | **TBD product decision** |
| R-002 | Token permanence | Deleting video does not erase token; explain removal and trading-state behavior | Policy decided; implementation unverified |
| R-003 | Meteora fees | Validate 1.9% fees and 60/40 split against actual DBC/DAMM v2 configuration | Verification needed |
| R-004 | Fee claims | Ensure Qrate never holds creator earnings or has signing authority over user trading assets | Design/security review |
| R-005 | Refundable deposit | Ensure creator refund doesn't imply reversible chain fees or user-fund custody | Economics/implementation TBD |
| R-006 | Market data | WebSocket gaps, duplicate tx handling, DBC-to-DAMM migration | Build/test reconciliation |
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
