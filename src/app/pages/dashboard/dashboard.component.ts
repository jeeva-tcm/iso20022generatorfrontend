import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../services/config.service';
import { SrVersionService } from '../../services/sr-version.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BicSearchDialogComponent } from '../manual-entry/bic-search-dialog/bic-search-dialog.component';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule, MatSnackBarModule, MatDialogModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    stats = { total: 0, passed: 0, failed: 0, efficiency: '0%' };
    recentActivity: any[] = [];

    statsLoading = false;
    activityLoading = false;
    statsError: string | null = null;
    activityError: string | null = null;
    statsLoaded = false;

    // SVG ring: radius 33 inside 80×80 viewBox
    readonly ringCircumference = 2 * Math.PI * 33;

    private versionSub!: Subscription;

    constructor(
        private http: HttpClient,
        private config: ConfigService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private srVersion: SrVersionService
    ) {}

    openBicDirectory() {
        this.dialog.open(BicSearchDialogComponent, {
            width: '800px',
            disableClose: false,
            data: { browseMode: true }
        });
    }

    ngOnInit() {
        // Try to load cached values from localStorage for instant display on page load/redirect
        const cachedStats = localStorage.getItem('dashboard_stats');
        const cachedActivity = localStorage.getItem('dashboard_activity');
        if (cachedStats) {
            try { this.stats = JSON.parse(cachedStats); } catch (e) {}
        }
        if (cachedActivity) {
            try { this.recentActivity = JSON.parse(cachedActivity); } catch (e) {}
        }

        this.versionSub = this.srVersion.version$.subscribe(() => {
            this.refresh();
        });
    }

    ngOnDestroy() {
        if (this.versionSub) {
            this.versionSub.unsubscribe();
        }
    }

    get passRateNum(): number {
        if (this.stats.total === 0) return 0;
        return Math.round((this.stats.passed / this.stats.total) * 100);
    }

    get ringDashOffset(): number {
        return this.ringCircumference * (1 - this.passRateNum / 100);
    }

    getMsgClass(messageType: string): string {
        if (!messageType) return 'other';
        const t = messageType.toLowerCase();
        if (t.startsWith('pacs')) return 'pacs';
        if (t.startsWith('camt')) return 'camt';
        if (t.startsWith('pain')) return 'pain';
        if (t.startsWith('head')) return 'head';
        return 'other';
    }

    getItemPassRate(item: any): number {
        if (item.status === 'PASS') return 100;
        const ls = item.layer_status || item.report_json?.layer_status;
        if (ls && typeof ls === 'object') {
            const keys = Object.keys(ls);
            if (keys.length > 0) {
                let passed = 0;
                for (const k of keys) {
                    const s = String(ls[k]?.status || '');
                    if (s.includes('✅') || s.includes('⚠') || s.includes('WARN')) {
                        passed++;
                    }
                }
                return Math.round((passed / keys.length) * 100);
            }
        }
        return 0;
    }

    isRefreshing = false;

    private formatError(err: any): string {
        if (err?.status === 0) return 'Cannot reach the server. Is the backend running?';
        if (err?.status === 404) return 'Endpoint not found on the server.';
        if (err?.status >= 500) return 'Server error. Please try again.';
        if (err?.statusText) return `${err.status} ${err.statusText}`;
        return 'Failed to load data.';
    }

    loadStats() {
        this.statsLoading = true;
        this.statsError = null;
        this.http.get<any>(this.config.getApiUrl('/dashboard/stats')).subscribe({
            next: (data) => {
                this.stats = {
                    total: data?.total_audits ?? 0,
                    passed: data?.passed_messages ?? 0,
                    failed: data?.failed_messages ?? 0,
                    efficiency: (data?.validation_quality ?? 0) + '%'
                };
                this.statsLoaded = true;
                this.statsLoading = false;
                localStorage.setItem('dashboard_stats', JSON.stringify(this.stats));
            },
            error: (err) => {
                console.error('Dashboard stats error:', err);
                this.statsError = this.formatError(err);
                this.statsLoading = false;
            }
        });
    }

    loadRecentActivity() {
        this.activityLoading = true;
        this.activityError = null;
        this.http.get<any[]>(this.config.getApiUrl('/history?limit=5')).subscribe({
            next: (data) => {
                this.recentActivity = Array.isArray(data) ? data : [];
                this.activityLoading = false;
                localStorage.setItem('dashboard_activity', JSON.stringify(this.recentActivity));
            },
            error: (err) => {
                console.error('Dashboard activity error:', err);
                this.activityError = this.formatError(err);
                this.activityLoading = false;
            }
        });
    }

    refresh() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;

        this.snackBar.open('Reloading dashboard data...', '', { duration: 1000 });

        let completed = 0;
        const checkDone = () => {
            completed++;
            if (completed === 2) {
                setTimeout(() => {
                    this.isRefreshing = false;
                    const hadError = this.statsError || this.activityError;
                    this.snackBar.open(
                        hadError ? 'Dashboard refresh failed. See message above.' : 'Dashboard updated successfully.',
                        'Close',
                        { duration: 2500 }
                    );
                }, 600);
            }
        };

        this.statsLoading = true;
        this.statsError = null;
        this.http.get<any>(this.config.getApiUrl('/dashboard/stats')).subscribe({
            next: (data) => {
                this.stats = {
                    total: data?.total_audits ?? 0,
                    passed: data?.passed_messages ?? 0,
                    failed: data?.failed_messages ?? 0,
                    efficiency: (data?.validation_quality ?? 0) + '%'
                };
                this.statsLoaded = true;
                this.statsLoading = false;
                localStorage.setItem('dashboard_stats', JSON.stringify(this.stats));
                checkDone();
            },
            error: (err) => {
                console.error('Dashboard stats error:', err);
                this.statsError = this.formatError(err);
                this.statsLoading = false;
                checkDone();
            }
        });

        this.activityLoading = true;
        this.activityError = null;
        this.http.get<any[]>(this.config.getApiUrl('/history?limit=5')).subscribe({
            next: (data) => {
                this.recentActivity = Array.isArray(data) ? data : [];
                this.activityLoading = false;
                localStorage.setItem('dashboard_activity', JSON.stringify(this.recentActivity));
                checkDone();
            },
            error: (err) => {
                console.error('Dashboard activity error:', err);
                this.activityError = this.formatError(err);
                this.activityLoading = false;
                checkDone();
            }
        });
    }
}
