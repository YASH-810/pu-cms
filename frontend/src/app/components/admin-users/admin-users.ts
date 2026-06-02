import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrganizationService, Organization } from '../../services/organization.service';
import { ToastService } from '../../services/toast.service';
import { User, UserDetails, UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Access Governance</p>
          <h1>User Management</h1>
          <p>Manage pre-created Google OAuth users, global roles, and organization scope.</p>
        </div>
        <button type="button" class="primary-button" (click)="openCreateModal()">Create User</button>
      </header>


      <section class="data-card">
        <div class="card-toolbar">
          <div class="search-field">
            <label for="user-search">Search</label>
            <input id="user-search" [(ngModel)]="searchQuery" (ngModelChange)="onSearchChange()" placeholder="Name or email" />
          </div>
          <div class="select-field">
            <label for="user-status">Status</label>
            <select id="user-status" [(ngModel)]="statusFilter" (change)="onFilterChange()">
              <option value="all">All accounts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (isLoading()) {
                <tr><td colspan="5" class="empty-cell">Loading users...</td></tr>
              } @else if (users().length === 0) {
                <tr><td colspan="5" class="empty-cell">No users match the current filter.</td></tr>
              } @else {
                @for (user of users(); track user.id) {
                  <tr>
                    <td>
                      <div class="identity-cell">
                        <div class="avatar">{{ getInitials(user.full_name) }}</div>
                        <div>
                          <strong>{{ user.full_name }}</strong>
                          <span>{{ user.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td><span class="pill" [class.pill-active]="user.is_active">{{ user.is_active ? 'Active' : 'Inactive' }}</span></td>
                    <td>{{ user.last_login_at ? (user.last_login_at | date:'mediumDate') : 'Never' }}</td>
                    <td>{{ user.created_at | date:'mediumDate' }}</td>
                    <td class="right">
                      <div class="dropdown">
                        <button type="button" class="ghost-button" (click)="toggleRowDropdown(user.id)">...</button>
                        @if (activeRowDropdown() === user.id) {
                          <div class="dropdown-menu">
                            <button type="button" (click)="viewDetails(user.id); toggleRowDropdown(user.id)">Roles</button>
                            <button type="button" (click)="toggleUserStatus(user); toggleRowDropdown(user.id)">{{ user.is_active ? 'Deactivate' : 'Activate' }}</button>
                            <button type="button" style="color:var(--color-danger)" (click)="deleteUser(user.id); toggleRowDropdown(user.id)">Delete</button>
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <footer class="table-footer">
          <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
          <div>
            <button type="button" class="ghost-button" [disabled]="currentPage() === 1" (click)="setPage(currentPage() - 1)">Previous</button>
            <button type="button" class="ghost-button" [disabled]="currentPage() === totalPages()" (click)="setPage(currentPage() + 1)">Next</button>
          </div>
        </footer>
      </section>

      @if (showCreateModal()) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <form class="modal-card" (click)="$event.stopPropagation()" (ngSubmit)="submitCreateUser()">
            <header>
              <div>
                <p class="eyebrow">New Internal User</p>
                <h2>Create User</h2>
              </div>
              <button type="button" class="icon-close" (click)="closeCreateModal()">×</button>
            </header>

            <label class="form-field">
              <span>Email Address</span>
              <input type="email" [(ngModel)]="newUser.email" name="email" placeholder="name@pu.edu" required />
            </label>

            <label class="form-field">
              <span>Full Name</span>
              <input [(ngModel)]="newUser.full_name" name="fullName" placeholder="Jane Doe" required />
            </label>

            <label class="form-field">
              <span>Role</span>
              <select [(ngModel)]="newUser.role_id" name="roleId" required>
                <option value="">Select role</option>
                @for (role of getFilteredRoles(); track role.id) {
                  <option [value]="role.id">{{ role.name }}</option>
                }
              </select>
            </label>

            <label class="form-field">
              <span>Organization {{ auth.isSchoolAdmin() ? '' : '(Optional)' }}</span>
              <select [(ngModel)]="newUser.organization_id" name="organizationId" required>
                @if (!auth.isSchoolAdmin()) {
                  <option value="">None (Global Role)</option>
                }
                @for (org of organizations(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>

            <footer>
              <button type="button" class="ghost-button" (click)="closeCreateModal()">Cancel</button>
              <button type="submit" class="primary-button">Create Account</button>
            </footer>
          </form>
        </div>
      }

      @if (selectedUserDetails(); as detail) {
        <div class="modal-backdrop" (click)="closeDetailsModal()">
          <section class="modal-card wide" (click)="$event.stopPropagation()">
            <header>
              <div>
                <p class="eyebrow">Authorization Profile</p>
                <h2>{{ detail.full_name }}</h2>
              </div>
              <button type="button" class="icon-close" (click)="closeDetailsModal()">×</button>
            </header>

            <div class="detail-grid">
              @if (!auth.isSchoolAdmin()) {
                <section>
                  <h3>Global Roles</h3>
                  <div class="role-grid">
                    @for (role of getFilteredRoles(); track role.id) {
                      <label class="role-option">
                        <input type="checkbox" [checked]="hasGlobalRole(role.id)" (change)="toggleGlobalRole(role.id)" />
                        <span><strong>{{ role.name }}</strong><small>{{ role.description }}</small></span>
                      </label>
                    }
                  </div>
                  <button type="button" class="primary-button full" (click)="saveGlobalRoles()">Save Roles</button>
                </section>
              }

              <section [style.gridColumn]="auth.isSchoolAdmin() ? 'span 2' : 'span 1'">
                <h3>Organization Scope</h3>
                <div class="scope-list">
                  @if (detail.organization_roles.length === 0) {
                    <p class="muted">No scoped authority assigned.</p>
                  } @else {
                    @for (scope of detail.organization_roles; track scope.organization_id + scope.role_id) {
                      <div class="scope-row" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                          <strong>{{ scope.organization_name }}</strong>
                          <span style="margin-left: 8px;" class="pill">{{ scope.role_name.replace('_', ' ') | titlecase }}</span>
                        </div>
                        <button type="button" class="ghost-button" style="color:var(--color-danger); padding: 4px 8px; font-size: 0.8rem;" (click)="removeOrganizationRole(scope.organization_id, scope.role_id)">Remove</button>
                      </div>
                    }
                  }
                </div>
                <div class="inline-form">
                  <select [(ngModel)]="newScope.organization_id">
                    <option value="">Select organization</option>
                    @for (org of organizations(); track org.id) {
                      <option [value]="org.id">{{ org.name }}</option>
                    }
                  </select>
                  <select [(ngModel)]="newScope.role_id">
                    <option value="">Select role</option>
                    @for (role of getFilteredRoles(); track role.id) {
                      <option [value]="role.id">{{ role.name }}</option>
                    }
                  </select>
                </div>
                <button type="button" class="ghost-button full" (click)="assignOrganizationRole()">Assign Scope</button>
              </section>
            </div>
          </section>
        </div>
      }
    </section>
  `,
  styleUrl: '../admin-shared.scss'
})
export class AdminUsers implements OnInit {
  private readonly userService = inject(UserService);
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  users = signal<User[]>([]);
  organizations = signal<Organization[]>([]);
  availableRoles = signal<any[]>([]);
  isLoading = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);
  totalUsers = signal(0);
  searchQuery = '';
  statusFilter = 'all';
  showCreateModal = signal(false);
  selectedUserDetails = signal<UserDetails | null>(null);
  newUser = { email: '', full_name: '', role_id: '', organization_id: '' };
  newScope = { organization_id: '', role_id: '' };
  activeRowDropdown = signal<string | null>(null);

  activeCount = signal(0);

  constructor() {
    effect(() => {
      if (this.auth.context()) {
        this.loadOrganizations();
      }
    });
  }

  toggleRowDropdown(id: string) {
    if (this.activeRowDropdown() === id) {
      this.activeRowDropdown.set(null);
    } else {
      this.activeRowDropdown.set(id);
    }
  }

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers() {
    this.isLoading.set(true);
    const active = this.statusFilter === 'all' ? undefined : this.statusFilter === 'active';
    this.userService.listUsers(this.searchQuery || undefined, active, this.currentPage(), 10).subscribe({
      next: (result) => {
        this.users.set(result.users);
        this.activeCount.set(result.users.filter((user) => user.is_active).length);
        this.totalPages.set(result.pagination?.pages || 1);
        this.totalUsers.set(result.pagination?.total || 0);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.toast.fromApiError(error, 'Failed to load users');
      }
    });
  }

  loadOrganizations() {
    this.orgService.listOrganizations(undefined, true).subscribe({
      next: (orgs) => {
        if (this.auth.isSchoolAdmin()) {
          const scopedIds = this.auth.orgScope().map(o => o.organizationId);
          const allowed = orgs.filter(org => {
            let current: Organization | undefined = org;
            while (current) {
              if (scopedIds.includes(current.id)) return true;
              const pId: string | null = current.parent_id;
              current = pId ? orgs.find(o => o.id === pId) : undefined;
            }
            return false;
          });
          this.organizations.set(allowed);
        } else {
          this.organizations.set(orgs);
        }
      },
      error: () => undefined
    });
  }

  loadRoles() {
    this.userService.listRoles().subscribe({
      next: (roles) => this.availableRoles.set(roles),
      error: (error) => this.toast.fromApiError(error, 'Failed to load roles')
    });
  }

  onSearchChange() {
    this.currentPage.set(1);
    this.loadUsers();
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.loadUsers();
  }

  setPage(page: number) {
    this.currentPage.set(page);
    this.loadUsers();
  }

  getCurrentUserHierarchyLevel(): number {
    const context = this.auth.context();
    if (!context) return 99;

    const globalLevels = context.globalRoles?.map(r => r.hierarchyLevel) || [];
    const scopedLevels = context.organizationScope?.map(scope => {
      const name = scope.roleName;
      if (name === 'SUPER_ADMIN') return 1;
      if (name === 'UNIVERSITY_ADMIN') return 2;
      if (name === 'SCHOOL_ADMIN') return 3;
      if (name === 'EDITOR') return 4;
      if (name === 'REVIEWER') return 5;
      if (name === 'CONTENT_CREATOR') return 6;
      return 99;
    }) || [];

    const allLevels = [...globalLevels, ...scopedLevels];
    if (allLevels.length === 0) return 99;
    return Math.min(...allLevels);
  }

  getFilteredRoles() {
    const roles = this.availableRoles();
    const userLevel = this.getCurrentUserHierarchyLevel();
    return roles.filter(role => role.hierarchy_level >= userLevel);
  }

  openCreateModal() {
    const defaultOrgId = this.auth.isSchoolAdmin() && this.organizations().length > 0
      ? this.organizations()[0].id
      : '';
    const defaultRoleId = this.getFilteredRoles().length > 0
      ? this.getFilteredRoles()[0].id
      : '';
    this.newUser = { email: '', full_name: '', role_id: defaultRoleId, organization_id: defaultOrgId };
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  submitCreateUser() {
    if (!this.newUser.email || !this.newUser.full_name || !this.newUser.role_id) {
      this.toast.error('Validation failed', 'Email, full name, and role are required.');
      return;
    }

    if (this.auth.isSchoolAdmin() && !this.newUser.organization_id) {
      this.toast.error('Validation failed', 'Organization is required.');
      return;
    }

    this.userService.createUser(this.newUser).subscribe({
      next: () => {
        this.toast.success('User created');
        this.closeCreateModal();
        this.loadUsers();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to create user')
    });
  }

  toggleUserStatus(user: User) {
    this.userService.toggleStatus(user.id, !user.is_active).subscribe({
      next: () => {
        this.toast.success(user.is_active ? 'User deactivated' : 'User activated');
        this.loadUsers();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to update user')
    });
  }

  deleteUser(id: string) {
    if (!confirm('Soft delete this user account?')) return;
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.toast.success('User deleted');
        this.loadUsers();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to delete user')
    });
  }

  viewDetails(userId: string) {
    this.userService.getUser(userId).subscribe({
      next: (details) => this.selectedUserDetails.set(details),
      error: (error) => this.toast.fromApiError(error, 'Failed to load authorization profile')
    });
  }

  closeDetailsModal() {
    this.selectedUserDetails.set(null);
  }

  hasGlobalRole(roleId: string): boolean {
    return this.selectedUserDetails()?.global_roles.some((role) => role.id === roleId) ?? false;
  }

  toggleGlobalRole(roleId: string) {
    const detail = this.selectedUserDetails();
    if (!detail) return;
    if (this.hasGlobalRole(roleId)) detail.global_roles = detail.global_roles.filter((role) => role.id !== roleId);
    else {
      const role = this.availableRoles().find((item) => item.id === roleId);
      if (role) detail.global_roles.push(role);
    }
  }

  saveGlobalRoles() {
    const detail = this.selectedUserDetails();
    if (!detail) return;
    this.userService.assignGlobalRoles(detail.id, detail.global_roles.map((role) => role.id)).subscribe({
      next: () => this.toast.success('Global roles updated'),
      error: (error) => this.toast.fromApiError(error, 'Failed to update roles')
    });
  }

  assignOrganizationRole() {
    const detail = this.selectedUserDetails();
    if (!detail || !this.newScope.organization_id || !this.newScope.role_id) {
      this.toast.error('Validation failed', 'Select both organization and role.');
      return;
    }

    this.userService.assignOrgRole(detail.id, this.newScope.organization_id, this.newScope.role_id).subscribe({
      next: () => {
        this.toast.success('Organization scope assigned');
        this.newScope = { organization_id: '', role_id: '' };
        this.viewDetails(detail.id);
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to assign scope')
    });
  }

  removeOrganizationRole(orgId: string, roleId: string) {
    const detail = this.selectedUserDetails();
    if (!detail) return;

    if (!confirm('Remove this organization scope?')) return;

    this.userService.removeOrgRole(detail.id, orgId, roleId).subscribe({
      next: () => {
        this.toast.success('Organization scope removed');
        this.viewDetails(detail.id);
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to remove scope')
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
