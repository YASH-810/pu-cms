# PUCMS SQL Integration Notes

Source reviewed: `C:\Users\deepa\Downloads\pucms.sql`.

The dump is a PostgreSQL 18 export using integer primary keys and module-specific tables such as `blog_media`, `event_media`, and `announcement_organizations`.

The approved application architecture uses UUID primary keys and universal polymorphic tables:

- `media`
- `entity_organizations`
- `entity_owners`
- `entity_approval_logs`
- `entity_audit_logs`

For Phase 1, the dump was used as a reference source for table coverage and initial content type concepts. It was not imported directly because doing so would conflict with the approved UUID/polymorphic schema.

Later phases can add data import scripts that transform dump rows into the new schema instead of restoring the dump verbatim.
