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
