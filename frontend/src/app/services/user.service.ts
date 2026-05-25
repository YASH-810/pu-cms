import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: any;
  errors: any[];
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  profile_image: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDetails extends User {
  global_roles: any[];
  organization_roles: any[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin/users';

  listRoles(): Observable<any[]> {
    return this.http.get<ApiResponse<{ roles: any[] }>>('/api/v1/admin/roles').pipe(
      map(res => res.data.roles)
    );
  }

  listUsers(search?: string, isActive?: boolean, page: number = 1, limit: number = 20): Observable<{ users: User[]; pagination: any }> {
    let params: any = { page: String(page), limit: String(limit) };
    if (search) params.search = search;
    if (isActive !== undefined) params.is_active = String(isActive);

    return this.http.get<ApiResponse<{ users: User[]; pagination: any }>>(this.baseUrl, { params }).pipe(
      map(res => res.data)
    );
  }

  getUser(id: string): Observable<UserDetails> {
    return this.http.get<ApiResponse<UserDetails>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  createUser(user: Partial<User> & { global_roles?: string[] }): Observable<User> {
    return this.http.post<ApiResponse<User>>(this.baseUrl, user).pipe(
      map(res => res.data)
    );
  }

  updateUser(id: string, user: Partial<User>): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.baseUrl}/${id}`, user).pipe(
      map(res => res.data)
    );
  }

  toggleStatus(id: string, isActive: boolean): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${this.baseUrl}/${id}/status`, { is_active: isActive }).pipe(
      map(res => res.data)
    );
  }

  assignGlobalRoles(id: string, roleIds: string[]): Observable<boolean> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${id}/roles`, { role_ids: roleIds }).pipe(
      map(res => res.success)
    );
  }

  assignOrgRole(userId: string, orgId: string, roleId: string, isActive: boolean = true): Observable<boolean> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${userId}/organizations/${orgId}/roles`, {
      role_id: roleId,
      is_active: isActive
    }).pipe(
      map(res => res.success)
    );
  }

  deleteUser(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }
}
