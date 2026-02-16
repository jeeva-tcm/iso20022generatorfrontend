import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    stats = {
        total: 0,
        passed: 0,
        failed: 0,
        efficiency: '0%'
    };

    recentActivity: any[] = [];

    constructor(
        private http: HttpClient,
        private config: ConfigService
    ) { }

    ngOnInit() {
        this.loadStats();
        this.loadRecentActivity();
    }

    loadStats() {
        // Use the dedicated stats endpoint for better performance
        this.http.get<any>(this.config.getApiUrl('/dashboard/stats')).subscribe({
            next: (data) => {
                this.stats.total = data.total_audits;
                this.stats.passed = data.passed_messages;
                this.stats.failed = data.failed_messages;
                this.stats.efficiency = data.validation_quality + '%';
            },
            error: (err) => {
                console.error('Dashboard failed to load stats:', err);
                // Keep zeros as defaults
            }
        });
    }

    loadRecentActivity() {
        // Load recent activity separately (limited to 5 records)
        this.http.get<any[]>(this.config.getApiUrl('/history?limit=5')).subscribe({
            next: (data) => {
                this.recentActivity = data;
            },
            error: (err) => console.error('Dashboard failed to load recent activity:', err)
        });
    }

    refresh() {
        // Public method to refresh all dashboard data
        this.loadStats();
        this.loadRecentActivity();
    }
}
