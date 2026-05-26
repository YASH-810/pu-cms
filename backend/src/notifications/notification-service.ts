import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
}

export interface NotificationTemplateRow {
  id: string;
  code: string;
  subject_template: string;
  body_template: string;
  created_at: Date;
  updated_at: Date;
}

export interface ListNotificationsFilter {
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  public constructor(private readonly db: Knex) {}

  // -------------------------------------------------------------------------
  // In-App Notifications CRUD
  // -------------------------------------------------------------------------
  public async createNotification(
    userId: string,
    title: string,
    body: string,
    actionUrl?: string | null
  ): Promise<NotificationRow> {
    const [notification] = await this.db('notifications')
      .insert({
        user_id: userId,
        title: title.trim(),
        body: body.trim(),
        action_url: actionUrl ?? null,
        is_read: false,
        read_at: null
      })
      .returning('*');

    return notification as NotificationRow;
  }

  public async sendNotificationFromTemplate(
    userId: string,
    templateCode: string,
    templateParams: Record<string, string>,
    actionUrl?: string | null
  ): Promise<NotificationRow> {
    const template = await this.db('notification_templates')
      .where({ code: templateCode })
      .whereNull('deleted_at')
      .first();

    let subject = `Notification: ${templateCode}`;
    let body = `Details: ${JSON.stringify(templateParams)}`;

    if (template) {
      subject = template.subject_template;
      body = template.body_template;
      for (const [key, val] of Object.entries(templateParams)) {
        subject = subject.replace(new RegExp(`{${key}}`, 'g'), val);
        body = body.replace(new RegExp(`{${key}}`, 'g'), val);
      }
    }

    return this.createNotification(userId, subject, body, actionUrl);
  }

  public async listNotifications(
    userId: string,
    filter: ListNotificationsFilter
  ): Promise<{ notifications: NotificationRow[]; total: number }> {
    const query = this.db('notifications').where({ user_id: userId });

    if (filter.isRead !== undefined) {
      query.where({ is_read: filter.isRead });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      notifications: rows as NotificationRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  public async getUnreadCount(userId: string): Promise<number> {
    const countRow = await this.db('notifications')
      .where({ user_id: userId, is_read: false })
      .count('id as total')
      .first();

    return Number((countRow as { total: string } | undefined)?.total ?? 0);
  }

  public async markAsRead(userId: string, notificationIds?: string[] | string): Promise<void> {
    const query = this.db('notifications').where({ user_id: userId, is_read: false });

    if (notificationIds) {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      if (ids.length > 0) {
        query.whereIn('id', ids);
      } else {
        return;
      }
    }

    await query.update({
      is_read: true,
      read_at: this.db.fn.now()
    });
  }

  // -------------------------------------------------------------------------
  // Notification Templates CRUD (Admin)
  // -------------------------------------------------------------------------
  public async listTemplates(): Promise<NotificationTemplateRow[]> {
    return this.db('notification_templates').whereNull('deleted_at').orderBy('code', 'asc');
  }

  public async updateTemplate(
    id: string,
    input: { subject_template?: string; body_template?: string },
    actorId: string
  ): Promise<NotificationTemplateRow> {
    const existing = await this.db('notification_templates')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      throw notFound('Template not found');
    }

    const updateData: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: actorId
    };

    if (input.subject_template !== undefined) updateData.subject_template = input.subject_template.trim();
    if (input.body_template !== undefined) updateData.body_template = input.body_template.trim();

    const [updated] = await this.db('notification_templates')
      .where({ id })
      .update(updateData)
      .returning('*');

    return updated as NotificationTemplateRow;
  }

  // -------------------------------------------------------------------------
  // Workflow Trigger Helper
  // -------------------------------------------------------------------------
  public async triggerWorkflowNotification(
    entityId: string,
    contentTypeSlug: string,
    action: 'submit' | 'approve' | 'reject' | 'publish',
    remarks: string | undefined,
    actorId: string
  ): Promise<void> {
    const entity = await this.db('content_entities').where({ id: entityId }).first();
    if (!entity) return;

    const remarksText = remarks || 'No remarks provided';

    // 1. Get primary organization to narrow down scoped reviewers
    const primaryOrg = await this.db('entity_organizations')
      .where({ entity_id: entityId, relation_type: 'primary' })
      .whereNull('deleted_at')
      .first();
    const orgId = primaryOrg ? String(primaryOrg.organization_id) : undefined;

    // 2. Identify the creator/owner to notify on feedback/approvals
    const ownerRecord = await this.db('entity_owners')
      .where({ entity_id: entityId, ownership_type: 'creator' })
      .whereNull('deleted_at')
      .first();
    const creatorId = ownerRecord ? String(ownerRecord.user_id) : String(entity.created_by);

    const actionUrl = `/admin/${contentTypeSlug}s`; // e.g. /admin/blogs or /admin/pages

    if (action === 'submit') {
      // Notify reviewers and admins
      const reviewerIds = await this.getUsersWithPermission(['REVIEW_CONTENT', 'APPROVE_CONTENT'], orgId);
      // Filter out the actor who submitted it
      const targetUserIds = reviewerIds.filter(id => id !== actorId);

      for (const userId of targetUserIds) {
        await this.sendNotificationFromTemplate(
          userId,
          'content_submission',
          {
            title: entity.title,
            remarks: remarksText
          },
          actionUrl
        );
      }
    } else if (action === 'approve') {
      if (creatorId && creatorId !== actorId) {
        await this.sendNotificationFromTemplate(
          creatorId,
          'content_approval',
          {
            title: entity.title,
            remarks: remarksText
          },
          actionUrl
        );
      }
    } else if (action === 'reject') {
      if (creatorId && creatorId !== actorId) {
        await this.sendNotificationFromTemplate(
          creatorId,
          'content_rejection',
          {
            title: entity.title,
            remarks: remarksText
          },
          actionUrl
        );
      }
    } else if (action === 'publish') {
      if (creatorId && creatorId !== actorId) {
        await this.sendNotificationFromTemplate(
          creatorId,
          'content_publication',
          {
            title: entity.title,
            remarks: remarksText
          },
          actionUrl
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private helper to resolve permissions
  // -------------------------------------------------------------------------
  private async getUsersWithPermission(permissionCodes: string[], orgId?: string): Promise<string[]> {
    const perms = await this.db('permissions').whereIn('code', permissionCodes).select('id');
    const permIds = perms.map(p => p.id);
    if (permIds.length === 0) return [];

    // Roles with these permissions
    const roles = await this.db('role_permissions').whereIn('permission_id', permIds).select('role_id');
    const roleIds = roles.map(r => r.role_id);

    // Users with these global roles
    const usersWithGlobalRoles = await this.db('user_roles')
      .whereIn('role_id', roleIds)
      .select('user_id');

    // Users with SUPER_ADMIN / UNIVERSITY_ADMIN global roles
    const adminRoles = await this.db('roles').whereIn('name', ['SUPER_ADMIN', 'UNIVERSITY_ADMIN']).select('id');
    const adminRoleIds = adminRoles.map(r => r.id);
    const adminUsers = await this.db('user_roles')
      .whereIn('role_id', adminRoleIds)
      .select('user_id');

    // Scoped permission overrides
    const scopedUsers = await this.db('user_scope_permissions')
      .whereIn('permission_id', permIds)
      .andWhere(q => {
        if (orgId) {
          q.where({ organization_id: orgId }).orWhereNull('organization_id');
        }
      })
      .select('user_id');

    const idsSet = new Set<string>();
    usersWithGlobalRoles.forEach(u => idsSet.add(String(u.user_id)));
    adminUsers.forEach(u => idsSet.add(String(u.user_id)));
    scopedUsers.forEach(u => idsSet.add(String(u.user_id)));

    if (idsSet.size === 0) return [];
    const activeUsers = await this.db('users')
      .whereIn('id', Array.from(idsSet))
      .where({ is_active: true })
      .whereNull('deleted_at')
      .select('id');

    return activeUsers.map(u => String(u.id));
  }
}
