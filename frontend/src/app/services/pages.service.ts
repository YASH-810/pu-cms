import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Page {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  summary: string | null;
  body_html: string | null;
  template: string;
  hero_image_url: string | null;
  is_featured: boolean;
  show_in_nav: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PageListResponse {
  pages: Page[];
  total: number;
}

export interface CreatePagePayload {
  title: string;
  slug: string;
  summary?: string | null;
  body_html?: string | null;
  template?: string;
  hero_image_url?: string | null;
  is_featured?: boolean;
  show_in_nav?: boolean;
  organization_ids?: string[];
}

export interface UpdatePagePayload {
  title?: string;
  slug?: string;
  summary?: string | null;
  body_html?: string | null;
  template?: string;
  hero_image_url?: string | null;
  is_featured?: boolean;
  show_in_nav?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PagesService {
  private readonly http = inject(HttpClient);

  listPages(params: { status?: string; is_featured?: boolean; search?: string; limit?: number; offset?: number } = {}): Observable<PageListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.is_featured !== undefined) httpParams = httpParams.set('is_featured', String(params.is_featured));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: PageListResponse }>('/api/v1/admin/pages', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getPage(id: string): Observable<Page> {
    return this.http.get<{ data: Page }>(`/api/v1/admin/pages/${id}`).pipe(map((res) => res.data));
  }

  createPage(payload: CreatePagePayload): Observable<Page> {
    return this.http.post<{ data: Page }>('/api/v1/admin/pages', payload).pipe(map((res) => res.data));
  }

  updatePage(id: string, payload: UpdatePagePayload): Observable<Page> {
    return this.http.patch<{ data: Page }>(`/api/v1/admin/pages/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Page> {
    return this.http
      .post<{ data: Page }>(`/api/v1/admin/pages/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deletePage(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/pages/${id}`).pipe(map((res) => res.data));
  }

  /** Generate a URL-safe slug from a title */
  slugify(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
