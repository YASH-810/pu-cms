import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Achievement {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  achievement_type: string;
  level: 'international' | 'national' | 'state' | 'university' | 'school';
  awarded_at: string;
  awarded_by: string;
  prize_amount: number | null;
  is_featured: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AchievementListResponse {
  achievements: Achievement[];
  total: number;
}

export interface CreateAchievementPayload {
  title: string;
  slug: string;
  achievement_type: string;
  level: string;
  awarded_at: string;
  awarded_by: string;
  prize_amount?: number | null;
  is_featured?: boolean;
  organization_ids?: string[];
}

export interface UpdateAchievementPayload {
  title?: string;
  slug?: string;
  achievement_type?: string;
  level?: string;
  awarded_at?: string;
  awarded_by?: string;
  prize_amount?: number | null;
  is_featured?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly http = inject(HttpClient);

  listAchievements(params: { status?: string; achievement_type?: string; level?: string; is_featured?: boolean; search?: string; limit?: number; offset?: number } = {}): Observable<AchievementListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.achievement_type) httpParams = httpParams.set('achievement_type', params.achievement_type);
    if (params.level) httpParams = httpParams.set('level', params.level);
    if (params.is_featured !== undefined) httpParams = httpParams.set('is_featured', String(params.is_featured));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: AchievementListResponse }>('/api/v1/admin/achievements', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getAchievement(id: string): Observable<Achievement> {
    return this.http.get<{ data: Achievement }>(`/api/v1/admin/achievements/${id}`).pipe(map((res) => res.data));
  }

  createAchievement(payload: CreateAchievementPayload): Observable<Achievement> {
    return this.http.post<{ data: Achievement }>('/api/v1/admin/achievements', payload).pipe(map((res) => res.data));
  }

  updateAchievement(id: string, payload: UpdateAchievementPayload): Observable<Achievement> {
    return this.http.patch<{ data: Achievement }>(`/api/v1/admin/achievements/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Achievement> {
    return this.http
      .post<{ data: Achievement }>(`/api/v1/admin/achievements/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deleteAchievement(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/achievements/${id}`).pipe(map((res) => res.data));
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
