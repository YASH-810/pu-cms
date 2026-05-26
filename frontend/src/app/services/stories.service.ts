import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Story {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  story_type: string;
  person_name: string;
  person_role: 'student' | 'alumnus' | 'researcher' | 'faculty' | 'other';
  company: string | null;
  graduation_year: number | null;
  linkedin_url: string | null;
  is_featured: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface StoryListResponse {
  stories: Story[];
  total: number;
}

export interface CreateStoryPayload {
  title: string;
  slug: string;
  story_type: string;
  person_name: string;
  person_role: string;
  company?: string | null;
  graduation_year?: number | null;
  linkedin_url?: string | null;
  is_featured?: boolean;
  organization_ids?: string[];
}

export interface UpdateStoryPayload {
  title?: string;
  slug?: string;
  story_type?: string;
  person_name?: string;
  person_role?: string;
  company?: string | null;
  graduation_year?: number | null;
  linkedin_url?: string | null;
  is_featured?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly http = inject(HttpClient);

  listStories(params: { status?: string; story_type?: string; person_role?: string; is_featured?: boolean; search?: string; limit?: number; offset?: number } = {}): Observable<StoryListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.story_type) httpParams = httpParams.set('story_type', params.story_type);
    if (params.person_role) httpParams = httpParams.set('person_role', params.person_role);
    if (params.is_featured !== undefined) httpParams = httpParams.set('is_featured', String(params.is_featured));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: StoryListResponse }>('/api/v1/admin/stories', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getStory(id: string): Observable<Story> {
    return this.http.get<{ data: Story }>(`/api/v1/admin/stories/${id}`).pipe(map((res) => res.data));
  }

  createStory(payload: CreateStoryPayload): Observable<Story> {
    return this.http.post<{ data: Story }>('/api/v1/admin/stories', payload).pipe(map((res) => res.data));
  }

  updateStory(id: string, payload: UpdateStoryPayload): Observable<Story> {
    return this.http.patch<{ data: Story }>(`/api/v1/admin/stories/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Story> {
    return this.http
      .post<{ data: Story }>(`/api/v1/admin/stories/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deleteStory(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/stories/${id}`).pipe(map((res) => res.data));
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
