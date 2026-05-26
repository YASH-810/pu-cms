import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Blog {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  summary: string | null;
  body_html: string | null;
  hero_image_url: string | null;
  author_id: string | null;
  author_name: string | null;
  reading_time: number;
  is_featured: boolean;
  is_pinned: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface BlogListResponse {
  blogs: Blog[];
  total: number;
}

export interface CreateBlogPayload {
  title: string;
  slug: string;
  summary?: string | null;
  body_html?: string | null;
  hero_image_url?: string | null;
  author_id?: string | null;
  is_featured?: boolean;
  is_pinned?: boolean;
  organization_ids?: string[];
}

export interface UpdateBlogPayload {
  title?: string;
  slug?: string;
  summary?: string | null;
  body_html?: string | null;
  hero_image_url?: string | null;
  author_id?: string | null;
  is_featured?: boolean;
  is_pinned?: boolean;
}

@Injectable({ providedIn: 'root' })
export class BlogsService {
  private readonly http = inject(HttpClient);

  listBlogs(params: { status?: string; is_featured?: boolean; is_pinned?: boolean; search?: string; limit?: number; offset?: number } = {}): Observable<BlogListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.is_featured !== undefined) httpParams = httpParams.set('is_featured', String(params.is_featured));
    if (params.is_pinned !== undefined) httpParams = httpParams.set('is_pinned', String(params.is_pinned));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: BlogListResponse }>('/api/v1/admin/blogs', { params: httpParams }).pipe(
      map((res) => res.data)
    );
  }

  getBlog(id: string): Observable<Blog> {
    return this.http.get<{ data: Blog }>(`/api/v1/admin/blogs/${id}`).pipe(map((res) => res.data));
  }

  createBlog(payload: CreateBlogPayload): Observable<Blog> {
    return this.http.post<{ data: Blog }>('/api/v1/admin/blogs', payload).pipe(map((res) => res.data));
  }

  updateBlog(id: string, payload: UpdateBlogPayload): Observable<Blog> {
    return this.http.patch<{ data: Blog }>(`/api/v1/admin/blogs/${id}`, payload).pipe(map((res) => res.data));
  }

  transitionStatus(id: string, status: string, remarks?: string): Observable<Blog> {
    return this.http
      .post<{ data: Blog }>(`/api/v1/admin/blogs/${id}/status`, { status, remarks })
      .pipe(map((res) => res.data));
  }

  deleteBlog(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ data: { success: boolean } }>(`/api/v1/admin/blogs/${id}`).pipe(map((res) => res.data));
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
