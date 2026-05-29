import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-page">
      <!-- Animated background -->
      <div class="bg-decoration">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <div class="grid-pattern"></div>
      </div>

      <div class="login-container">
        <!-- Sleek login card -->
        <div class="login-card">
          <div class="card-content">
            <div class="logo-container">
              <img src="/uni-logo.png" alt="Pillai University Logo" class="uni-logo" />
            </div>
            
            <div class="card-header">
              <h2>Pillai University</h2>
              <p class="tagline">Governance & Content Console</p>
            </div>

            @if (errorMessage()) {
              <div class="error-banner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <div class="button-group">
              <button
                type="button"
                class="google-button"
                [disabled]="isLoading()"
                (click)="signInWithDev('yash@mes.ac.in')"
              >
                @if (isLoading()) {
                  <div class="spinner"></div>
                  <span>Signing in…</span>
                } @else {
                  <span>Sign in as Super Admin</span>
                }
              </button>

              <button
                type="button"
                class="google-button secondary-btn"
                [disabled]="isLoading()"
                (click)="signInWithDev('editor@mes.ac.in')"
              >
                @if (isLoading()) {
                  <div class="spinner"></div>
                  <span>Signing in…</span>
                } @else {
                  <span>Sign in as Editor</span>
                }
              </button>
            </div>

            <div class="domain-notice">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <span>Only <strong>mes.ac.in</strong> email domains are allowed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100dvh;
      overflow: hidden;
    }

    .login-page {
      position: relative;
      display: grid;
      place-items: center;
      height: 100%;
      background: #f6f8fb;
      overflow: hidden;
    }

    /* === Animated background === */
    .bg-decoration {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      animation: float 18s ease-in-out infinite;
    }

    .orb-1 {
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(158, 27, 27, 0.4), transparent 70%);
      top: -10%;
      left: -5%;
      animation-delay: 0s;
    }

    .orb-2 {
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(229, 169, 59, 0.3), transparent 70%);
      bottom: -8%;
      right: -3%;
      animation-delay: -6s;
    }

    .orb-3 {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(11, 19, 37, 0.15), transparent 70%);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: -12s;
    }

    .grid-pattern {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(158, 27, 27, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(158, 27, 27, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -25px) scale(1.05); }
      66% { transform: translate(-20px, 15px) scale(0.95); }
    }

    /* === Main container === */
    .login-container {
      position: relative;
      width: min(440px, 92vw);
      border-radius: 24px;
      overflow: hidden;
      background: #fff;
      box-shadow:
        0 0 0 1px rgba(15, 23, 42, 0.05),
        0 25px 60px -12px rgba(15, 23, 42, 0.12),
        0 12px 30px -8px rgba(158, 27, 27, 0.06);
      animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes cardEntrance {
      from {
        opacity: 0;
        transform: translateY(24px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* === Login card === */
    .login-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 40px;
      background: #fff;
    }

    .card-content {
      width: 100%;
    }

    .logo-container {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    }

    .uni-logo {
      width: 64px;
      height: 64px;
      object-fit: contain;
    }

    .card-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .card-header h2 {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
      letter-spacing: -0.03em;
    }

    .tagline {
      color: #64748b;
      font-size: 0.95rem;
      margin: 0;
      font-weight: 500;
    }

    /* === Error banner === */
    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      font-size: 0.85rem;
      line-height: 1.45;
      margin-bottom: 20px;
      animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .error-banner svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* === Dev Input === */
    .dev-input {
      width: 100%;
      padding: 14px 20px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      margin-bottom: 12px;
      font-size: 0.95rem;
      color: #1f2937;
      background: #f8fafc;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .dev-input:focus {
      outline: none;
      border-color: #94a3b8;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.15);
    }

    /* === Buttons === */
    .button-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }

    .google-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px 20px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
      color: #1f2937;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .google-button::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(66, 133, 244, 0.04), rgba(234, 67, 53, 0.04));
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .google-button:hover:not(:disabled) {
      border-color: #cbd5e1;
      box-shadow:
        0 4px 14px rgba(15, 23, 42, 0.06),
        0 1px 3px rgba(15, 23, 42, 0.04);
      transform: translateY(-1px);
    }

    .google-button:hover:not(:disabled)::before {
      opacity: 1;
    }

    .google-button:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    }

    .google-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .secondary-btn {
      background: #f8fafc;
      border-color: #cbd5e1;
      color: #475569;
    }
    
    .secondary-btn:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
    }

    .google-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* === Spinner === */
    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid #e2e8f0;
      border-top-color: var(--primary-red, #9e1b1b);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* === Domain notice === */
    .domain-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0369a1;
      font-size: 0.82rem;
      line-height: 1.45;
    }

    .domain-notice svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .domain-notice strong {
      font-weight: 700;
    }

    /* === Responsive === */
    @media (max-width: 480px) {
      .login-card {
        padding: 32px 20px;
      }
    }
  `]
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    // If already authenticated, redirect to admin
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/dashboard']);
    }

    // Check for auth callback params in URL
    this.handleAuthCallback();
  }

  signInWithGoogle(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Redirect to backend Google OAuth endpoint
    window.location.href = '/api/v1/admin/auth/google/login';
  }

  signInWithDev(email: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.auth.devLogin(email).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.errors?.[0]?.message || 'Authentication failed. Make sure you seeded the admin user.');
        this.isLoading.set(false);
      }
    });
  }

  private handleAuthCallback(): void {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('auth_error');

    if (error) {
      this.errorMessage.set(decodeURIComponent(error));
      // Clean URL
      window.history.replaceState({}, '', '/login');
      return;
    }

    if (token) {
      this.isLoading.set(true);
      this.auth.setToken(token);

      this.auth.loadMe().subscribe({
        next: () => {
          this.router.navigate(['/admin/dashboard']);
        },
        error: () => {
          this.auth.clearToken();
          this.errorMessage.set('Authentication failed. Please try again.');
          this.isLoading.set(false);
          window.history.replaceState({}, '', '/login');
        }
      });
    }
  }
}
