import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from './user.service';

export interface Organization {
  id: string;
  name: string;
  org_type: string;
  parent_id: string | null;
  slug: string;
  short_name: string | null;
  code: string | null;
  description: string | null;
  logo_url: string | null;
  banner_image: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgTreeNode {
  id: string;
  name: string;
  org_type: string;
  slug: string;
  is_active: boolean;
  parent_id: string | null;
  children: OrgTreeNode[];
}

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin/organizations';

  listOrganizations(search?: string, isActive?: boolean, orgType?: string): Observable<Organization[]> {
    let params: any = {};
    if (search) params.search = search;
    if (isActive !== undefined) params.is_active = String(isActive);
    if (orgType) params.org_type = orgType;

    return this.http.get<ApiResponse<{ organizations: Organization[] }>>(this.baseUrl, { params }).pipe(
      map(res => res.data.organizations)
    );
  }

  getOrganizationTree(): Observable<OrgTreeNode[]> {
    return this.http.get<ApiResponse<{ tree: OrgTreeNode[] }>>(`${this.baseUrl}/tree`).pipe(
      map(res => res.data.tree)
    );
  }

  getOrganization(id: string): Observable<Organization> {
    return this.http.get<ApiResponse<Organization>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  createOrganization(org: Partial<Organization>): Observable<Organization> {
    return this.http.post<ApiResponse<Organization>>(this.baseUrl, org).pipe(
      map(res => res.data)
    );
  }

  updateOrganization(id: string, org: Partial<Organization>): Observable<Organization> {
    return this.http.put<ApiResponse<Organization>>(`${this.baseUrl}/${id}`, org).pipe(
      map(res => res.data)
    );
  }

  toggleStatus(id: string, isActive: boolean): Observable<Organization> {
    return this.http.patch<ApiResponse<Organization>>(`${this.baseUrl}/${id}/status`, { is_active: isActive }).pipe(
      map(res => res.data)
    );
  }

  deleteOrganization(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }
}
