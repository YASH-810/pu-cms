import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import type { ApiResponse } from './user.service';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  profileImage: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface OrganizationScope {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationType: string;
  roleId: string;
  roleName: string;
  assignedFrom: string | null;
  assignedTo: string | null;
}

export interface AuthContext {
  token?: string;
  user: AuthUser;
  globalRoles: Array<{
    id: string;
    name: string;
    description: string | null;
    hierarchyLevel: number;
  }>;
  organizationScope: OrganizationScope[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenKey = 'pu_cms_admin_token';
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(this.tokenKey));
  private readonly contextSignal = signal<AuthContext | null>(null);

  readonly token = computed(() => this.tokenSignal());
  readonly context = computed(() => this.contextSignal());
  readonly isAuthenticated = computed(() => Boolean(this.tokenSignal()));

  readonly isUniversityAdmin = computed(() => {
    const roles = this.contextSignal()?.globalRoles?.map(r => r.name) || [];
    return roles.includes('SUPER_ADMIN') || roles.includes('UNIVERSITY_ADMIN');
  });

  readonly isSchoolAdmin = computed(() => {
    const roles = this.contextSignal()?.globalRoles?.map(r => r.name) || [];
    return roles.includes('SCHOOL_ADMIN');
  });

  readonly orgScope = computed(() => {
    return this.contextSignal()?.organizationScope || [];
  });

  constructor(private readonly http: HttpClient) {}

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.tokenSignal.set(token);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    this.tokenSignal.set(null);
    this.contextSignal.set(null);
  }

  devLogin(email: string): Observable<AuthContext> {
    return this.http.post<ApiResponse<AuthContext>>('/api/v1/admin/auth/dev-token', { email }).pipe(
      map((response) => response.data),
      tap((context) => {
        if (context.token) {
          this.setToken(context.token);
        }
        this.contextSignal.set(context);
      })
    );
  }

  loadMe(): Observable<AuthContext> {
    return this.http.get<ApiResponse<AuthContext>>('/api/v1/admin/auth/me').pipe(
      map((response) => response.data),
      tap((context) => this.contextSignal.set(context))
    );
  }
}
