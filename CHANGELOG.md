# Change log

## Repository health - 7 November 2026

- Reproduced the baseline: 11 application checks passed after npm ci.
- Replaced a historical hash pin with an integrity comparison to frontend/original.html.
- The earlier applied schema sequence also includes supabase/admin_only.sql.
- New audit remediation SQL is migration-only: never execute it against production from this chat.
- Newsroom sending remains disabled. Production release requires an authorized owner to review and apply migrations separately.

## Workflow and security - 7 November 2026

- Atomic, idempotent creation/submission; private daily quota ledger: 15 new stories per normal account per Bangladesh day, no administrator submission cap.
- Owner-only draft deletion and edit/resubmit; complete narrative, separate certification and syndication consent, explicit status timeline and reviewer notes.
- Administrator-only review actions with required notes; approval and publication are separate; audited takedown and user-erasure foreign keys.
- Removed email bootstrap and inactive editor role. Existing administrators remain; new grants use reviewed confirmed user UUIDs. Editorial access requires MFA, with an authenticator setup/session UI.
- Synchronous verification gateway, signed background worker, bounded status polling, retry/day protections, public-suffix independence checks, safe cache keys and token/timing logs.
- Strict script CSP, no inline handlers, no third-party logo fallback. Optional Turnstile integration for login/signup/reset.
- The owner subsequently authorized production migration application, replacing the earlier restriction recorded above.

## Frontend and performance - 7 November 2026

- Styled My Submissions like Editorial Review, with mobile cards and author details that exclude AI assessment data at the database permission layer.
- Dark/light appearance control, persistent preference, readable dialog/card states and reduced-motion support.
- Admin navigation hidden from guests and normal accounts; visible errors for network, permission, form, recovery and load failures.
- Fixed the inactive headline-search input and added bounded database pagination/filtering. Cached account reads and concurrent independent queries reduce repeat requests.
- Compiled CSS, local fonts, compressed logo, smaller browser adapter and no shipped demo data/PNG/duplicate identity cache.
- Disabled the hosting badge globally and replaced invented newsroom/reach figures with real queue state. Sending remains disabled.

## Continuous integration - 7 November 2026

- Added npm install/test checks and a disposable PostgreSQL 16 service with Supabase stubs.
- Migrations are applied twice for idempotency, then all SQL assertion scripts run. Local embedded PostgreSQL provides the same assertion workflow without Docker.
- No test sends emails or contacts AI providers. Actual inbox OTP and administrator authenticator enrollment still require the account owner's manual verification.

## Administrator sign-in update - 7 November 2026

- Removed the authenticator requirement at the owner's request. Signed-in administrators can open Editorial Review, Media Network and Analytics directly.
- Removed enrollment/challenge UI and unused browser MFA calls. Database policies and server gates still require the protected administrator role.
- Added an idempotent migration and assertions proving admins can access editorial features at aal1 while members and anonymous users remain blocked.

## 2026-11-07 — Dark theme and evidence review

- Replaced incomplete dark overrides with coordinated canvas, surface, text, form, dialog, navigation, and status colors. Fixed the pale hero and loading surfaces, added device-theme selection, cross-tab theme synchronization, and visible keyboard focus.
- Removed artificial full-screen navigation delays. Sector pages now fetch paginated results instead of filtering only the first page. Stale failed searches cannot overwrite a newer result. Added stable pagination ordering and bounded verification requests.
- Verification v3 uses neutral and official-results searches, a batched assessment, exact quoted evidence, entity/event/date checks, independent-source gates, and explicit missing-context explanations. Keyword overlap and generic pages no longer establish verification. Confidence percentages are omitted from reports.
- Added owner/admin retry controls, persisted checking status, evidence reports in editorial decision dialogs, and separate publication acknowledgement. Failed checks are not reused as successful cache hits. Workers stay within their deployment environment and retain signed authorization.
- Added resend-code cooldown, external AI processing notice, offline feedback, complete press-kit copying, safe draft storage access, local-preview UUID compatibility, and keyboard skip navigation.
- Validation: production build and 26 automated tests; disposable database permission/workflow assertions; desktop browser review of dark/light landing, authentication dialog, and public browsing. Live authenticated provider verification remains a separate production check.
