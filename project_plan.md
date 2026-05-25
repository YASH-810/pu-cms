# University CMS Project Plan

## 1. Executive Summary

This project implements a University Content Management System (CMS) for managing institutional websites, organizational structures, content publishing, media assets, SEO metadata, workflows, notifications, search, audit logging, analytics, and operational governance.

The system will be built as a modular enterprise platform with centralized governance and distributed organization-scoped administration. The first implementation iterations must establish the database foundation, Google OAuth authentication, RBAC, organization hierarchy, and shared content governance patterns before building individual CMS modules.

This document is based on the provided `PU-CMS SRS.pdf` and is intended as the lead architecture and delivery plan. It does not include application code.

## 2. Architecture Baseline

### 2.1 Technology Stack

| Layer | Decision |
| --- | --- |
| Frontend | Angular v21.2.14 |
| Backend | Fastify v5.8.5 |
| Database | PostgreSQL on AWS, preferably AWS RDS or Aurora PostgreSQL |
| Authentication | Google OAuth-only login |
| Authorization | RBAC with organization scope and user-level permission overrides |
| API Style | REST APIs with JSON request/response payloads |
| Media Delivery | Object storage plus CDN-ready media URLs |
| Background Work | Queue/cron-based scheduler for publishing, archival, notifications, media processing, sitemap generation |
| Observability | Centralized logs, audit tables, health checks, metrics, and admin dashboards |

### 2.2 Authentication Model

The implementation baseline is Google OAuth-only authentication.

Users must be pre-created in the internal `users` table by an administrator. During login, Google verifies identity and returns user profile information such as email, full name, and optional profile image. The CMS then checks whether the returned email exists in `users`, confirms the user is active and not soft-deleted, creates a session or JWT, logs the login in `user_login_logs`, and loads the authorization context.

The system will not manage passwords in the initial implementation. The `password_hash` field may remain nullable or reserved for future hybrid authentication, but it must not be used for login in v1.

### 2.3 Authorization Model

Authorization is enforced through three layers:

1. Global RBAC through `roles`, `permissions`, `role_permissions`, and `user_roles`.
2. Organization-scoped roles through `user_organization_roles`.
3. Fine-grained user overrides through `user_scope_permissions`.

Authorization must be checked on every backend API, not only in the frontend. The permission decision flow is:

1. Identify the authenticated user.
2. Load global roles and organization roles.
3. Resolve role permissions.
4. Resolve target organization and content type where applicable.
5. Check `user_scope_permissions`.
6. If matching user-scope permissions exist, apply them strictly.
7. Otherwise fall back to role permissions plus organization access.
8. Deny by default when explicit permission is missing.

### 2.4 Core Services

| Service | Responsibility |
| --- | --- |
| Auth Service | Google OAuth callback, session/JWT creation, login logging, current-user context |
| RBAC Service | Role, permission, organization scope, user-scope override evaluation |
| Organization Service | University, school, department, program, center, club, office, exam-cell, sports hierarchy |
| Admin Service | Super Admin management of users, organizations, categories, content types, role assignments |
| Content Service | Shared content lifecycle, ownership, organization mapping, taxonomy, drafts |
| Workflow Service | Draft, review, approval, rejection, publishing, archival, workflow history |
| Media Service | Upload metadata, MIME validation, thumbnails, alt text, CDN-ready URLs |
| SEO Service | Metadata, canonical URLs, OpenGraph, Twitter cards, schema markup, sitemap support |
| Notification Service | In-app notifications, email-ready templates, read/unread state, delivery logs |
| Search Service | Global search, filters, autocomplete, full-text indexing, archived-content exclusion |
| Audit Service | Immutable entity audit records, login audit, approval logs, compliance exports |
| Analytics Service | Views, engagement reports, workflow performance, organization-level reporting |
| Scheduler Service | Scheduled publishing, archival, notifications, media processing, sitemap jobs |
| Public API Service | Public read endpoints for published CMS content |

## 3. Database Architecture

### 3.1 PostgreSQL Design Rules

The schema must use PostgreSQL features deliberately:

- Foreign keys for referential integrity.
- Unique constraints for emails, slugs, role names, permission codes, content type identifiers, and mapping tables.
- Indexed FK columns.
- JSONB for audit snapshots, draft payloads, and schema metadata.
- Recursive CTE support for organization hierarchy traversal.
- Full-text search and GIN indexes for search.
- Enum types or check constraints for workflow statuses.
- Monthly or yearly partitioning for high-volume tables such as `entity_views`, `entity_audit_logs`, `notifications`, and `user_login_logs`.
- Soft deletion for major user-facing entities using `deleted_at` or `status = 'archived'`.
- Common audit columns on mutable tables: `created_at`, `created_by`, `updated_at`, `updated_by`.

### 3.2 Identity and RBAC Schema

| Table | Purpose |
| --- | --- |
| `users` | Stores internal user accounts authenticated through Google OAuth. |
| `roles` | Stores role definitions and hierarchy levels. |
| `user_roles` | Assigns global roles to users. |
| `permissions` | Stores system permission codes grouped by module. |
| `role_permissions` | Maps roles to permissions. |
| `user_scope_permissions` | Grants granular user permissions by organization and/or content type. |
| `user_login_logs` | Append-only login history with IP address and user agent. |

Seed roles:

- `SUPER_ADMIN`
- `UNIVERSITY_ADMIN`
- `SCHOOL_ADMIN`
- `EDITOR`
- `REVIEWER`
- `CONTENT_CREATOR`

Seed permissions:

- `CREATE_PAGE`, `UPDATE_PAGE`, `DELETE_PAGE`, `PUBLISH_PAGE`
- `CREATE_BLOG`, `UPDATE_BLOG`, `DELETE_BLOG`, `PUBLISH_BLOG`
- `CREATE_EVENT`, `UPDATE_EVENT`, `DELETE_EVENT`, `PUBLISH_EVENT`
- `MANAGE_MEDIA`
- `MANAGE_USERS`
- `MANAGE_ROLES`
- `REVIEW_CONTENT`
- `APPROVE_CONTENT`
- `MANAGE_SEO`

### 3.3 Organization Schema

| Table | Purpose |
| --- | --- |
| `organizations` | Universal hierarchy for universities, schools, departments, programs, centers, clubs, offices, exam cells, and sports units. |
| `organization_relations` | Advanced cross-organization relationships such as collaboration or reporting lines. |
| `user_organization_roles` | Scoped role assignments inside organizations. |
| `club_details` | Additional club metadata for organizations where `org_type = 'club'`. |

Organization rules:

- `organizations.slug` must be unique.
- `organizations.parent_id` references `organizations.id`.
- Cyclic hierarchy must be prevented at service level and, where feasible, with database checks/triggers.
- Inactive organizations cannot be assigned to new content.
- Organizations linked to active content must not be hard-deleted.

### 3.4 Content Schema

| Table | Purpose |
| --- | --- |
| `content_types` | Master registry for polymorphic CMS entities. |
| `pages` | Static CMS pages. |
| `blogs` | Blog and news articles. |
| `events` | University events. |
| `achievements` | Awards, recognitions, and institutional achievements. |
| `announcements` | University notices and announcements. |
| `announcement_types` | Announcement type rules such as title plus PDF, title plus description, and full content. |
| `stories` | Alumni, student, faculty, research, and success stories. |

Initial content types:

- `page`
- `blog`
- `event`
- `achievement`
- `announcement`
- `story`
- `club`

Standard content statuses:

- `draft`
- `review`
- `approved`
- `published`
- `rejected`
- `archived`
- `scheduled`

The implementation should normalize status naming across modules. The preferred runtime lifecycle is `draft -> review -> published -> archived`, with `rejected -> draft` as a review outcome.

### 3.5 Taxonomy, Media, and Metadata Schema

| Table | Purpose |
| --- | --- |
| `categories` | Reusable categories by content/module type. |
| `tags` | Reusable tags. |
| `entity_categories` | Polymorphic category mapping. |
| `entity_tags` | Polymorphic tag mapping. |
| `media` | Universal media table for images, videos, PDFs, and documents. |
| `seo_metadata` | SEO, OpenGraph, Twitter Card, canonical URL, robots, schema, and multilingual metadata. |

The final schema should prefer universal polymorphic tables instead of module-specific media or organization tables. For example, use `media` with `content_type_id` and `entity_id` rather than `blog_media`, `event_media`, or `story_media`.

### 3.6 Governance and Analytics Schema

| Table | Purpose |
| --- | --- |
| `entity_organizations` | Maps any content entity to one or more organizations. |
| `entity_owners` | Tracks creators, editors, reviewers, and publishers for any entity. |
| `entity_approval_logs` | Tracks workflow transitions, reviewer identity, remarks, and timestamps. |
| `entity_audit_logs` | Immutable entity change history with old/new JSONB snapshots. |
| `notifications` | In-app notifications and read/unread state. |
| `saved_drafts` | Autosaved draft payloads. |
| `entity_views` | Content view tracking for analytics. |

Audit rules:

- Create, update, delete/archive, publish, approve, reject, login, permission change, and role assignment events must be logged.
- Entity audit logs must capture `content_type_id`, `entity_id`, `action`, actor, old value, new value, IP address, user agent, and timestamp.
- Approval logs must capture `status_from`, `status_to`, remarks, actor, and timestamp.
- Audit records should be append-only.

## 4. Module Inventory

1. Authentication and User Access
2. RBAC and Permission Governance
3. Organization Hierarchy
4. Admin and Super Admin
5. CMS Pages
6. Blogs and News
7. Events
8. Announcements
9. Achievements and Stories
10. Clubs and Communities
11. Media Management
12. SEO and Metadata
13. Workflow and Approval
14. Notifications
15. Search and Discovery
16. Audit Logging and Analytics
17. Scheduler and Automation
18. API and Third-Party Integrations
19. Security, Accessibility, Backup/DR, Performance, and Scalability

## 5. Iterative Delivery Roadmap

### Phase 0: Repository and Bootstrap Planning

Goal: establish implementation conventions before writing app code.

Deliverables:

- Confirm repository structure for Angular frontend and Fastify backend.
- Confirm migration tool and database connection strategy.
- Confirm environment strategy for local, staging, and production.
- Define API response shape and error format.
- Define naming conventions for modules, permissions, statuses, and routes.

Acceptance criteria:

- Team can initialize the backend, frontend, and database consistently.
- No schema or module implementation begins before migration and environment conventions are documented.

### Phase 1: PostgreSQL Schema Initialization

Goal: create the database foundation.

Deliverables:

- Database migration baseline.
- Common audit fields and timestamp conventions.
- Core identity/RBAC tables.
- Organization tables.
- Content type registry.
- Shared polymorphic tables for entity ownership, organization mapping, audit logs, approval logs, media, SEO metadata, categories, tags, saved drafts, notifications, and views.
- Seed roles, permissions, and content types.

Acceptance criteria:

- All FK, unique, index, and soft-delete rules are represented.
- Seeded Super Admin role has all permissions.
- Seeded content types can support pages, blogs, events, achievements, announcements, stories, and clubs.

### Phase 2: Google OAuth Authentication

Goal: support secure admin login through Google identity.

Deliverables:

- Google OAuth login and callback flow.
- Internal user lookup by email.
- Active/deleted user checks.
- Session or JWT creation.
- Login log insertion.
- Current-user endpoint with roles, permissions, and organization scope.

Acceptance criteria:

- Existing active users can log in with Google.
- Unknown, inactive, or soft-deleted users are denied.
- Successful logins create `user_login_logs` records.
- No password login is exposed in v1.

### Phase 3: RBAC and Scoped Authorization

Goal: enforce permissions across all backend APIs.

Deliverables:

- Permission guard middleware.
- Role permission resolver.
- Organization access resolver.
- User-scope permission override evaluator.
- Deny-by-default authorization behavior.
- Tests for global roles, scoped roles, and user overrides.

Acceptance criteria:

- Direct API calls cannot bypass authorization.
- User-scope permissions restrict access to the matching organization/content type.
- Organization-scoped users cannot access unrelated organizations.

### Phase 4: Organization and Admin Foundation

Goal: enable Super Admin governance.

Deliverables:

- User management: create, update, activate/deactivate, assign global roles.
- Organization management: create, update, activate/deactivate, hierarchy tree.
- Scoped role assignment through `user_organization_roles`.
- Category and tag management.
- Content type management with restricted updates to system-critical fields.
- Audit views for admin actions.

Acceptance criteria:

- Super Admin can configure users, organizations, roles, categories, tags, and content types.
- Cyclic organization hierarchy is blocked.
- Inactive organizations are hidden from new content assignment.

### Phase 5: Shared Entity Framework

Goal: implement reusable governance behavior before module-specific content.

Deliverables:

- Shared create/update/archive behavior for content entities.
- Entity owner assignment.
- Entity-to-organization mapping.
- Status transition engine.
- Approval log creation.
- Entity audit log creation.
- Draft autosave pattern.

Acceptance criteria:

- All content starts as `draft`.
- No direct draft-to-published transition is allowed unless explicitly configured.
- Every status change writes approval and audit records.
- Every update captures old and new JSONB snapshots.

### Phase 6: Media, Taxonomy, SEO, and Drafts

Goal: complete shared content-support capabilities.

Deliverables:

- Media metadata upload records.
- MIME type, size, and security validation hooks.
- Thumbnail/CDN-ready metadata fields.
- Category and tag assignment APIs.
- SEO metadata create/update APIs.
- Saved draft APIs.
- Accessibility support through media alt text.

Acceptance criteria:

- Media can be linked to any content entity through `content_type_id` and `entity_id`.
- SEO metadata is unique per content entity and language.
- Drafts can be saved and restored without publishing content.

### Phase 7: CMS Pages

Goal: implement static CMS pages.

Deliverables:

- Page CRUD.
- Rich text content fields.
- Organization mapping.
- Category/tag/media/SEO integration.
- Workflow submit, review, approve/reject, publish, archive.
- Public page read by slug.

Acceptance criteria:

- Published pages are publicly readable.
- Draft, review, rejected, and archived pages are hidden from public APIs.
- Page slug uniqueness is enforced.

### Phase 8: Blogs and News

Goal: implement institutional blogs and news articles.

Deliverables:

- Blog/news CRUD.
- Author attribution.
- Reading time calculation.
- Featured and pinned support.
- View tracking.
- Taxonomy, organization, media, SEO, and workflow integration.
- Public listing and detail APIs.

Acceptance criteria:

- Blogs can be filtered by organization, category, tag, featured state, and status.
- Published blogs increment analytics views.
- Blog updates are audited.

### Phase 9: Events

Goal: implement event lifecycle management.

Deliverables:

- Event CRUD.
- Event type, mode, venue, organizer, registration link, dates, times, timezone, and contact fields.
- Featured event support.
- Calendar integration-ready fields.
- Registration tracking placeholders.
- Organization, media, SEO, taxonomy, workflow, and audit integration.

Acceptance criteria:

- Invalid event date ranges are blocked.
- Completed or expired events can be archived.
- Published events are available through public listing and detail APIs.

### Phase 10: Announcements

Goal: implement notices and announcement publishing.

Deliverables:

- Announcement type management.
- Announcement CRUD.
- Type-specific validation:
  - Title plus PDF requires PDF media.
  - Title plus description requires summary/description.
  - Full content requires rich content.
- Validity dates and priority levels.
- Organization, media, SEO, taxonomy, workflow, and audit integration.

Acceptance criteria:

- Expired announcements do not appear in public listings.
- Type-specific required fields are enforced before review/publish.
- Published announcements can be filtered by organization, category, type, and priority.

### Phase 11: Achievements, Stories, and Clubs

Goal: implement showcase and community modules.

Deliverables:

- Achievement CRUD with achievement type, level, date, awarded-by, prize amount, featured support.
- Story CRUD with story type, person profile fields, company, graduation year, LinkedIn URL, featured support.
- Club management through `organizations` plus `club_details`.
- Club-specific pages, leadership, social links, joining process, gallery/media, event associations.
- Organization, media, SEO, taxonomy, workflow, and audit integration.

Acceptance criteria:

- Achievements and stories can be featured on public surfaces.
- Clubs inherit organization-scoped permissions.
- Clubs linked to active content/events cannot be hard-deleted.

### Phase 12: Notifications, Scheduler, Search, and Analytics

Goal: add operational automation and discovery.

Deliverables:

- Notification templates and in-app notifications.
- Workflow notifications for submit, approve, reject, publish, failed jobs, and permission changes.
- Scheduled publishing.
- Automated archival.
- Sitemap generation jobs.
- Search indexing and re-indexing after content updates.
- Public search with content type, organization, category, tag, pagination, and sorting filters.
- Entity view analytics and admin reports.

Acceptance criteria:

- Scheduled jobs write execution/audit logs.
- Search excludes archived and inactive content.
- Notifications track read/unread state.
- Analytics dashboards can report content views, search trends, event engagement, and workflow performance.

### Phase 13: Hardening and Operations

Goal: prepare the platform for enterprise operation.

Deliverables:

- SQL injection, XSS, CSRF, CSP, secure cookie, and upload security hardening.
- Rate limiting for auth and APIs.
- Accessibility checks against WCAG expectations.
- Responsive UI validation.
- Backup and restore procedures.
- Disaster recovery plan with RTO/RPO targets.
- Monitoring, health checks, alerting, and centralized logs.
- Performance tuning for indexes, caching, CDN, and background jobs.

Acceptance criteria:

- System targets 99.9% uptime excluding planned maintenance.
- Backup restore tests are documented.
- Critical API paths are covered by automated tests.
- Public pages meet accessibility and responsive layout expectations.

## 6. Public API and Interface Guidelines

All APIs should use versioned REST paths, such as `/api/v1/admin/...` and `/api/v1/public/...`.

Administrative APIs must require authentication and authorization. Public APIs must only expose published, active, non-archived content.

Standard response shape:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "errors": []
}
```

Standard error behavior:

- `400` for validation failures.
- `401` for unauthenticated access.
- `403` for authenticated but unauthorized access.
- `404` for missing or inaccessible records.
- `409` for unique constraint and workflow state conflicts.
- `500` for unexpected server errors.

## 7. Testing Strategy

Testing must scale with module risk:

- Database tests for migrations, constraints, seed data, FK integrity, and status constraints.
- Auth tests for Google callback handling, unknown email rejection, inactive user rejection, and login logging.
- Authorization tests for global roles, scoped roles, overrides, and deny-by-default behavior.
- Workflow tests for legal and illegal transitions.
- Module tests for CRUD, validation, organization mapping, taxonomy/media/SEO integration, public visibility, and audit records.
- Search tests for published-only visibility, filters, pagination, and archived exclusion.
- Scheduler tests for scheduled publish, archival, retries, and execution logs.
- Accessibility and responsive tests for admin and public UI.

## 8. Assumptions and Defaults

- Authentication is Google OAuth-only in v1.
- Internal users must be created before login.
- PostgreSQL on AWS is the database target.
- Universal polymorphic tables are preferred over module-specific mapping tables.
- Soft delete or archival is preferred over hard delete for major entities.
- Public APIs only expose published and active content.
- All backend APIs enforce authorization server-side.
- Audit logs are append-only.
- The first implementation milestone is database initialization, followed by authentication and RBAC.
