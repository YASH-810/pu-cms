import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <section class="toast" [class.toast-success]="toast.type === 'success'" [class.toast-error]="toast.type === 'error'" [class.toast-info]="toast.type === 'info'">
          <div class="toast-mark"></div>
          <div class="toast-copy">
            <strong>{{ toast.title }}</strong>
            @if (toast.message) {
              <span>{{ toast.message }}</span>
            }
          </div>
          <button type="button" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss notification">×</button>
        </section>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      right: 24px;
      top: 24px;
      z-index: 3000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(420px, calc(100vw - 32px));
    }

    .toast {
      display: grid;
      grid-template-columns: 4px 1fr auto;
      gap: 14px;
      align-items: start;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
      padding: 14px;
      color: #0f172a;
      backdrop-filter: blur(12px);
    }

    .toast-mark {
      width: 4px;
      height: 100%;
      min-height: 42px;
      border-radius: 999px;
      background: #2563eb;
    }

    .toast-success .toast-mark { background: #059669; }
    .toast-error .toast-mark { background: #dc2626; }
    .toast-info .toast-mark { background: #2563eb; }

    .toast-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      line-height: 1.35;
    }

    .toast-copy strong {
      font-size: 0.9rem;
      font-weight: 700;
    }

    .toast-copy span {
      color: #64748b;
      font-size: 0.84rem;
    }

    .toast button {
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 8px;
      background: #f1f5f9;
      color: #475569;
      cursor: pointer;
      font-size: 1.05rem;
      line-height: 1;
    }
  `]
})
export class ToastHost {
  readonly toastService = inject(ToastService);
}
