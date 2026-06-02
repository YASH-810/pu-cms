import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Organization, OrgTreeNode, OrganizationService } from '../../services/organization.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Institutional Model</p>
          <h1>Organizations</h1>
          <p>Maintain the university hierarchy with service-level cycle prevention.</p>
        </div>
        <button type="button" class="primary-button" (click)="openCreateModal()">Register Organization</button>
      </header>

      <section class="tree-panel">
        <article class="data-card">
          <div class="card-toolbar">
            <div>
              <h3>Hierarchy</h3>
              <p class="muted">Recursive organization tree</p>
            </div>
            <button type="button" class="ghost-button" (click)="loadTree()">Refresh</button>
          </div>
          <div class="tree-list">
            @if (isLoading()) {
              <p class="empty-cell">Loading organizations...</p>
            } @else if (treeNodes().length === 0) {
              <p class="empty-cell">No organizations have been registered.</p>
            } @else {
              @for (node of flattenedTree(); track node.id) {
                <button type="button" class="tree-node node-offset" [style.--depth]="node.depth" [class.active]="selectedOrg()?.id === node.id" (click)="selectNode(node.id)">
                  <strong>{{ node.name }}</strong>
                  <span class="muted">{{ node.org_type }} · {{ node.slug }}</span>
                </button>
              }
            }
          </div>
        </article>

        <article class="data-card">
          <div class="card-toolbar">
            <div>
              <h3>Profile</h3>
              <p class="muted">Selected organization governance details</p>
            </div>
          </div>

          @if (selectedOrg(); as org) {
            <div class="profile-panel">
              <div class="identity-cell">
                <div class="avatar">{{ (org.short_name || org.name).slice(0, 2).toUpperCase() }}</div>
                <div>
                  <strong>{{ org.name }}</strong>
                  <span>{{ org.slug }}</span>
                </div>
              </div>

              <div class="two-column details">
                <div><span>Type</span><strong>{{ org.org_type }}</strong></div>
                <div><span>Status</span><strong>{{ org.is_active ? 'Active' : 'Inactive' }}</strong></div>
                <div><span>Code</span><strong>{{ org.code || 'Not set' }}</strong></div>
                <div><span>Contact</span><strong>{{ org.contact_email || 'Not set' }}</strong></div>
                <div class="span-two"><span>Website</span><strong>{{ org.website_url || 'Not set' }}</strong></div>
                <div class="span-two"><span>Description</span><p>{{ org.description || 'No description provided.' }}</p></div>
              </div>

              <div class="row-actions profile-actions">
                <button type="button" class="ghost-button" (click)="openEditModal(org)">Edit</button>
                <button type="button" class="ghost-button" (click)="toggleOrgStatus(org)">{{ org.is_active ? 'Deactivate' : 'Activate' }}</button>
                <button type="button" class="danger-button" (click)="deleteOrg(org.id)">Soft Delete</button>
              </div>
            </div>
          } @else {
            <p class="empty-cell">Select an organization to view details.</p>
          }
        </article>
      </section>

      @if (showFormModal()) {
        <div class="modal-backdrop" (click)="closeFormModal()">
          <form class="modal-card" (click)="$event.stopPropagation()" (ngSubmit)="submitForm()">
            <header>
              <div>
                <p class="eyebrow">{{ isEditMode() ? 'Update Profile' : 'New Organization' }}</p>
                <h2>{{ isEditMode() ? 'Edit Organization' : 'Register Organization' }}</h2>
              </div>
              <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
            </header>

            <label class="form-field">
              <span>Organization Name</span>
              <input [(ngModel)]="formOrg.name" name="name" placeholder="Department of Computer Science" required />
            </label>

            <div class="two-column">
              <label class="form-field">
                <span>Slug</span>
                <input [(ngModel)]="formOrg.slug" name="slug" [disabled]="isEditMode()" placeholder="computer-science" required />
              </label>
              <label class="form-field">
                <span>Organization Type</span>
                <select [(ngModel)]="formOrg.org_type" (ngModelChange)="onOrgTypeChange($event)" name="orgType">
                  @for (type of getAvailableOrgTypes(); track type.value) {
                    <option [value]="type.value">{{ type.label }}</option>
                  }
                </select>
              </label>
            </div>

            <label class="form-field">
              <span>Parent Organization</span>
              <select [(ngModel)]="formOrg.parent_id" name="parentId">
                @if (!auth.isSchoolAdmin()) {
                  <option [ngValue]="null">None</option>
                } @else if (filteredParentOrgs().length === 0) {
                  <option [ngValue]="null" disabled>No valid parent organizations in your scope</option>
                }
                @for (parent of getDropdownOrgs(); track parent.id) {
                  <option [ngValue]="parent.id" [disabled]="!isParentOptionEnabled(parent)">
                    {{ parent.displayName || parent.name }} ({{ parent.org_type }})
                  </option>
                }
              </select>
            </label>

            <div class="two-column">
              <label class="form-field"><span>Short Name</span><input [(ngModel)]="formOrg.short_name" name="shortName" /></label>
              <label class="form-field"><span>Code</span><input [(ngModel)]="formOrg.code" name="code" /></label>
              <label class="form-field"><span>Contact Email</span><input type="email" [(ngModel)]="formOrg.contact_email" name="contactEmail" /></label>
              <label class="form-field"><span>Website URL</span><input type="url" [(ngModel)]="formOrg.website_url" name="websiteUrl" /></label>
            </div>

            <label class="form-field">
              <span>Description</span>
              <textarea [(ngModel)]="formOrg.description" name="description" rows="3"></textarea>
            </label>

            <footer>
              <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
              <button type="submit" class="primary-button">Save Organization</button>
            </footer>
          </form>
        </div>
      }
    </section>
  `,
  styleUrl: '../admin-shared.scss'
})
export class AdminOrganizations implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  treeNodes = signal<OrgTreeNode[]>([]);
  flatOrganizations = signal<Organization[]>([]);
  selectedOrg = signal<Organization | null>(null);
  isLoading = signal(false);
  showFormModal = signal(false);
  isEditMode = signal(false);
  formOrg: Partial<Organization> = this.emptyOrg();

  constructor() {
    effect(() => {
      if (this.auth.context()) {
        this.loadTree();
        this.loadFlatOrgs();
      }
    });
  }

  readonly orgTypes = [
    { value: 'university', label: 'University' },
    { value: 'school', label: 'School' },
    { value: 'department', label: 'Department' },
    { value: 'program', label: 'Program' },
    { value: 'center', label: 'Center' },
    { value: 'club', label: 'Club' },
    { value: 'office', label: 'Office' },
    { value: 'exam_cell', label: 'Examination Cell' },
    { value: 'sports', label: 'Sports Unit' }
  ];

  ngOnInit() {
  }

  loadTree() {
    this.isLoading.set(true);
    this.orgService.getOrganizationTree().subscribe({
      next: (nodes) => {
        if (this.auth.isSchoolAdmin()) {
          const scopedIds = this.auth.orgScope().map(o => o.organizationId);
          this.treeNodes.set(this.filterTree(nodes, scopedIds));
        } else {
          this.treeNodes.set(nodes);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.toast.fromApiError(error, 'Failed to load hierarchy');
      }
    });
  }

  private filterTree(nodes: OrgTreeNode[], scopedIds: string[]): OrgTreeNode[] {
    const result: OrgTreeNode[] = [];
    const search = (node: OrgTreeNode) => {
      if (scopedIds.includes(node.id)) {
        result.push(node);
        return;
      }
      node.children?.forEach(search);
    };
    nodes.forEach(search);
    return result;
  }

  loadFlatOrgs() {
    this.orgService.listOrganizations().subscribe({
      next: (orgs) => {
        if (this.auth.isSchoolAdmin()) {
          const scopedIds = this.auth.orgScope().map(o => o.organizationId);
          const allowedOrgs = orgs.filter(org => {
            let current: Organization | undefined = org;
            while (current) {
              if (scopedIds.includes(current.id)) {
                return true;
              }
              const parentOrgId: string | null = current.parent_id;
              current = parentOrgId ? orgs.find(o => o.id === parentOrgId) : undefined;
            }
            return false;
          });
          this.flatOrganizations.set(allowedOrgs);
        } else {
          this.flatOrganizations.set(orgs);
        }
      },
      error: () => undefined
    });
  }

  flattenedTree() {
    const rows: Array<OrgTreeNode & { depth: number }> = [];
    const visit = (node: OrgTreeNode, depth: number) => {
      rows.push({ ...node, depth });
      node.children?.forEach((child) => visit(child, depth + 1));
    };
    this.treeNodes().forEach((node) => visit(node, 0));
    return rows;
  }

  selectNode(id: string) {
    this.orgService.getOrganization(id).subscribe({
      next: (org) => this.selectedOrg.set(org),
      error: (error) => this.toast.fromApiError(error, 'Failed to load organization')
    });
  }

  getAllowedParentTypes(type: string | undefined): string[] {
    // Strictly enforcing immediate parent hierarchy based on the provided list
    switch (type) {
      case 'school': return ['university'];
      case 'department': return ['school'];
      case 'program': return ['department'];
      case 'club': return ['program', 'department', 'university'];
      case 'center': return ['university', 'school'];
      case 'office': return ['university', 'school', 'center'];
      case 'exam_cell': return ['university'];
      case 'sports': return ['university'];
      case 'university': return [];
      default: return [];
    }
  }

  private getDescendantIds(id: string): string[] {
    const ids: string[] = [];
    const visit = (node: OrgTreeNode, collect: boolean) => {
      const match = node.id === id || collect;
      if (match && node.id !== id) {
        ids.push(node.id);
      }
      node.children?.forEach(child => visit(child, match));
    };
    this.treeNodes().forEach(node => visit(node, false));
    return ids;
  }

  getDropdownOrgs(): any[] {
    return this.flattenedTree().map(org => {
      // Indent based on depth in the hierarchy
      const prefix = '\u00A0\u00A0'.repeat(org.depth) + (org.depth > 0 ? '└─ ' : '');
      return {
        ...org,
        displayName: prefix + org.name
      };
    });
  }

  isParentOptionEnabled(parent: any): boolean {
    if (!parent) return false;

    // Prevent self-selection
    if (this.isEditMode() && parent.id === this.formOrg.id) return false;

    // Prevent cycles (descendants of self)
    const descendants = this.isEditMode() && this.formOrg.id ? this.getDescendantIds(this.formOrg.id) : [];
    if (this.isEditMode() && descendants.includes(parent.id)) return false;

    const type = this.formOrg.org_type;

    if (this.auth.isSchoolAdmin()) {
      // School Admin: show ONLY the organizations they are directly assigned to.
      const scopedOrgIds = this.auth.orgScope().map(s => s.organizationId);
      return scopedOrgIds.includes(parent.id);
    }

    // University / Super Admin: enforce strict type hierarchy
    const allowed = this.getAllowedParentTypes(type);
    if (allowed.length > 0 && !allowed.includes(parent.org_type)) return false;
    if (type === 'university') return false;

    return true;
  }

  filteredParentOrgs(): any[] {
    return this.getDropdownOrgs().filter(org => this.isParentOptionEnabled(org));
  }

  getAvailableOrgTypes() {
    const currentType = this.formOrg?.org_type;
    if (this.auth.isSchoolAdmin()) {
      return this.orgTypes.filter(type => 
        type.value === currentType || (
          type.value !== 'university' && 
          type.value !== 'school' && 
          type.value !== 'exam_cell' && 
          type.value !== 'sports'
        )
      );
    }
    return this.orgTypes;
  }

  onOrgTypeChange(newType: string) {
    this.formOrg.org_type = newType;
    const allowed = this.filteredParentOrgs();
    const currentParentId = this.formOrg.parent_id;
    if (currentParentId) {
      if (!allowed.some(org => org.id === currentParentId)) {
        this.formOrg.parent_id = this.auth.isSchoolAdmin() && allowed.length > 0 ? allowed[0].id : null;
      }
    } else if (this.auth.isSchoolAdmin() && allowed.length > 0) {
      this.formOrg.parent_id = allowed[0].id;
    }
  }

  openCreateModal() {
    this.isEditMode.set(false);
    this.formOrg = this.emptyOrg();
    
    // Auto-select first valid parent for school admin
    const allowed = this.filteredParentOrgs();
    const selectedId = this.selectedOrg()?.id;
    if (selectedId && allowed.some(org => org.id === selectedId)) {
      this.formOrg.parent_id = selectedId;
    } else {
      this.formOrg.parent_id = this.auth.isSchoolAdmin() && allowed.length > 0 ? allowed[0].id : null;
    }

    this.showFormModal.set(true);
  }

  openEditModal(org: Organization) {
    this.isEditMode.set(true);
    this.formOrg = { ...org };
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
  }

  submitForm() {
    if (!this.formOrg.name || !this.formOrg.slug) {
      this.toast.error('Validation failed', 'Name and slug are required.');
      return;
    }

    if (this.auth.isSchoolAdmin() && !this.formOrg.parent_id) {
      this.toast.error('Validation failed', 'Parent organization is required.');
      return;
    }

    const request = this.isEditMode()
      ? this.orgService.updateOrganization(this.formOrg.id!, this.formOrg)
      : this.orgService.createOrganization(this.formOrg);

    request.subscribe({
      next: (org) => {
        this.toast.success('Organization saved');
        this.selectedOrg.set(org);
        this.closeFormModal();
        this.loadTree();
        this.loadFlatOrgs();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to save organization')
    });
  }

  toggleOrgStatus(org: Organization) {
    this.orgService.toggleStatus(org.id, !org.is_active).subscribe({
      next: (updated) => {
        this.toast.success(updated.is_active ? 'Organization activated' : 'Organization deactivated');
        this.selectedOrg.set(updated);
        this.loadTree();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to update status')
    });
  }

  deleteOrg(id: string) {
    if (!confirm('Soft delete this organization?')) return;
    this.orgService.deleteOrganization(id).subscribe({
      next: () => {
        this.toast.success('Organization deleted');
        this.selectedOrg.set(null);
        this.loadTree();
        this.loadFlatOrgs();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to delete organization')
    });
  }

  private emptyOrg(): Partial<Organization> {
    return {
      name: '',
      slug: '',
      org_type: 'department',
      parent_id: null,
      short_name: '',
      code: '',
      contact_email: '',
      website_url: '',
      description: ''
    };
  }
}
