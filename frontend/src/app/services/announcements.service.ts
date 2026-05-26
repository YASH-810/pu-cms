import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AnnouncementType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

export interface Announcement {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  announcement_type_id: string;
  announcement_type_slug?: string;
  announcement_type_name?: string;
  summary: string | null;
  body_html: string | null;
  pdf_url: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  valid_from: string;
  valid_until: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
  total: number;
}

export interface CreateAnnouncementPayload {
  title: string;
  slug: string;
  announcement_type_id: string;
  summary?: string | null;
  body_html?: string | null;
  pdf_url?: string | null;
  priority?: string;
  valid_from?: string;
  valid_until?: string | null;
  organization_ids?: string[];
}

export interface UpdateAnnouncementPayload {
  title?: string;
  slug?: string;
  announcement_type_id?: string;
  summary?: string | null;
  body_html?: string | null;
  pdf_url?: string | null;
  priority?: string;
  valid_from?: string;
  valid_until?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly http = inject(HttpClient);

  listAnnouncementTypes(): Observable<AnnouncementType[]> {
    return this.http.get<{ data: AnnouncementType[] }>('/api/v1/admin/announcements/types').pipe(
      map((res) => res.data)
    );
  }

  listAnnouncements(params: { status?: string; announcement_type_id?: string; priority?: string; search?: string; limit?: number; offset?: number } = {}): Observable<AnnouncementListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.announcement_type_id) httpParams = httpParams.set('announcement_type_id', params.announcement_type_id);
    if (params.priority) httpParams = httpParams.set('priority', params.priority);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: AnnouncementListResponse }>('/api/v1/admin/announcements', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getAnnouncement(id: string): Observable<Announcement> {
    return this.http.get<{ data: Announcement }>(`/api/v1/admin/announcements/${id}`).pipe(map((res) => res.data));
  }

  createAnnouncement(payload: CreateAnnouncementPayload): Observable<Announcement> {
    return this.http.post<{ data: Announcement }>('/api/v1/admin/announcements', payload).pipe(map((res) => res.data));
  }

  updateAnnouncement(id: string, payload: UpdateAnnouncementPayload): Observable<Announcement> {
    return this.http.patch<{ data: Announcement }>(`/api/v1/admin/announcements/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Announcement> {
    return this.http
      .post<{ data: Announcement }>(`/api/v1/admin/announcements/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deleteAnnouncement(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/announcements/${id}`).pipe(map((res) => res.data));
  }

  slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
