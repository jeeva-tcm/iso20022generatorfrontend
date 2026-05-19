import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, timeout } from 'rxjs';
import { ConfigService } from './config.service';

/**
 * Keeps the Render backend warm.
 *
 * Render free-tier spins instances down after 15 minutes of inactivity, then
 * takes 30-60+ seconds to wake on the first request. That cold-start is the
 * single biggest reason the deployed Vercel UI feels slow compared to local.
 *
 * Strategy:
 *   1. Fire a lightweight GET / on app boot so the backend starts waking up
 *      while the user is reading the landing page (parallel to any other UI
 *      data fetches).
 *   2. Re-ping every 12 minutes so the instance never goes fully idle while
 *      a user has the tab open.
 *   3. Also log /firebase-status to the console so the user can confirm
 *      whether Firestore is actually connected on the backend (which is
 *      the typical "DB not loading" root cause).
 */
@Injectable({ providedIn: 'root' })
export class BackendWarmupService {
  // 12 minutes — comfortably below Render's 15-minute idle window.
  private static readonly KEEP_ALIVE_MS = 12 * 60 * 1000;
  // Per-ping budget — never block the UI on a slow cold-start.
  private static readonly PING_TIMEOUT_MS = 90 * 1000;
  private started = false;

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) {}

  /** Idempotent. Safe to call multiple times (e.g. from AppComponent). */
  start(): void {
    if (this.started) return;
    this.started = true;

    // First ping immediately — kicks off the cold start while the UI renders.
    this.ping('initial');
    // Diagnose backend / Firestore connectivity once on boot.
    this.checkFirebaseStatus();

    // Keep-alive timer.
    setInterval(() => this.ping('keep-alive'),
      BackendWarmupService.KEEP_ALIVE_MS);
  }

  private ping(label: string): void {
    const t0 = performance.now();
    this.http.get(this.config.getApiUrl('/'), { responseType: 'text' as const })
      .pipe(
        timeout(BackendWarmupService.PING_TIMEOUT_MS),
        catchError(err => {
          console.warn(`[Warmup] ${label} ping failed: ${err?.message || err}`);
          return of(null);
        })
      )
      .subscribe(() => {
        const ms = Math.round(performance.now() - t0);
        console.log(`[Warmup] ${label} ping OK in ${ms}ms`);
      });
  }

  private checkFirebaseStatus(): void {
    this.http.get<any>(this.config.getApiUrl('/firebase-status'))
      .pipe(
        timeout(BackendWarmupService.PING_TIMEOUT_MS),
        catchError(err => {
          console.warn('[Warmup] /firebase-status unreachable:', err?.message || err);
          return of(null);
        })
      )
      .subscribe(status => {
        if (!status) return;
        if (status.enabled) {
          console.log('[Warmup] Firestore is connected. Project:', status.project_id);
        } else {
          console.warn(
            '[Warmup] ⚠️ Firestore NOT connected on backend.\n' +
            '  This is why history / saved data appears empty on Vercel.\n' +
            '  Fix: set FIREBASE_CREDENTIALS_BASE64 (recommended) or the\n' +
            '  individual FIREBASE_* env vars on your Render service, then\n' +
            '  redeploy. Hit /firebase-write-test on the backend URL to confirm.\n' +
            '  Current status:', status
          );
        }
      });
  }
}
