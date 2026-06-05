import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { filter } from 'rxjs/operators';
import { ThemeService } from './services/theme.service';
import { BackendWarmupService } from './services/backend-warmup.service';
import { SrVersionService } from './services/sr-version.service';
import { SrVersion } from './config/sr-version.config';
import { ChatbotComponent } from './chatbot/chatbot.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTooltipModule,
        MatSelectModule,
        ChatbotComponent,
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    title = 'ISO 20022 Validator';
    isValidatePage = false;
    isManualEntryActive = false;
    isMtToMxActive = false;
    isBulkGenerateActive = false;
    isFullWidthPage = false;
    isMenuForcedClosed = false;
    isSRMenuForcedClosed = false;
    srDropdownOpen = false;

    constructor(
        private router: Router,
        private themeService: ThemeService,
        private warmup: BackendWarmupService,
        public srVersion: SrVersionService,
    ) { }

    ngOnInit() {
        this.warmup.start();
        this.updateState(this.router.url);
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd)
        ).subscribe((e: any) => {
            this.updateState(e.urlAfterRedirects || e.url);
        });
    }

    // ─── SR Version ───────────────────────────────────────────────────────────

    get activeSR(): string {
        return this.srVersion.currentVersion;
    }

    setActiveSR(v: string) {
        this.srVersion.setVersion(v as SrVersion);
        this.isSRMenuForcedClosed = true;
    }

    get selectedVersion(): SrVersion {
        return this.srVersion.currentVersion;
    }

    set selectedVersion(v: SrVersion) {
        this.srVersion.setVersion(v);
    }

    get availableVersions(): SrVersion[] {
        return this.srVersion.availableVersions;
    }

    getVersionBadgeColor(v: SrVersion): string {
        return this.srVersion.config.badgeColor;
    }

    // ─── Theme ────────────────────────────────────────────────────────────────

    toggleTheme() {
        this.themeService.toggleTheme();
    }

    get isDarkMode(): boolean {
        return this.themeService.getTheme() === 'dark';
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private updateState(url: string) {
        this.isValidatePage = url.includes('/validate');
        this.isManualEntryActive = url.includes('/generate');
        this.isMtToMxActive = url.includes('/mt-to-mx');
        this.isBulkGenerateActive = url.includes('/bulk-generate');
        this.isFullWidthPage = this.isManualEntryActive || this.isMtToMxActive;
    }
}
