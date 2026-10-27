# Qrate — AI Coding Agent Workflow

> Official project collaboration rules approved across the 12-step planning process.

## Operating principle

**Inspect → research → explain → plan → approve major decisions → implement one scoped change → verify/review → document → commit.** Do not claim completion without evidence.

## Step 1 — Know the product

- Read `project-overview.md`, current scope and open decisions before editing.
- Understand user types, creator/trader journeys, failures and explicit non-goals.
- Do not promote TBD product decisions into finalized behavior.

## Step 2 — Respect responsibility boundaries

- Read `architecture.md`; identify services and modules already in the repository.
- Determine ownership of auth, wallet authorization, video, data, token creation, swaps, history, fees, and moderation before coding.

## Step 3 — Honor invariants

- Enforce `code-standards.md` and never compromise self-custody, on-chain truth, permission boundaries, or publishing safety.

## Step 4 — Build vs integrate

- Build Qrate-specific video/speculation UX, business logic and application integrations.
- Prefer appropriate established services for encoding, hosting, RPC, databases and wallet connectors.
- Avoid vendor lock-in via adapters/interfaces where justified.

## Step 5 — Permanent project context

- The eight `/context` files are the shared source of architectural knowledge, **not** long chat history.
- Update files after decisions, successful features, architecture changes and discovered limitations.

## Step 6 — Small development tasks

- Break modules into independently reviewable, testable tasks.
- Keep roadmap order from `progress.md` as the current preference, with minimum technical prerequisites handled earlier.

## Step 7 — Feature specifications

### Standard spec (small features)

1. Goal and user outcome
2. In-scope and explicitly out-of-scope behavior
3. Functional requirements / acceptance criteria
4. Dependencies and existing components
5. Proposed implementation and touched files
6. Verification and expected failure cases
7. Documentation to update

### Extended spec (critical or complex work)

Include all 13 categories:

1. Goal
2. Scope / exclusions
3. Requirements
4. Dependencies
5. Implementation
6. Data flow
7. Failure handling
8. Security / authorization
9. Verification / acceptance criteria
10. Performance targets
11. Cost impact
12. Rollback plan
13. Documentation changes

Use extended specs for trading, wallets, token launching, market indexing, video processing, fee distribution and other critical operations. A successful build is **not** sufficient proof of completion.

## Step 8 — Mandatory research and inspection before coding

1. Read relevant project documentation.
2. Inspect actual repository architecture, related files and working paths.
3. Research relevant **GitHub repositories**, prioritizing official implementations.
4. Read current official documentation/changelogs and confirm installed SDK/API versions.
5. Review licenses and compatibility before reusing outside source code; never copy blindly.
6. Identify existing reusable code, APIs and packages; don't create competing systems.
7. Explain in **plain English** how the existing feature works and proposed feature should work.
8. Map the directory structure, file responsibilities, entry points, dependencies and data flows in `codebase-map.md`.
9. Identify potential side effects, regression risks, external limits, ambiguity and architecture conflicts.
10. Compare relevant alternatives and recommend the simplest reliable option.
11. Present the concrete implementation plan and affected files **before significant changes**.
12. Obtain user approval before major architectural changes, destructive migrations, new custodial powers, broad refactors or new financial behaviors.
13. Verify functions/endpoints exist, rather than guessing signatures.
14. Avoid unapproved dependencies and unnecessary rewrites.
15. Create a Git checkpoint for major changes.
16. After implementation explain **what changed, where, how it works, and how to test it**, and update the map.

Useful research starting points (inspect current versions/terms):
- https://github.com/MeteoraAg/dynamic-bonding-curve-sdk
- https://github.com/MeteoraAg/damm-v2-sdk
- https://github.com/tradingview/lightweight-charts
- https://github.com/supabase/supabase

These are references, not proof that particular package APIs or licenses fit the installed stack.

## Step 9 — Implementation rules

1. Work on one scoped task at a time.
2. Implement approved requirements only.
3. Reuse functioning code and patterns.
4. Make incremental, reviewable diffs.
5. Respect repository architecture.
6. Write clear, maintainable, strongly typed code where supported.
7. Handle errors, timeouts and untrusted input.
8. Protect keys, wallets, and permissions.
9. Run relevant checks continuously.
10. Never report success without verification.
11. Test regressions.
12. Update project docs and progress.
13. Teach the user what changed and how to test it.
14. Present unapproved improvements as separate proposals.
15. Report blockers, failures, and unfinished work openly.
16. Never experiment with real user funds; test token and wallet paths in controlled settings.
17. Separate completed, verified features into descriptive Git commits when appropriate.

## Step 10 — Verify and review

1. Build succeeds.
2. Feature works against its spec.
3. Existing features still work.
4. No new authorization/secrets/wallet vulnerabilities.
5. Edge cases and outages are covered.
6. CPU, memory, latency and external usage are evaluated where relevant.
7. On-chain signatures, balances, status and math are checked for blockchain paths.
8. Diff is reviewed for needless complexity and duplicate logic.
9. Seek an independent review for critical work when practical.
10. Update documentation.
11. Commit coherent verified changes.
12. Report passes, failures, and untested paths accurately.

Wallets, Meteora trading, token launches and financial math require elevated review before mainnet. Untested != verified.

## Step 11 — Debug with discipline

1. Investigate root cause before modifying code.
2. Reproduce the bug where possible.
3. Inspect logs, traces and errors.
4. Trace dependent components.
5. Read current official documentation and relevant GitHub issues.
6. Prefer minimal root-cause fixes.
7. Fix one unrelated bug at a time.
8. Do not introduce fragile temporary hacks as permanent solutions.
9. Re-run functional and regression tests.
10. Record cause, fix and preventive steps in `known-issues.md` as appropriate.
11. Explain the fix in plain English.
12. Escalate uncertainty instead of guessing in security/financial code.

Special safeguards: verify ambiguous on-chain transactions before retries; reconcile market-data gaps idempotently; investigate streaming buffering/bandwidth; never debug by using real customers' funds.

## Step 12 — Documentation and dependency hygiene

1. Prefer official/current source documentation.
2. Confirm installed dependency versions.
3. Research maintained GitHub implementations.
4. Check API and SDK compatibility with the real stack.
5. Keep dependencies minimal and coherent.
6. Check dependency security advisories.
7. Never upgrade major versions blindly.
8. Pin/reproduce versions using the project's lockfile.
9. Record integration requirements, credentials model, rate limits and pricing.
10. Track technical debt and upgrade opportunities.
11. Test externally sourced examples before declaring them operational.
12. Maintain relevant context documents continuously.

Qrate-specific checks: current Meteora DBC/DAMM v2 SDKs, Helius RPC/WebSocket limits, video platform transcoding/billing, Solana SDK compatibility, and zero secrets in context documents.

## Agent output template

After each task return concise sections:

- **Existing behavior:** verified code path(s) and files
- **Change:** concrete files/components updated
- **How it works:** plain-English data flow
- **Tests performed:** exact commands and outcomes
- **Known gaps:** failed/untested scenarios or TBD decisions
- **Next task:** small recommended continuation
