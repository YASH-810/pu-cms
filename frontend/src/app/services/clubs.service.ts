import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Club {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  organization_id: string;
  organization_name?: string;
  organization_slug?: string;
  leadership: Record<string, unknown> | null;
  social_links: Record<string, unknown> | null;
  meeting_schedule: string | null;
  joining_process: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ClubListResponse {
  clubs: Club[];
  total: number;
}

export interface CreateClubPayload {
  title: string;
  slug: string;
  organization_id: string;
  leadership?: Record<string, unknown> | null;
  social_links?: Record<string, unknown> | null;
  meeting_schedule?: string | null;
  joining_process?: string | null;
}

export interface UpdateClubPayload {
  title?: string;
  slug?: string;
  organization_id?: string;
  leadership?: Record<string, unknown> | null;
  social_links?: Record<string, unknown> | null;
  meeting_schedule?: string | null;
  joining_process?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClubsService {
  private readonly http = inject(HttpClient);

  listClubs(params: { status?: string; organization_id?: string; search?: string; limit?: number; offset?: number } = {}): Observable<ClubListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.organization_id) httpParams = httpParams.set('organization_id', params.organization_id);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: ClubListResponse }>('/api/v1/admin/clubs', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getClub(id: string): Observable<Club> {
    return this.http.get<{ data: Club }>(`/api/v1/admin/clubs/${id}`).pipe(map((res) => res.data));
  }

  createClub(payload: CreateClubPayload): Observable<Club> {
    return this.http.post<{ data: Club }>('/api/v1/admin/clubs', payload).pipe(map((res) => res.data));
  }

  updateClub(id: string, payload: UpdateClubPayload): Observable<Club> {
    return this.http.patch<{ data: Club }>(`/api/v1/admin/clubs/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Club> {
    return this.http
      .post<{ data: Club }>(`/api/v1/admin/clubs/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deleteClub(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/clubs/${id}`).pipe(map((res) => res.data));
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
