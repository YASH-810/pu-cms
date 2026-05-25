# Database Layer

This backend uses Knex for PostgreSQL migrations and low-level database access.

Approved Phase 0 migration tool: Knex.

Environment selection is driven by `NODE_ENV` and `DATABASE_URL`.

Migration commands:

```bash
npm run db:migrate
npm run db:rollback
npm run db:status
```

Phase 0 only configures the database layer. Schema migrations begin in Phase 1.
