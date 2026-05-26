import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  subject_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);

  // User inbox methods
  listNotifications(params: { is_read?: boolean; limit?: number; offset?: number } = {}): Observable<NotificationListResponse> {
    let httpParams = new HttpParams();
    if (params.is_read !== undefined) httpParams = httpParams.set('is_read', String(params.is_read));
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: NotificationListResponse }>('/api/v1/notifications', { params: httpParams }).pipe(
      map(res => res.data)
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<{ data: { count: number } }>('/api/v1/notifications/unread-count').pipe(
      map(res => res.data.count)
    );
  }

  markAsRead(notificationIds?: string[] | string): Observable<boolean> {
    return this.http.patch<{ data: { success: boolean } }>('/api/v1/notifications/read', { notification_ids: notificationIds }).pipe(
      map(res => res.data.success)
    );
  }

  markSingleAsRead(id: string): Observable<boolean> {
    return this.http.patch<{ data: { success: boolean } }>(`/api/v1/notifications/${id}/read`, {}).pipe(
      map(res => res.data.success)
    );
  }

  // Admin template methods
  listTemplates(): Observable<NotificationTemplate[]> {
    return this.http.get<{ data: NotificationTemplate[] }>('/api/v1/admin/notification-templates').pipe(
      map(res => res.data)
    );
  }

  updateTemplate(id: string, payload: { subject_template?: string; body_template?: string }): Observable<NotificationTemplate> {
    return this.http.patch<{ data: NotificationTemplate }>(`/api/v1/admin/notification-templates/${id}`, payload).pipe(
      map(res => res.data)
    );
  }
}
