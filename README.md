# DAIN

Live site: https://dain-platform.netlify.app · Repository: https://github.com/kazinadid/DAIN

## Frontend and build

`index.html` and `frontend/original.html` preserve the original reference from Neha-hub-maker/DAIN-New. The integrity test compares those files directly; there is no stale hash pin. The production frontend intentionally changes behavior and markup where required for security, accessibility, honest copy, and the updated submission screens. It is not byte-identical to the reference.

`scripts/build.mjs` patches the retained application, compiles Tailwind, bundles the browser adapter, compresses the logo, and calls `scripts/production-html.mjs`. That module removes demo markup, converts trusted source handlers into static event listeners, and writes external application scripts. The deployed CSP disallows inline scripts and runtime evaluation. Dynamic content is escaped; AI evidence URLs are limited to http(s). There is no GitHub image fallback and no PNG in dist.

Browser code imports auth-js and postgrest-js rather than supabase-js. Public project configuration has one default in `shared/config.mjs`, overridable with the build variables in `.env.example`. The same resolved URL supplies the CSP. No server secret belongs in a VITE_ variable.

Node 22.12+:

```sh
npm ci
npm test
npm run test:sql
npm run dev
```

`npm test` builds and runs the application/security checks without emails or paid providers. `test:sql` uses disposable embedded PostgreSQL (PGlite), applies the migration twice, and runs every verify*.sql assertion. GitHub Actions additionally uses a real PostgreSQL 16 service with Supabase auth/storage stubs. Never apply test-stubs.sql to a hosted project. Tests roll back their fixtures.

## Author and editorial workflow

- Guests read published stories. Normal users see only their own submissions, status timeline and reviewer notes. They cannot read the AI assessment columns, even through the Data API.
- Confirmed DU users can submit. Confirmed administrators may also submit using their account email. A normal account may create at most 15 stories per Bangladesh calendar day. Administrators have no daily story submission limit. A private ledger and row lock enforce the quota, including deleted drafts and concurrent requests.
- `create_and_submit_story(request_id,payload)` creates the story and audit event in one transaction. Retrying a request ID returns the existing story. Narrative must contain 80–20,000 characters. Authenticity certification and optional syndication consent are separate stored choices.
- Owners may delete drafts, read their notes, and edit/resubmit draft or changes_requested stories through checked RPCs. Statuses remain distinct: draft, submitted, changes_requested, approved, rejected and published.
- Editorial Review uses required explanatory notes and explicit confirmation. Approval is available only for submitted stories. Publication is a separate action. Administrators cannot review their own stories. Takedown removes the public projection and delivery jobs and records the reason.
- The active staff role is admin. The obsolete editor role is rejected by the database. Editorial RPCs and policies require JWT aal2; the UI provides authenticator enrollment and session verification. Guests/members never see Admin & Reach navigation.
- Profiles are created from safe display metadata on auth.users insert. Display metadata never grants privileges. User erasure cascades their stories and private records; surviving review entries anonymize erased reviewers. Storage objects require separate Auth/Storage erasure handling where uploads exist.

## Verification and performance

`POST /api/verify` is synchronous: it checks authentication, confirmed author eligibility, ownership, state and persistent quotas, reserves a run, and returns a real error or 202 with a run ID. A separate HMAC-authorized background worker performs AI/search work. It atomically claims queued work, preventing duplicate paid work from replayed requests. Clients poll their own run state every three seconds for at most 90 seconds. Authors see save/checking/error state, while assessment details are restricted to the administrator RPC.

Normal users have verification limits of five runs/minute and 45/day; every story allows at most three runs. Administrators are exempt from the per-user limits. These are AI retry protections, separate from story submission. A content/model/policy fingerprint safely reuses a matching report for 15 minutes. Changed content or model invalidates it; a worker cannot overwrite a newer edit.

Retrieved URLs are checked against the public suffix list. Sibling hostnames are one registrable domain. Verified assessments require two independent registrable domains with different excerpts, or one independent source with an excerpt matching the claim. Invented citations, private/IP targets and trailing-dot hosts are rejected. AI never approves or publishes a story. Provider errors preserve the story for human review. Timing and numeric token usage are logged without prompts or credentials.

Startup renders before data calls. Account information is cached briefly and invalidated by auth events. Independent role/profile queries run concurrently. Queries select bounded columns and 20-row pages; long narrative loads only on detail. Published-headline search and sector filters operate on the database. Hashed/static assets use cache headers; private API responses use no-store. Dark mode persists as an appearance preference, with reduced-motion styles, native modal focus handling, live feedback, and mobile editorial/submission cards.

No extra Supabase Edge proxy was added: the project is in Singapore and another proxy would add a hop without evidence of benefit. Use the timing logs to decide whether a regional experiment is justified.

## Schema and administration

Historical applied source order: `supabase/schema.sql`, the now-retired `bootstrap_admin.sql`, `harden_rpc.sql`, `verification_distribution.sql`, **`admin_only.sql`**. Do not rerun these historical scripts on the existing project.

New changes are idempotent files in `supabase/migrations/`, in filename order. `20261107093000_workflow_hardening.sql` drops the old email-based bootstrap trigger/table. Existing admin grants are retained; nobody receives admin because they claim or change to a special email. The owner explicitly authorized applying this migration during the 7 November release.

To grant a new administrator, verify the person's confirmed account and copy their UUID from Supabase Authentication. A trusted project owner may then run this reviewed manual operation with the actual UUID:

```sql
insert into private.staff(user_id,role) values ('<confirmed-user-uuid>','admin')
on conflict(user_id) do update set role='admin';
```

The person must then sign in and complete authenticator MFA. Never put personal administrator emails in migrations. New administrator grants are a separate access decision.

## Hosting and manual settings

Netlify publishes dist, builds with `npm ci && npm run build`, and bundles netlify/functions. GitHub is connected. Some builds have been blocked by Netlify's private-repo contributor approval; the owner CLI can publish the tested build. A later successful main-branch build replaces a manual release with that branch's version. `.netlify/` remains ignored.

The Netlify badge is disabled in the project's `built_with_badge_enabled` setting, for all visitors. The strict CSP also prevents its injected inline script from rendering.

Functions-only secrets (never commit values):

- GROQ_API_KEY, TAVILY_API_KEY, SUPABASE_SECRET_KEY
- VERIFICATION_WORKER_SECRET: random secret of at least 32 characters, generated and configured for this release
- Optional GROQ_MODEL (default openai/gpt-oss-120b)

Optional build-only public variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY; VITE_TURNSTILE_SITE_KEY when enabling CAPTCHA. Redeploy after changing build configuration. `/api/health` reports presence only, not provider credits or delivery guarantees.

Supabase dashboard checklist:

1. Keep custom SMTP and production Site URL/redirect allow list configured. Confirm-signup template: `Your DAIN verification code is {{ .Token }}`. Reset-password template: `Your DAIN password reset code is {{ .Token }}`. No ConfirmationURL or email links. The owner previously confirmed these templates.
2. Enable [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) if available on the project plan. The pre-release advisor still reported it disabled; this setting cannot be changed by the connected database tool.
3. To enable [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), provision Turnstile, add its public site key to the Netlify build environment and deploy, then enable Turnstile with its secret in Supabase Auth. The optional client integration covers signup, password login and reset requests. Do not enable the dashboard setting before the matching client/key is deployed.
4. Administrators must enroll their own [authenticator MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp) through Editorial Review and keep recovery access safe. No passwords, QR codes or OTPs should be shared in chat.
5. Revoke sessions before an account erasure, remove any owned Storage objects, then erase the Auth user. Database foreign keys now allow the associated row cleanup.

## Distribution remains disabled

`SENDS_ENABLED=false` is a source constant in distribute.mjs. No scheduled sender, emails, scraped recipients or invented reach metrics are enabled. The media panel shows real configured recipient/job state, not marketing claims. Preparing a queue requires publication, explicit syndication consent and active approved newsroom recipients. Queue uniqueness and exclusive claims prevent duplicate delivery attempts. Takedown removes pending jobs with its public story.

Future delivery enablement needs separate approval, the owner's approved recipient list and verified sender/provider configuration. Provider acceptance is not inbox delivery, placement, or audience reach. Those measurements and signed delivery webhooks are not implemented.
