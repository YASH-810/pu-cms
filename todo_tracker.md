# University CMS Todo Tracker

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Phase 0: Repository and Bootstrap Planning

### Implementation Tasks

- [x] Confirm Angular v21.2.14 frontend project structure.
- [x] Confirm Fastify v5.8.5 backend project structure.
- [x] Confirm AWS PostgreSQL target: RDS PostgreSQL or Aurora PostgreSQL.
- [x] Select and document the database migration tool.
- [x] Define local, staging, and production environment configuration strategy.
- [x] Define API response and error format.
- [x] Define route naming conventions for admin and public APIs.
- [x] Define module, permission, status, and table naming conventions.

### Validation Tasks

- [x] Verify frontend, backend, and database can be initialized consistently.
- [x] Verify environment secrets are not committed.
- [x] Verify planning documents match the SRS assumptions.

### Documentation Tasks

- [x] Document repository setup commands.
- [x] Document environment variables.
- [x] Document initial architecture decisions.

## Phase 1: PostgreSQL Schema Initialization

### Implementation Tasks

- [x] Create schema migration plan.
- [x] Define common audit columns: `created_at`, `created_by`, `updated_at`, `updated_by`.
- [x] Define soft-delete convention using `deleted_at` or `status = 'archived'`.
- [x] Create `users`.
- [x] Create `roles`.
- [x] Create `user_roles`.
- [x] Create `permissions`.
- [x] Create `role_permissions`.
- [x] Create `user_scope_permissions`.
- [x] Create `user_login_logs`.
- [x] Create `organizations`.
- [x] Create `organization_relations`.
- [x] Create `user_organization_roles`.
- [x] Create `content_types`.
- [x] Create `pages`.
- [x] Create `blogs`.
- [x] Create `events`.
- [x] Create `achievements`.
- [x] Create `announcements`.
- [x] Create `announcement_types`.
- [x] Create `stories`.
- [x] Create `club_details`.
- [x] Create `categories`.
- [x] Create `tags`.
- [x] Create `entity_categories`.
- [x] Create `entity_tags`.
- [x] Create `media`.
- [x] Create `seo_metadata`.
- [x] Create `entity_organizations`.
- [x] Create `entity_owners`.
- [x] Create `entity_approval_logs`.
- [x] Create `entity_audit_logs`.
- [x] Create `notifications`.
- [x] Create `saved_drafts`.
- [x] Create `entity_views`.
- [x] Add FK indexes.
- [x] Add unique constraints for emails, slugs, mapping tables, role names, permission codes, and content type identifiers.
- [x] Add JSONB fields for audit snapshots, draft payloads, and schema metadata.
- [x] Add enum or check constraints for workflow statuses.
- [x] Plan monthly or yearly partitioning for `entity_views`, `entity_audit_logs`, `notifications`, and `user_login_logs`.
- [x] Seed roles: `SUPER_ADMIN`, `UNIVERSITY_ADMIN`, `SCHOOL_ADMIN`, `EDITOR`, `REVIEWER`, `CONTENT_CREATOR`.
- [x] Seed sample permissions: `CREATE_PAGE`, `UPDATE_PAGE`, `DELETE_PAGE`, `PUBLISH_PAGE`.
- [x] Seed sample permissions: `CREATE_BLOG`, `UPDATE_BLOG`, `DELETE_BLOG`, `PUBLISH_BLOG`.
- [x] Seed sample permissions: `CREATE_EVENT`, `UPDATE_EVENT`, `DELETE_EVENT`, `PUBLISH_EVENT`.
- [x] Seed sample permissions: `MANAGE_MEDIA`, `MANAGE_USERS`, `MANAGE_ROLES`, `REVIEW_CONTENT`, `APPROVE_CONTENT`, `MANAGE_SEO`.
- [x] Seed content types: `page`, `blog`, `event`, `achievement`, `announcement`, `story`, `club`.
- [x] Grant all permissions to `SUPER_ADMIN`.

### Validation Tasks

- [x] Verify all migrations run on a clean database.
- [x] Verify rollback strategy for migrations.
- [x] Verify FK constraints prevent orphaned records.
- [x] Verify unique constraints prevent duplicates.
- [x] Verify seed data is idempotent.
- [x] Verify PostgreSQL-specific features are supported in the selected AWS database target.

### Documentation Tasks

- [x] Document schema groups and table responsibilities.
- [x] Document seed roles and permissions.
- [x] Document migration workflow.

## Phase 2: Google OAuth Authentication

### Implementation Tasks

- [x] Configure Google OAuth client credentials.
- [x] Implement Google OAuth login route.
- [x] Implement OAuth callback route.
- [x] Validate returned Google email against `users.email`.
- [x] Block login for unknown users.
- [x] Block login for inactive users.
- [x] Block login for soft-deleted users.
- [x] Create session or JWT after successful login.
- [x] Insert successful login record into `user_login_logs`.
- [x] Update `users.last_login_at`.
- [x] Implement current-user context endpoint.
- [x] Return user roles, organization roles, permissions, and scope data in current-user context.

### Validation Tasks

- [x] Verify existing active user can log in.
- [x] Verify unknown Google email is rejected.
- [x] Verify inactive user is rejected.
- [x] Verify soft-deleted user is rejected.
- [x] Verify successful login writes `user_login_logs`.
- [x] Verify password login is not exposed in v1.

### Documentation Tasks

- [x] Document Google OAuth setup.
- [x] Document session/JWT strategy.
- [x] Document login failure behavior.

## Phase 3: RBAC and Scoped Authorization

### Implementation Tasks

- [x] Implement permission guard middleware.
- [x] Implement global role resolver from `user_roles`.
- [x] Implement organization role resolver from `user_organization_roles`.
- [x] Implement role permission resolver from `role_permissions`.
- [x] Implement content type resolver from `content_types`.
- [x] Implement user-scope override resolver from `user_scope_permissions`.
- [x] Enforce organization access checks for organization-scoped actions.
- [x] Enforce deny-by-default behavior.
- [x] Add authorization checks to all admin APIs.

### Validation Tasks

- [x] Verify Super Admin can access all modules.
- [x] Verify University Admin access can be constrained to university-level scope.
- [x] Verify School Admin access is limited to assigned school hierarchy.
- [x] Verify Editor cannot publish without publish permission.
- [x] Verify Reviewer can approve only when permission and scope match.
- [x] Verify user-scope permissions override broad role access.
- [x] Verify direct API requests cannot bypass authorization.

### Documentation Tasks

- [x] Document permission decision flow.
- [x] Document role hierarchy.
- [x] Document scoped authorization examples.

## Phase 4: Organization and Admin Foundation

### Implementation Tasks

- [x] Implement user create/update APIs.
- [x] Implement user activate/deactivate APIs.
- [x] Implement global role assignment APIs.
- [x] Implement organization create/update APIs.
- [x] Implement organization activate/deactivate APIs.
- [x] Implement organization tree API using recursive hierarchy traversal.
- [x] Prevent cyclic organization hierarchy.
- [x] Implement scoped role assignment APIs.
- [x] Implement category management APIs.
- [x] Implement tag management APIs.
- [x] Implement content type management APIs.
- [x] Restrict updates to system-critical content type fields.
- [x] Audit user, organization, category, tag, and content type changes.
- [x] Build Super Admin screens for users, organizations, roles, categories, tags, and content types.

### Validation Tasks

- [x] Verify Super Admin can manage users.
- [x] Verify inactive users cannot log in.
- [x] Verify Super Admin can build organization hierarchy.
- [x] Verify cyclic hierarchy is blocked.
- [x] Verify inactive organizations are hidden from content assignment.
- [x] Verify category type matches target content module.
- [x] Verify content type uniqueness is enforced.

### Documentation Tasks

- [x] Document Super Admin workflows.
- [x] Document organization hierarchy rules.
- [x] Document category and content type governance.

## Phase 5: Shared Entity Framework

### Implementation Tasks

- [x] Implement shared entity create pattern.
- [x] Insert `entity_owners` record with `ownership_type = 'creator'` on create.
- [x] Insert `entity_organizations` mappings on create/update.
- [x] Insert `entity_audit_logs` on create.
- [x] Implement shared entity update pattern.
- [x] Capture old and new JSONB snapshots on update.
- [x] Insert `entity_audit_logs` on update.
- [x] Implement shared archive/delete pattern.
- [x] Prefer `status = 'archived'` or soft deletion over hard delete.
- [x] Implement workflow transition engine.
- [x] Implement `draft -> review`.
- [x] Implement `review -> published`.
- [x] Implement `review -> draft` for rejection.
- [x] Implement `published -> archived`.
- [x] Implement optional `published -> draft` for unpublish.
- [x] Insert `entity_approval_logs` for every status transition.
- [x] Insert `entity_audit_logs` for every status transition.
- [x] Implement saved draft behavior through `saved_drafts`.

### Validation Tasks

- [x] Verify all content starts as `draft`.
- [x] Verify draft cannot publish directly without explicit permission/rule.
- [x] Verify every status change writes approval logs.
- [x] Verify every status change writes audit logs.
- [x] Verify update captures old and new values.
- [x] Verify archived content is hidden from public APIs.

### Documentation Tasks

- [x] Document shared entity lifecycle.
- [x] Document legal workflow transitions.
- [x] Document audit and approval log requirements.

## Phase 6: Media, Taxonomy, SEO, and Drafts

### Implementation Tasks

- [x] Implement media metadata create/list/update/archive APIs.
- [x] Validate MIME types.
- [x] Validate file size limits.
- [x] Store media dimensions, duration, thumbnail URL, alt text, caption, and CDN-ready URL.
- [x] Link media to entities with `content_type_id` and `entity_id`.
- [x] Implement featured media behavior.
- [x] Implement category assignment APIs through `entity_categories`.
- [x] Implement tag assignment APIs through `entity_tags`.
- [x] Implement SEO metadata create/update APIs.
- [x] Enforce unique SEO metadata per `content_type_id`, `entity_id`, and `language_code`.
- [x] Implement saved draft create/update/restore APIs.

### Validation Tasks

- [x] Verify media can be linked to pages, blogs, events, achievements, announcements, stories, and clubs.
- [x] Verify invalid MIME types are rejected.
- [x] Verify missing alt text is flagged for image media.
- [x] Verify duplicate SEO metadata per language is blocked.
- [x] Verify drafts can be saved and restored without publishing.

### Documentation Tasks

- [x] Document media validation rules.
- [x] Document taxonomy assignment rules.
- [x] Document SEO metadata fields.

## Phase 7: CMS Pages

### Implementation Tasks

- [x] Implement page create API.
- [x] Implement page update API.
- [x] Implement page submit/review/approve/reject/publish/archive APIs.
- [x] Implement page organization mapping.
- [x] Implement page category/tag integration.
- [x] Implement page media integration.
- [x] Implement page SEO integration.
- [x] Implement page admin UI.
- [x] Implement public page read by slug.
- [x] Track page views in `entity_views`.

### Validation Tasks

- [x] Verify page slug uniqueness.
- [x] Verify draft pages are hidden publicly.
- [x] Verify published pages are visible publicly.
- [x] Verify page updates are audited.
- [x] Verify organization scope controls page access.

### Documentation Tasks

- [x] Document page authoring workflow.
- [x] Document public page API behavior.

## Phase 8: Blogs and News

### Implementation Tasks

- [x] Implement blog/news create API.
- [x] Implement blog/news update API.
- [x] Implement blog/news submit/review/approve/reject/publish/archive APIs.
- [x] Implement author attribution.
- [x] Implement reading time calculation.
- [x] Implement featured blog support.
- [x] Implement pinned article support if required by UI.
- [x] Implement blog organization mapping.
- [x] Implement blog category/tag integration.
- [x] Implement blog media integration.
- [x] Implement blog SEO integration.
- [x] Implement blog admin UI.
- [x] Implement public blog listing API.
- [x] Implement public blog detail API by slug.
- [x] Track blog views in `entity_views`.

### Validation Tasks

- [x] Verify blog slug uniqueness.
- [x] Verify blogs filter by organization.
- [x] Verify blogs filter by category and tag.
- [x] Verify featured blogs can be listed.
- [x] Verify published blogs increment view tracking.
- [x] Verify blog updates are audited.

### Documentation Tasks

- [x] Document blog/news workflow.
- [x] Document public blog filters.

## Phase 9: Events

### Implementation Tasks

- [x] Implement event create API.
- [x] Implement event update API.
- [x] Implement event submit/review/approve/reject/publish/archive APIs.
- [x] Add event type support.
- [x] Add mode support: online, offline, hybrid.
- [x] Add venue, organizer, dates, times, timezone, registration link, and contact fields.
- [x] Add registration deadline and max participant fields.
- [x] Implement featured event support.
- [x] Implement event organization mapping.
- [x] Implement event category/tag integration.
- [x] Implement event media integration.
- [x] Implement event SEO integration.
- [x] Implement event admin UI.
- [x] Implement public event listing API.
- [x] Implement public event detail API by slug.
- [x] Track event views and engagement in `entity_views`.

### Validation Tasks

- [x] Verify invalid event date ranges are blocked.
- [x] Verify expired/completed events can be archived.
- [x] Verify published events appear publicly.
- [x] Verify event filters by organization, type, mode, and featured state.
- [x] Verify event updates are audited.

### Documentation Tasks

- [x] Document event lifecycle.
- [x] Document event validation rules.

## Phase 10: Announcements

### Implementation Tasks

- [x] Implement announcement type management.
- [x] Implement announcement create API.
- [x] Implement announcement update API.
- [x] Implement announcement submit/review/approve/reject/publish/archive APIs.
- [x] Implement title-plus-PDF validation.
- [x] Implement title-plus-description validation.
- [x] Implement full-content validation.
- [x] Add validity dates: `valid_from`, `valid_until`.
- [x] Add priority levels.
- [x] Implement announcement organization mapping.
- [x] Implement announcement category/tag integration.
- [x] Implement announcement media integration.
- [x] Implement announcement SEO integration.
- [x] Implement announcement admin UI.
- [x] Implement public announcement listing API.
- [x] Implement public announcement detail API by slug.

### Validation Tasks

- [x] Verify title-plus-PDF announcements require PDF media.
- [x] Verify full-content announcements require content.
- [x] Verify expired announcements are hidden publicly.
- [x] Verify announcement filters by organization, type, category, and priority.
- [x] Verify announcement updates are audited.

### Documentation Tasks

- [x] Document announcement types.
- [x] Document announcement expiry behavior.

## Phase 11: Achievements, Stories, and Clubs

### Implementation Tasks

- [x] Implement achievement create/update APIs.
- [x] Implement achievement workflow APIs.
- [x] Add achievement type, level, date, awarded-by, and prize amount fields.
- [x] Implement featured achievements.
- [x] Implement story create/update APIs.
- [x] Implement story workflow APIs.
- [x] Add story type, person name, person role, company, graduation year, and LinkedIn URL fields.
- [x] Implement featured stories.
- [x] Implement club details management through `organizations` plus `club_details`.
- [x] Add club leadership fields.
- [x] Add club social links.
- [x] Add club meeting schedule and joining process.
- [x] Implement club gallery/media support.
- [x] Implement organization, taxonomy, media, SEO, workflow, and audit integration for achievements.
- [x] Implement organization, taxonomy, media, SEO, workflow, and audit integration for stories.
- [x] Implement organization, taxonomy, media, SEO, workflow, and audit integration for clubs.
- [x] Implement admin UI for achievements, stories, and clubs.
- [x] Implement public listing/detail APIs for achievements, stories, and clubs.

### Validation Tasks

- [x] Verify achievements can be featured.
- [x] Verify stories can be featured.
- [x] Verify clubs inherit organization-scoped permissions.
- [x] Verify clubs linked to active content/events cannot be hard-deleted.
- [x] Verify archived achievements, stories, and clubs are hidden publicly.
- [x] Verify all updates are audited.

### Documentation Tasks

- [x] Document achievement workflow.
- [x] Document story workflow.
- [x] Document club governance.

## Phase 12: Notifications, Scheduler, Search, and Analytics

### Implementation Tasks

- [x] Implement notification template management.
- [x] Create notifications for content submission.
- [x] Create notifications for approval.
- [x] Create notifications for rejection.
- [x] Create notifications for publication.
- [x] Create notifications for failed scheduled jobs.
- [x] Create notifications for role or permission changes.
- [x] Implement notification read/unread tracking.
- [x] Implement scheduled publishing jobs.
- [x] Implement automated archival jobs.
- [x] Implement scheduled notification dispatch.
- [x] Implement sitemap generation jobs.
- [x] Implement job retry and execution logs.
- [x] Implement search indexing.
- [x] Implement re-indexing after content updates.
- [x] Implement public global search.
- [x] Add search filters by content type, organization, category, and tag.
- [x] Add search pagination and sorting.
- [x] Exclude archived and inactive content from search.
- [x] Implement entity view tracking reports.
- [x] Implement content performance dashboard.
- [x] Implement search analytics dashboard.
- [x] Implement workflow performance dashboard.

### Validation Tasks

- [x] Verify workflow actions create notifications.
- [x] Verify read/unread state persists.
- [x] Verify scheduled publishing runs at the expected time.
- [x] Verify automated archival hides expired content.
- [x] Verify failed jobs are retried and logged.
- [x] Verify search excludes archived content.
- [x] Verify analytics count views correctly.

### Documentation Tasks

- [x] Document notification events.
- [x] Document scheduler jobs.
- [x] Document search indexing strategy.
- [x] Document analytics report definitions.

## Phase 13: Hardening and Operations

### Implementation Tasks

- [ ] Add SQL injection protections through parameterized queries/ORM safeguards.
- [ ] Add XSS protection for rich text input and output rendering.
- [ ] Add CSRF protection for state-changing operations where applicable.
- [ ] Add secure HTTP headers.
- [ ] Add Content Security Policy.
- [ ] Add secure cookie settings.
- [ ] Add API rate limiting.
- [ ] Add authentication endpoint rate limiting.
- [ ] Add upload security scanning hooks.
- [ ] Add HTTPS-only production configuration.
- [ ] Add backup encryption strategy.
- [ ] Add database backup schedule.
- [ ] Add media backup schedule.
- [ ] Add restore test procedure.
- [ ] Define RTO and RPO targets.
- [ ] Add health check endpoints.
- [ ] Add centralized logging.
- [ ] Add application performance monitoring.
- [ ] Add infrastructure monitoring alerts.
- [ ] Run WCAG accessibility checks.
- [ ] Run responsive layout checks.
- [ ] Tune indexes and query performance.
- [ ] Add cache invalidation after content updates.
- [ ] Add CDN integration for public media.

### Validation Tasks

- [ ] Verify rate limiting works on auth endpoints.
- [ ] Verify unauthorized API requests are rejected.
- [ ] Verify rich text is sanitized.
- [ ] Verify uploaded files are validated.
- [ ] Verify backup restore process works.
- [ ] Verify health checks report expected status.
- [ ] Verify public pages meet accessibility expectations.
- [ ] Verify public pages load acceptably under expected traffic.

### Documentation Tasks

- [ ] Document security controls.
- [ ] Document backup and disaster recovery procedures.
- [ ] Document monitoring and alerting.
- [ ] Document accessibility acceptance criteria.

## Cross-Cutting Acceptance Checklist

- [x] Google OAuth-only login is implemented.
- [x] Unknown users cannot log in.
- [x] RBAC is enforced on backend admin APIs covered by the test suite.
- [x] Organization scoping is enforced for organization and scoped permission actions.
- [x] User-scope permission overrides are supported.
- [x] Workflow states are normalized and enforced.
- [x] Soft delete or archival is preferred over hard delete.
- [x] Audit logging exists for create, update, archive/delete, publish, approve, reject, and login flows covered by tests.
- [x] Public APIs expose only published, active, non-archived content.
- [x] PostgreSQL-specific features are used where appropriate.
- [ ] High-volume tables have a partitioning strategy.
- [x] Search excludes archived or inactive records.
- [x] Media captures accessibility metadata where applicable.
- [ ] Backup and restore procedures are tested.

## Stabilization Notes

- [x] Backend tests are green with serialized test execution to avoid cross-file database environment leakage.
- [x] Google OAuth callback tests now assert browser redirect behavior and token extraction from the redirect URL.
- [x] Late-stage modules use explicit RBAC permissions instead of generic workflow permissions.
- [x] `seed:all` runs permission mapping before editor seeding.
- [x] Generated development logs were removed and loose debug utilities were relocated under `backend/scripts/dev`.
- [ ] Production operations remain: partitioning, backup/restore drills, monitoring/APM, upload scanning, CDN integration, and WCAG/responsive audit sign-off.
