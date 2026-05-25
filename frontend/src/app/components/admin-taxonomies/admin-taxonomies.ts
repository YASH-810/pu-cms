import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, ContentType, Tag, TaxonomyService } from '../../services/taxonomy.service';
import { ToastService } from '../../services/toast.service';

type TaxonomyTab = 'categories' | 'tags' | 'contentTypes';

@Component({
  selector: 'app-admin-taxonomies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Classification</p>
          <h1>Taxonomy & Content Types</h1>
          <p>Manage reusable categories, tags, and system content type metadata.</p>
        </div>
      </header>

      <div class="tabs">
        <button type="button" class="tab-button" [class.active]="activeTab() === 'categories'" (click)="setActiveTab('categories')">Categories</button>
        <button type="button" class="tab-button" [class.active]="activeTab() === 'tags'" (click)="setActiveTab('tags')">Tags</button>
        <button type="button" class="tab-button" [class.active]="activeTab() === 'contentTypes'" (click)="setActiveTab('contentTypes')">Content Types</button>
      </div>

      @if (activeTab() === 'categories') {
        <section class="data-card">
          <div class="card-toolbar">
            <div>
              <h3>Categories</h3>
              <p class="muted">Optional content type mapping for editorial classification.</p>
            </div>
            <button type="button" class="primary-button" (click)="openCategoryModal()">New Category</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Slug</th><th>Content Type</th><th class="right">Actions</th></tr></thead>
              <tbody>
                @if (categories().length === 0) {
                  <tr><td colspan="4" class="empty-cell">No categories registered.</td></tr>
                } @else {
                  @for (cat of categories(); track cat.id) {
                    <tr>
                      <td><strong>{{ cat.name }}</strong><br><span class="muted">{{ cat.description || 'No description' }}</span></td>
                      <td>{{ cat.slug }}</td>
                      <td><span class="pill pill-active">{{ getContentTypeName(cat.content_type_id) }}</span></td>
                      <td class="right">
                        <div class="row-actions">
                          <button type="button" class="ghost-button" (click)="openCategoryModal(cat)">Edit</button>
                          <button type="button" class="danger-button" (click)="deleteCategory(cat.id)">Delete</button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (activeTab() === 'tags') {
        <section class="data-card">
          <div class="card-toolbar">
            <div>
              <h3>Tags</h3>
              <p class="muted">Reusable discovery labels across future modules.</p>
            </div>
            <button type="button" class="primary-button" (click)="openTagModal()">New Tag</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Slug</th><th>Created</th><th class="right">Actions</th></tr></thead>
              <tbody>
                @if (tags().length === 0) {
                  <tr><td colspan="4" class="empty-cell">No tags registered.</td></tr>
                } @else {
                  @for (tag of tags(); track tag.id) {
                    <tr>
                      <td><strong>{{ tag.name }}</strong><br><span class="muted">{{ tag.description || 'No description' }}</span></td>
                      <td>{{ tag.slug }}</td>
                      <td>{{ tag.created_at | date:'mediumDate' }}</td>
                      <td class="right">
                        <div class="row-actions">
                          <button type="button" class="ghost-button" (click)="openTagModal(tag)">Edit</button>
                          <button type="button" class="danger-button" (click)="deleteTag(tag.id)">Delete</button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (activeTab() === 'contentTypes') {
        <section class="data-card">
          <div class="card-toolbar">
            <div>
              <h3>Content Types</h3>
              <p class="muted">System identifiers are locked; display metadata can be configured.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Table</th><th>Slug</th><th>Status</th><th class="right">Actions</th></tr></thead>
              <tbody>
                @for (ct of contentTypes(); track ct.id) {
                  <tr>
                    <td><strong>{{ ct.name }}</strong><br><span class="muted">{{ ct.description || 'No description' }}</span></td>
                    <td>{{ ct.table_name }}</td>
                    <td>{{ ct.slug }}</td>
                    <td><span class="pill" [class.pill-active]="ct.is_active">{{ ct.is_active ? 'Active' : 'Inactive' }}</span></td>
                    <td class="right"><button type="button" class="ghost-button" (click)="openContentTypeModal(ct)">Configure</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (showCategoryModal()) {
        <div class="modal-backdrop" (click)="closeCategoryModal()">
          <form class="modal-card" (click)="$event.stopPropagation()" (ngSubmit)="submitCategory()">
            <header>
              <div><p class="eyebrow">{{ isEditMode() ? 'Update Category' : 'New Category' }}</p><h2>Category</h2></div>
              <button type="button" class="icon-close" (click)="closeCategoryModal()">×</button>
            </header>
            <label class="form-field"><span>Name</span><input [(ngModel)]="categoryForm.name" name="catName" required /></label>
            <label class="form-field"><span>Slug</span><input [(ngModel)]="categoryForm.slug" name="catSlug" required /></label>
            <label class="form-field">
              <span>Content Type</span>
              <select [(ngModel)]="categoryForm.content_type_id" name="catContentType">
                <option [ngValue]="null">Global / all content types</option>
                @for (ct of contentTypes(); track ct.id) {
                  <option [value]="ct.id">{{ ct.name }}</option>
                }
              </select>
            </label>
            <label class="form-field"><span>Description</span><textarea [(ngModel)]="categoryForm.description" name="catDescription" rows="3"></textarea></label>
            <footer><button type="button" class="ghost-button" (click)="closeCategoryModal()">Cancel</button><button type="submit" class="primary-button">Save Category</button></footer>
          </form>
        </div>
      }

      @if (showTagModal()) {
        <div class="modal-backdrop" (click)="closeTagModal()">
          <form class="modal-card" (click)="$event.stopPropagation()" (ngSubmit)="submitTag()">
            <header>
              <div><p class="eyebrow">{{ isEditMode() ? 'Update Tag' : 'New Tag' }}</p><h2>Tag</h2></div>
              <button type="button" class="icon-close" (click)="closeTagModal()">×</button>
            </header>
            <label class="form-field"><span>Name</span><input [(ngModel)]="tagForm.name" name="tagName" required /></label>
            <label class="form-field"><span>Slug</span><input [(ngModel)]="tagForm.slug" name="tagSlug" required /></label>
            <label class="form-field"><span>Description</span><textarea [(ngModel)]="tagForm.description" name="tagDescription" rows="3"></textarea></label>
            <footer><button type="button" class="ghost-button" (click)="closeTagModal()">Cancel</button><button type="submit" class="primary-button">Save Tag</button></footer>
          </form>
        </div>
      }

      @if (showContentTypeModal()) {
        <div class="modal-backdrop" (click)="closeContentTypeModal()">
          <form class="modal-card" (click)="$event.stopPropagation()" (ngSubmit)="submitContentType()">
            <header>
              <div><p class="eyebrow">Content Type Metadata</p><h2>{{ contentTypeForm.slug }}</h2></div>
              <button type="button" class="icon-close" (click)="closeContentTypeModal()">×</button>
            </header>
            <label class="form-field"><span>Display Name</span><input [(ngModel)]="contentTypeForm.name" name="ctName" required /></label>
            <div class="two-column">
              <label class="form-field"><span>Table Name</span><input [value]="contentTypeForm.table_name" disabled /></label>
              <label class="form-field"><span>Slug</span><input [value]="contentTypeForm.slug" disabled /></label>
            </div>
            <label class="form-field"><span>Description</span><textarea [(ngModel)]="contentTypeForm.description" name="ctDescription" rows="3"></textarea></label>
            <footer><button type="button" class="ghost-button" (click)="closeContentTypeModal()">Cancel</button><button type="submit" class="primary-button">Save Metadata</button></footer>
          </form>
        </div>
      }
    </section>
  `,
  styleUrl: '../admin-shared.scss'
})
export class AdminTaxonomies implements OnInit {
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly toast = inject(ToastService);

  activeTab = signal<TaxonomyTab>('categories');
  categories = signal<Category[]>([]);
  tags = signal<Tag[]>([]);
  contentTypes = signal<ContentType[]>([]);
  showCategoryModal = signal(false);
  showTagModal = signal(false);
  showContentTypeModal = signal(false);
  isEditMode = signal(false);

  categoryForm: Partial<Category> = {};
  tagForm: Partial<Tag> = {};
  contentTypeForm: Partial<ContentType> = {};

  ngOnInit() {
    this.loadCategories();
    this.loadTags();
    this.loadContentTypes();
  }

  setActiveTab(tab: TaxonomyTab) {
    this.activeTab.set(tab);
  }

  loadCategories() {
    this.taxonomyService.listCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: (error) => this.toast.fromApiError(error, 'Failed to load categories')
    });
  }

  loadTags() {
    this.taxonomyService.listTags().subscribe({
      next: (tags) => this.tags.set(tags),
      error: (error) => this.toast.fromApiError(error, 'Failed to load tags')
    });
  }

  loadContentTypes() {
    this.taxonomyService.listContentTypes().subscribe({
      next: (cts) => this.contentTypes.set(cts),
      error: (error) => this.toast.fromApiError(error, 'Failed to load content types')
    });
  }

  getContentTypeName(contentTypeId: string | null): string {
    if (!contentTypeId) return 'Global';
    return this.contentTypes().find((type) => type.id === contentTypeId)?.name ?? 'Unknown';
  }

  openCategoryModal(category?: Category) {
    this.isEditMode.set(!!category);
    this.categoryForm = category ? { ...category } : { name: '', slug: '', description: '', content_type_id: null };
    this.showCategoryModal.set(true);
  }

  closeCategoryModal() {
    this.showCategoryModal.set(false);
  }

  submitCategory() {
    if (!this.categoryForm.name || !this.categoryForm.slug) {
      this.toast.error('Validation failed', 'Name and slug are required.');
      return;
    }

    const request = this.isEditMode()
      ? this.taxonomyService.updateCategory(this.categoryForm.id!, this.categoryForm)
      : this.taxonomyService.createCategory(this.categoryForm);

    request.subscribe({
      next: () => {
        this.toast.success('Category saved');
        this.closeCategoryModal();
        this.loadCategories();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to save category')
    });
  }

  deleteCategory(id: string) {
    if (!confirm('Delete this category?')) return;
    this.taxonomyService.deleteCategory(id).subscribe({
      next: () => {
        this.toast.success('Category deleted');
        this.loadCategories();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to delete category')
    });
  }

  openTagModal(tag?: Tag) {
    this.isEditMode.set(!!tag);
    this.tagForm = tag ? { ...tag } : { name: '', slug: '', description: '' };
    this.showTagModal.set(true);
  }

  closeTagModal() {
    this.showTagModal.set(false);
  }

  submitTag() {
    if (!this.tagForm.name || !this.tagForm.slug) {
      this.toast.error('Validation failed', 'Name and slug are required.');
      return;
    }

    const request = this.isEditMode()
      ? this.taxonomyService.updateTag(this.tagForm.id!, this.tagForm)
      : this.taxonomyService.createTag(this.tagForm);

    request.subscribe({
      next: () => {
        this.toast.success('Tag saved');
        this.closeTagModal();
        this.loadTags();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to save tag')
    });
  }

  deleteTag(id: string) {
    if (!confirm('Delete this tag?')) return;
    this.taxonomyService.deleteTag(id).subscribe({
      next: () => {
        this.toast.success('Tag deleted');
        this.loadTags();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to delete tag')
    });
  }

  openContentTypeModal(contentType: ContentType) {
    this.contentTypeForm = { ...contentType };
    this.showContentTypeModal.set(true);
  }

  closeContentTypeModal() {
    this.showContentTypeModal.set(false);
  }

  submitContentType() {
    if (!this.contentTypeForm.name) {
      this.toast.error('Validation failed', 'Display name is required.');
      return;
    }

    this.taxonomyService.updateContentType(this.contentTypeForm.id!, {
      name: this.contentTypeForm.name,
      description: this.contentTypeForm.description
    }).subscribe({
      next: () => {
        this.toast.success('Content type updated');
        this.closeContentTypeModal();
        this.loadContentTypes();
      },
      error: (error) => this.toast.fromApiError(error, 'Failed to update content type')
    });
  }
}
