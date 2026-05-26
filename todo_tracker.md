# University CMS Todo Tracker

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Phase 0: Repository and Bootstrap Planning

### Implementation Tasks

- [ ] Confirm Angular v21.2.14 frontend project structure.
- [ ] Confirm Fastify v5.8.5 backend project structure.
- [ ] Confirm AWS PostgreSQL target: RDS PostgreSQL or Aurora PostgreSQL.
- [ ] Select and document the database migration tool.
- [ ] Define local, staging, and production environment configuration strategy.
- [ ] Define API response and error format.
- [ ] Define route naming conventions for admin and public APIs.
- [ ] Define module, permission, status, and table naming conventions.

### Validation Tasks

- [ ] Verify frontend, backend, and database can be initialized consistently.
- [ ] Verify environment secrets are not committed.
- [ ] Verify planning documents match the SRS assumptions.

### Documentation Tasks

- [ ] Document repository setup commands.
- [ ] Document environment variables.
- [ ] Document initial architecture decisions.

## Phase 1: PostgreSQL Schema Initialization

### Implementation Tasks

- [ ] Create schema migration plan.
- [ ] Define common audit columns: `created_at`, `created_by`, `updated_at`, `updated_by`.
- [ ] Define soft-delete convention using `deleted_at` or `status = 'archived'`.
- [ ] Create `users`.
- [ ] Create `roles`.
- [ ] Create `user_roles`.
- [ ] Create `permissions`.
- [ ] Create `role_permissions`.
- [ ] Create `user_scope_permissions`.
- [ ] Create `user_login_logs`.
- [ ] Create `organizations`.
- [ ] Create `organization_relations`.
- [ ] Create `user_organization_roles`.
- [ ] Create `content_types`.
- [ ] Create `pages`.
- [ ] Create `blogs`.
- [ ] Create `events`.
- [ ] Create `achievements`.
- [ ] Create `announcements`.
- [ ] Create `announcement_types`.
- [ ] Create `stories`.
- [ ] Create `club_details`.
- [ ] Create `categories`.
- [ ] Create `tags`.
- [ ] Create `entity_categories`.
- [ ] Create `entity_tags`.
- [ ] Create `media`.
- [ ] Create `seo_metadata`.
- [ ] Create `entity_organizations`.
- [ ] Create `entity_owners`.
- [ ] Create `entity_approval_logs`.
- [ ] Create `entity_audit_logs`.
- [ ] Create `notifications`.
- [ ] Create `saved_drafts`.
- [ ] Create `entity_views`.
- [ ] Add FK indexes.
- [ ] Add unique constraints for emails, slugs, mapping tables, role names, permission codes, and content type identifiers.
- [ ] Add JSONB fields for audit snapshots, draft payloads, and schema metadata.
- [ ] Add enum or check constraints for workflow statuses.
- [ ] Plan monthly or yearly partitioning for `entity_views`, `entity_audit_logs`, `notifications`, and `user_login_logs`.
- [ ] Seed roles: `SUPER_ADMIN`, `UNIVERSITY_ADMIN`, `SCHOOL_ADMIN`, `EDITOR`, `REVIEWER`, `CONTENT_CREATOR`.
- [ ] Seed sample permissions: `CREATE_PAGE`, `UPDATE_PAGE`, `DELETE_PAGE`, `PUBLISH_PAGE`.
- [ ] Seed sample permissions: `CREATE_BLOG`, `UPDATE_BLOG`, `DELETE_BLOG`, `PUBLISH_BLOG`.
- [ ] Seed sample permissions: `CREATE_EVENT`, `UPDATE_EVENT`, `DELETE_EVENT`, `PUBLISH_EVENT`.
- [ ] Seed sample permissions: `MANAGE_MEDIA`, `MANAGE_USERS`, `MANAGE_ROLES`, `REVIEW_CONTENT`, `APPROVE_CONTENT`, `MANAGE_SEO`.
- [ ] Seed content types: `page`, `blog`, `event`, `achievement`, `announcement`, `story`, `club`.
- [ ] Grant all permissions to `SUPER_ADMIN`.

### Validation Tasks

- [ ] Verify all migrations run on a clean database.
- [ ] Verify rollback strategy for migrations.
- [ ] Verify FK constraints prevent orphaned records.
- [ ] Verify unique constraints prevent duplicates.
- [ ] Verify seed data is idempotent.
- [ ] Verify PostgreSQL-specific features are supported in the selected AWS database target.

### Documentation Tasks

- [ ] Document schema groups and table responsibilities.
- [ ] Document seed roles and permissions.
- [ ] Document migration workflow.

## Phase 2: Google OAuth Authentication

### Implementation Tasks

- [ ] Configure Google OAuth client credentials.
- [ ] Implement Google OAuth login route.
- [ ] Implement OAuth callback route.
- [ ] Validate returned Google email against `users.email`.
- [ ] Block login for unknown users.
- [ ] Block login for inactive users.
- [ ] Block login for soft-deleted users.
- [ ] Create session or JWT after successful login.
- [ ] Insert successful login record into `user_login_logs`.
- [ ] Update `users.last_login_at`.
- [ ] Implement current-user context endpoint.
- [ ] Return user roles, organization roles, permissions, and scope data in current-user context.

### Validation Tasks

- [ ] Verify existing active user can log in.
- [ ] Verify unknown Google email is rejected.
- [ ] Verify inactive user is rejected.
- [ ] Verify soft-deleted user is rejected.
- [ ] Verify successful login writes `user_login_logs`.
- [ ] Verify password login is not exposed in v1.

### Documentation Tasks

- [ ] Document Google OAuth setup.
- [ ] Document session/JWT strategy.
- [ ] Document login failure behavior.

## Phase 3: RBAC and Scoped Authorization

### Implementation Tasks

- [ ] Implement permission guard middleware.
- [ ] Implement global role resolver from `user_roles`.
- [ ] Implement organization role resolver from `user_organization_roles`.
- [ ] Implement role permission resolver from `role_permissions`.
- [ ] Implement content type resolver from `content_types`.
- [ ] Implement user-scope override resolver from `user_scope_permissions`.
- [ ] Enforce organization access checks for organization-scoped actions.
- [ ] Enforce deny-by-default behavior.
- [ ] Add authorization checks to all admin APIs.

### Validation Tasks

- [ ] Verify Super Admin can access all modules.
- [ ] Verify University Admin access can be constrained to university-level scope.
- [ ] Verify School Admin access is limited to assigned school hierarchy.
- [ ] Verify Editor cannot publish without publish permission.
- [ ] Verify Reviewer can approve only when permission and scope match.
- [ ] Verify user-scope permissions override broad role access.
- [ ] Verify direct API requests cannot bypass authorization.

### Documentation Tasks

- [ ] Document permission decision flow.
- [ ] Document role hierarchy.
- [ ] Document scoped authorization examples.

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

- [ ] Implement shared entity create pattern.
- [ ] Insert `entity_owners` record with `ownership_type = 'creator'` on create.
- [ ] Insert `entity_organizations` mappings on create/update.
- [ ] Insert `entity_audit_logs` on create.
- [ ] Implement shared entity update pattern.
- [ ] Capture old and new JSONB snapshots on update.
- [ ] Insert `entity_audit_logs` on update.
- [ ] Implement shared archive/delete pattern.
- [ ] Prefer `status = 'archived'` or soft deletion over hard delete.
- [ ] Implement workflow transition engine.
- [ ] Implement `draft -> review`.
- [ ] Implement `review -> published`.
- [ ] Implement `review -> draft` for rejection.
- [ ] Implement `published -> archived`.
- [ ] Implement optional `published -> draft` for unpublish.
- [ ] Insert `entity_approval_logs` for every status transition.
- [ ] Insert `entity_audit_logs` for every status transition.
- [ ] Implement saved draft behavior through `saved_drafts`.

### Validation Tasks

- [ ] Verify all content starts as `draft`.
- [ ] Verify draft cannot publish directly without explicit permission/rule.
- [ ] Verify every status change writes approval logs.
- [ ] Verify every status change writes audit logs.
- [ ] Verify update captures old and new values.
- [ ] Verify archived content is hidden from public APIs.

### Documentation Tasks

- [ ] Document shared entity lifecycle.
- [ ] Document legal workflow transitions.
- [ ] Document audit and approval log requirements.

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

- [ ] Implement blog/news create API.
- [ ] Implement blog/news update API.
- [ ] Implement blog/news submit/review/approve/reject/publish/archive APIs.
- [ ] Implement author attribution.
- [ ] Implement reading time calculation.
- [ ] Implement featured blog support.
- [ ] Implement pinned article support if required by UI.
- [ ] Implement blog organization mapping.
- [ ] Implement blog category/tag integration.
- [ ] Implement blog media integration.
- [ ] Implement blog SEO integration.
- [ ] Implement blog admin UI.
- [ ] Implement public blog listing API.
- [ ] Implement public blog detail API by slug.
- [ ] Track blog views in `entity_views`.

### Validation Tasks

- [ ] Verify blog slug uniqueness.
- [ ] Verify blogs filter by organization.
- [ ] Verify blogs filter by category and tag.
- [ ] Verify featured blogs can be listed.
- [ ] Verify published blogs increment view tracking.
- [ ] Verify blog updates are audited.

### Documentation Tasks

- [ ] Document blog/news workflow.
- [ ] Document public blog filters.

## Phase 9: Events

### Implementation Tasks

- [ ] Implement event create API.
- [ ] Implement event update API.
- [ ] Implement event submit/review/approve/reject/publish/archive APIs.
- [ ] Add event type support.
- [ ] Add mode support: online, offline, hybrid.
- [ ] Add venue, organizer, dates, times, timezone, registration link, and contact fields.
- [ ] Add registration deadline and max participant fields.
- [ ] Implement featured event support.
- [ ] Implement event organization mapping.
- [ ] Implement event category/tag integration.
- [ ] Implement event media integration.
- [ ] Implement event SEO integration.
- [ ] Implement event admin UI.
- [ ] Implement public event listing API.
- [ ] Implement public event detail API by slug.
- [ ] Track event views and engagement in `entity_views`.

### Validation Tasks

- [ ] Verify invalid event date ranges are blocked.
- [ ] Verify expired/completed events can be archived.
- [ ] Verify published events appear publicly.
- [ ] Verify event filters by organization, type, mode, and featured state.
- [ ] Verify event updates are audited.

### Documentation Tasks

- [ ] Document event lifecycle.
- [ ] Document event validation rules.

## Phase 10: Announcements

### Implementation Tasks

- [ ] Implement announcement type management.
- [ ] Implement announcement create API.
- [ ] Implement announcement update API.
- [ ] Implement announcement submit/review/approve/reject/publish/archive APIs.
- [ ] Implement title-plus-PDF validation.
- [ ] Implement title-plus-description validation.
- [ ] Implement full-content validation.
- [ ] Add validity dates: `valid_from`, `valid_until`.
- [ ] Add priority levels.
- [ ] Implement announcement organization mapping.
- [ ] Implement announcement category/tag integration.
- [ ] Implement announcement media integration.
- [ ] Implement announcement SEO integration.
- [ ] Implement announcement admin UI.
- [ ] Implement public announcement listing API.
- [ ] Implement public announcement detail API by slug.

### Validation Tasks

- [ ] Verify title-plus-PDF announcements require PDF media.
- [ ] Verify full-content announcements require content.
- [ ] Verify expired announcements are hidden publicly.
- [ ] Verify announcement filters by organization, type, category, and priority.
- [ ] Verify announcement updates are audited.

### Documentation Tasks

- [ ] Document announcement types.
- [ ] Document announcement expiry behavior.

## Phase 11: Achievements, Stories, and Clubs

### Implementation Tasks

- [ ] Implement achievement create/update APIs.
- [ ] Implement achievement workflow APIs.
- [ ] Add achievement type, level, date, awarded-by, and prize amount fields.
- [ ] Implement featured achievements.
- [ ] Implement story create/update APIs.
- [ ] Implement story workflow APIs.
- [ ] Add story type, person name, person role, company, graduation year, and LinkedIn URL fields.
- [ ] Implement featured stories.
- [ ] Implement club details management through `organizations` plus `club_details`.
- [ ] Add club leadership fields.
- [ ] Add club social links.
- [ ] Add club meeting schedule and joining process.
- [ ] Implement club gallery/media support.
- [ ] Implement organization, taxonomy, media, SEO, workflow, and audit integration for achievements.
- [ ] Implement organization, taxonomy, media, SEO, workflow, and audit integration for stories.
- [ ] Implement organization, taxonomy, media, SEO, workflow, and audit integration for clubs.
- [ ] Implement admin UI for achievements, stories, and clubs.
- [ ] Implement public listing/detail APIs for achievements, stories, and clubs.

### Validation Tasks

- [ ] Verify achievements can be featured.
- [ ] Verify stories can be featured.
- [ ] Verify clubs inherit organization-scoped permissions.
- [ ] Verify clubs linked to active content/events cannot be hard-deleted.
- [ ] Verify archived achievements, stories, and clubs are hidden publicly.
- [ ] Verify all updates are audited.

### Documentation Tasks

- [ ] Document achievement workflow.
- [ ] Document story workflow.
- [ ] Document club governance.

## Phase 12: Notifications, Scheduler, Search, and Analytics

### Implementation Tasks

- [ ] Implement notification template management.
- [ ] Create notifications for content submission.
- [ ] Create notifications for approval.
- [ ] Create notifications for rejection.
- [ ] Create notifications for publication.
- [ ] Create notifications for failed scheduled jobs.
- [ ] Create notifications for role or permission changes.
- [ ] Implement notification read/unread tracking.
- [ ] Implement scheduled publishing jobs.
- [ ] Implement automated archival jobs.
- [ ] Implement scheduled notification dispatch.
- [ ] Implement sitemap generation jobs.
- [ ] Implement job retry and execution logs.
- [ ] Implement search indexing.
- [ ] Implement re-indexing after content updates.
- [ ] Implement public global search.
- [ ] Add search filters by content type, organization, category, and tag.
- [ ] Add search pagination and sorting.
- [ ] Exclude archived and inactive content from search.
- [ ] Implement entity view tracking reports.
- [ ] Implement content performance dashboard.
- [ ] Implement search analytics dashboard.
- [ ] Implement workflow performance dashboard.

### Validation Tasks

- [ ] Verify workflow actions create notifications.
- [ ] Verify read/unread state persists.
- [ ] Verify scheduled publishing runs at the expected time.
- [ ] Verify automated archival hides expired content.
- [ ] Verify failed jobs are retried and logged.
- [ ] Verify search excludes archived content.
- [ ] Verify analytics count views correctly.

### Documentation Tasks

- [ ] Document notification events.
- [ ] Document scheduler jobs.
- [ ] Document search indexing strategy.
- [ ] Document analytics report definitions.

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

- [ ] Google OAuth-only login is implemented.
- [ ] Unknown users cannot log in.
- [ ] RBAC is enforced on every backend API.
- [ ] Organization scoping is enforced for content actions.
- [ ] User-scope permission overrides are supported.
- [ ] Workflow states are normalized and enforced.
- [ ] Soft delete or archival is preferred over hard delete.
- [ ] Audit logging exists for create, update, delete/archive, publish, approve, reject, login, and permission changes.
- [ ] Public APIs expose only published, active, non-archived content.
- [ ] PostgreSQL-specific features are used where appropriate.
- [ ] High-volume tables have a partitioning strategy.
- [ ] Search excludes archived or inactive records.
- [ ] Media requires accessibility metadata where applicable.
- [ ] Backup and restore procedures are tested.
