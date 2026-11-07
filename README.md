# DAIN — Original frontend + Supabase

Website: https://dain-platform.netlify.app

## Original frontend retained

The source index.html and frontend/original.html are byte-identical copies of Neha-hub-maker/DAIN-New's original frontend, Git blob 3b1c085a9282e7719572da25f777a4ff417fbecc. All original HTML, CSS, fonts, branding, dialogs and navigation markup are retained. The original logo and three Product Sans fonts are copied unchanged.

scripts/build.mjs replaces only the final application script's data/authentication hooks and writes dist/index.html. It bundles the Supabase adapter as dist/api-config.js, using the original script tag. A build check and test compare every byte outside that application script to the original. The original Tailwind CDN and inline event-handler architecture are preserved; the CSP explicitly permits those dependencies.

Behavior changes: database-backed authentication and stories, server-enforced editorial permissions, no demo privilege escalation, no fake reach/analytics, no local-only publishing, no false dispatch confirmation. The existing Media Network panel displays actual queue state and the disabled sending status. Selecting an editorial affiliation at registration never grants staff access.

## Build and deploy

Requires Node 22.12+ or compatible newer Node.

- npm ci
- npm test (builds first, then runs the tests)
- npm run dev (serves the built frontend; APIs require Netlify dev or a deployed preview)

Netlify build: npm ci && npm run build. Publish: dist. Functions: netlify/functions.
Site ID: 874432cc-5ba3-4f72-8a1e-1e388f3cfeb8.
Deployment currently uses an authorized local Netlify CLI. GitHub continuous deployment is not connected: pushing does not automatically publish. .netlify/ is ignored. No privileged credentials are committed.

## AI verification

Set these in Netlify environment variables, Functions scope, then redeploy:

- GROQ_API_KEY
- TAVILY_API_KEY
- SUPABASE_SECRET_KEY — secret/service-role key for project hfxlcvigujvyuayhzhax; never put it in frontend configuration.
- Optional GROQ_MODEL, default openai/gpt-oss-120b.

POST /api/verify accepts a submission_id with a Supabase Bearer token. The server verifies the actual user, confirmed DU email, ownership and submitted state. It loads the saved story, enforces a persistent per-user quota and an in-flight lock, extracts up to four claims through Groq, searches Tavily, optionally extracts supplied evidence, and assesses claims using retrieved excerpts.

Only exact retrieved URLs can become citations. Unsupported or submitted-domain-only evidence cannot verify claims. Provider failures return verification_pending, never approval. Results are stored by the server; clients cannot write AI verdicts. Human editorial approval and publication remain separate. AI never sends emails or grants public visibility. Author email and account details are excluded from AI prompts. AI assessment is not a guarantee of factual correctness.

GET /api/health reports configuration presence, with no secrets. Configuration presence does not prove provider credits or model availability. Live authenticated provider acceptance testing is pending until keys and a confirmed DU account are available. The owner requested deployment before adding keys.

## Newsroom distribution

Real sending is disabled by a source constant in netlify/functions/distribute.mjs, as explicitly requested. No recipient addresses are invented or scraped. No bulk, background or scheduled sender is enabled.

Publication queues jobs only for active, explicitly approved newsrooms and only when the author accepted syndication consent. Queue uniqueness prevents duplicate story/recipient jobs. An exclusive service-side claim prevents concurrent sends. The implemented Resend adapter isolates recipients, uses a stable idempotency key, records actual provider IDs, and caps retries at three.

The accepted status means the email provider accepted a request. It does not mean inbox delivery, media placement or audience reach. Failed requests are not recorded as successful.

Before enabling delivery in a later approved change:

1. Import the owner's approved newsroom list into public.newsrooms through a trusted administrator connection. Set active and approved_at only for approved recipients.
2. Configure a verified sender, RESEND_API_KEY and NEWSROOM_FROM_EMAIL as Functions secrets. Another provider requires a corresponding adapter.
3. Complete a single-recipient test with the owner, verify its receipt, then enable sending in source and redeploy.
4. Add signed provider webhooks if delivered/bounced statuses are required. Those are not implemented here.

The original public 100+ newsroom marketing copy is retained as requested. It is not evidence that 100+ recipients are configured. No newsroom contacts or measured audience reach are currently imported.

## Supabase and administration

Project: hfxlcvigujvyuayhzhax.
Applied schema source, in order: supabase/schema.sql, bootstrap_admin.sql, harden_rpc.sql, verification_distribution.sql. These are already applied; do not rerun on this project. To bootstrap another empty project, review the administrator email first.

The approved administrator email is reserved privately and receives its role only after email confirmation. The owner will create that account later. Members require confirmed DU institutional emails to submit. RLS and checked private RPC implementations enforce ownership and roles independently of the UI. Published projections exclude private evidence, account IDs and review notes.

The initial private evidence bucket remains available at the storage layer. The exact original frontend exposes an evidence-link field, not a new file-upload interface.

The owner reports SMTP and production URL settings are configured. Site URL: https://dain-platform.netlify.app. Redirect allow list: https://dain-platform.netlify.app/**. Confirmation emails should use the normal confirmation link. If the email template includes the Supabase signup OTP, the retained code-entry dialog accepts it.

Database integration tests: supabase/verify.sql and supabase/verify_distribution.sql. They check ownership, eligibility, editorial transitions, audit history, AI tamper protection, quota, recipient approval, queue uniqueness and exclusive send claims. Fixtures are rolled back.

Two private tables intentionally have RLS with no client policies. Supabase also currently recommends enabling leaked-password protection:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Boundaries

Real DUNITE SSO, newsroom placement tracking, audience-reach measurement and malware scanning are not implemented. No automatic account bypass or self-assigned editor role exists.

Original source reference: https://github.com/Neha-hub-maker/DAIN-New

## 2026-11-07 authentication, access and performance update

- Signup uses a code-only Supabase confirmation template. Recovery uses the same SMTP through Supabase resetPasswordForEmail, then verifies a recovery OTP and changes the password. The owner confirmed both link-free email templates are saved.
- Login errors are shown inside the modal, rather than behind it. Invalid evidence links and future achievement dates are rejected before saving.
- Editorial UI and private editorial database access are administrator-only. Members have a My submissions view scoped by their authenticated user ID.
- Initial UI no longer waits for Supabase calls. Role/profile queries run concurrently. AI verification is a Netlify background function: submission waits for queue acceptance, not provider results.
- Tailwind is compiled at build time with the original forms/container-query plugins. Local font preload replaces the redundant Google Sans CDN stylesheet. The displayed logo is a 4.6 KB WebP instead of the 963 KB PNG. Original source assets remain preserved.
- Static assets have CDN/browser cache headers. Verification can reuse an immutable submission's completed result for 15 minutes; it never reuses authorization decisions. Provider and verification database-stage durations are logged without story text or credentials.
- No extra Supabase Edge proxy was added: the database is already in Singapore, and direct client requests avoid an additional hop. Provider timing should guide any future regional experiment.