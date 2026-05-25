import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from './user.service';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content_type_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentType {
  id: string;
  name: string;
  table_name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaxonomyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin';

  // Categories
  listCategories(search?: string, contentTypeId?: string): Observable<Category[]> {
    let params: any = {};
    if (search) params.search = search;
    if (contentTypeId) params.content_type_id = contentTypeId;

    return this.http.get<ApiResponse<{ categories: Category[] }>>(`${this.baseUrl}/categories`, { params }).pipe(
      map(res => res.data.categories)
    );
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<ApiResponse<Category>>(`${this.baseUrl}/categories`, category).pipe(
      map(res => res.data)
    );
  }

  updateCategory(id: string, category: Partial<Category>): Observable<Category> {
    return this.http.put<ApiResponse<Category>>(`${this.baseUrl}/categories/${id}`, category).pipe(
      map(res => res.data)
    );
  }

  deleteCategory(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/categories/${id}`).pipe(
      map(res => res.success)
    );
  }

  // Tags
  listTags(search?: string): Observable<Tag[]> {
    let params: any = {};
    if (search) params.search = search;

    return this.http.get<ApiResponse<{ tags: Tag[] }>>(`${this.baseUrl}/tags`, { params }).pipe(
      map(res => res.data.tags)
    );
  }

  createTag(tag: Partial<Tag>): Observable<Tag> {
    return this.http.post<ApiResponse<Tag>>(`${this.baseUrl}/tags`, tag).pipe(
      map(res => res.data)
    );
  }

  updateTag(id: string, tag: Partial<Tag>): Observable<Tag> {
    return this.http.put<ApiResponse<Tag>>(`${this.baseUrl}/tags/${id}`, tag).pipe(
      map(res => res.data)
    );
  }

  deleteTag(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/tags/${id}`).pipe(
      map(res => res.success)
    );
  }

  // Content Types
  listContentTypes(): Observable<ContentType[]> {
    return this.http.get<ApiResponse<{ contentTypes: ContentType[] }>>(`${this.baseUrl}/content-types`).pipe(
      map(res => res.data.contentTypes)
    );
  }

  getContentType(id: string): Observable<ContentType> {
    return this.http.get<ApiResponse<ContentType>>(`${this.baseUrl}/content-types/${id}`).pipe(
      map(res => res.data)
    );
  }

  updateContentType(id: string, ct: Partial<ContentType>): Observable<ContentType> {
    return this.http.put<ApiResponse<ContentType>>(`${this.baseUrl}/content-types/${id}`, ct).pipe(
      map(res => res.data)
    );
  }
}
