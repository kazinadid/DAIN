# DAIN — DUNITE Achievement & Impact Network

Clean Supabase rebuild for the Dhaka University community. No legacy user data is imported.

## Stack

- Vite and modular JavaScript; responsive navy/gold DUNITE visual system.
- Supabase Auth for email confirmation, login, logout and password recovery.
- PostgreSQL with RLS, protected editorial roles, checked transactional RPCs and immutable review history.
- Private Supabase Storage evidence bucket, 5 MB PDF/JPEG/PNG/WebP limit.
- Netlify static hosting; build command `npm ci && npm run build`, publish directory `dist`.

## Implemented workflow

1. A user registers with a DU institutional email, confirms it and signs in.
2. They create/edit a draft, attach private evidence and submit it for review.
3. An assigned editor approves, rejects or requests changes with a note. Editors cannot review their own stories.
4. Approval and publication are separate actions. Only published projections are publicly readable.
5. A public story page supports copying its link, printing, and downloading a text press kit.

The member workspace contains only the signed-in member's stories. The editorial desk shows permitted submissions. File access is enforced at the storage layer, not by hiding UI controls.

## Local development

Requires Node 22.12+ (or a Vite-compatible newer Node).

```sh
npm ci
npm run dev
npm test
npm run build
```

The default URL and publishable key target project `hfxlcvigujvyuayhzhax`. These are public client configuration, not privileged credentials. Override through `.env` using `.env.example` when targeting another project. Never put a service-role key in frontend code.

## Database

`supabase/schema.sql` is the exact baseline applied to the empty hosted project using migration `dain_initial_schema`. Do not run it again on that project. Future changes must be additive migrations. The schema file is a reproducible bootstrap for another empty project.

Run `supabase/verify.sql` through a trusted SQL connection for integration checks. It tests owner isolation, non-DU rejection, direct publication denial, editorial approval/publication transitions, audit history and anonymous access. Fixtures are enclosed in a transaction and rolled back.

## Required account configuration before inviting members

In Supabase Authentication → URL Configuration:

- Site URL: `https://dain-platform.netlify.app`
- Redirect allow list: `https://dain-platform.netlify.app/**` and `http://127.0.0.1:5173/**` for local development.
- Keep email confirmation enabled.
- Configure a real SMTP provider for delivery to DU members. Supabase's built-in development mail service may restrict recipients and has low limits.

To bootstrap a specific approved administrator, create/confirm that user's Auth account, then a trusted project administrator can execute:

```sql
insert into private.staff(user_id, role)
select id, 'admin' from auth.users
where lower(email) = lower('REPLACE_WITH_APPROVED_ADMIN_EMAIL')
  and email_confirmed_at is not null
on conflict (user_id) do update set role = excluded.role;
```

Staff records are protected from public clients. User-editable metadata never grants roles. No first-user-is-admin shortcut exists. Editors with non-DU emails can sign in when their account is provisioned by an administrator; self-registration in the website is restricted to DU addresses.

## Security notes

`private.staff` intentionally has RLS with no client policies. `my_role`, `submit_story` and `review_story` are deliberately privileged API functions, with empty search paths and explicit identity/role/ownership/transition checks. Supabase's advisor may flag their authenticated execution; this access is required for the workflow and covered by integration tests. Anonymous execution is revoked.

Evidence never appears in the public story projection. It is served only through authorized short-lived signed URLs. Files use generated names. This release enforces size/MIME restrictions; malware scanning is not yet integrated.

## Remaining release work

- Configure/verify production SMTP and auth redirect settings.
- Provision and assign the approved administrator and editor accounts.
- Complete a real-email browser acceptance test including evidence upload/download.
- Optional automated Groq/Tavily claim verification is not connected in this build. No story is labeled AI-verified. Editorial review is the current verification step.
- Newsroom distribution, real DUNITE SSO, malware scanning, and notification emails are not implemented.
- Hash-based public routes are suitable for this first preview; server-rendered story URLs/social metadata should be added before a media-facing launch.

The old repository remains a functional reference at https://github.com/Neha-hub-maker/DAIN-New. This code is a fresh implementation.
