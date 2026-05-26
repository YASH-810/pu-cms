import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SearchResultItem {
  entity_id: string;
  title: string;
  status: string;
  content_type_slug: string;
  updated_at: string;
  rank?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
}

export interface SearchParams {
  q: string;
  content_type?: string;
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  limit?: number;
  offset?: number;
  sort?: 'relevance' | 'date';
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  globalSearch(params: SearchParams): Observable<SearchResponse> {
    let httpParams = new HttpParams().set('q', params.q);
    
    if (params.content_type) httpParams = httpParams.set('content_type', params.content_type);
    if (params.organization_id) httpParams = httpParams.set('organization_id', params.organization_id);
    if (params.category_id) httpParams = httpParams.set('category_id', params.category_id);
    if (params.tag_id) httpParams = httpParams.set('tag_id', params.tag_id);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));
    if (params.sort) httpParams = httpParams.set('sort', params.sort);

    return this.http.get<{ data: SearchResponse }>('/api/v1/public/search', { params: httpParams }).pipe(
      map(res => res.data)
    );
  }
}
