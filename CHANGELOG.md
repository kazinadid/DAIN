# Change log

## Repository health - 7 November 2026

- Reproduced the baseline: 11 application checks passed after npm ci.
- Replaced a historical hash pin with an integrity comparison to frontend/original.html.
- The earlier applied schema sequence also includes supabase/admin_only.sql.
- New audit remediation SQL is migration-only: never execute it against production from this chat.
- Newsroom sending remains disabled. Production release requires an authorized owner to review and apply migrations separately.
