import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
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

    get activeSR(): 'SR2025' | 'SR2026' {
        return this.srVersion.currentVersion as 'SR2025' | 'SR2026';
    }

    // ─── SR version switch confirmation modal ──────────────────────────────────
    srConfirmOpen = false;
    pendingSrVersion: SrVersion | null = null;

    private requestSrSwitch(v: SrVersion) {
        this.pendingSrVersion = v;
        this.srConfirmOpen = true;
        this.srDropdownOpen = false;
        this.isSRMenuForcedClosed = true;
    }

    confirmSrSwitch() {
        if (this.pendingSrVersion) {
            this.srVersion.setVersion(this.pendingSrVersion);
            this.srConfirmOpen = false;
            window.location.reload();
        }
    }

    cancelSrSwitch() {
        this.srConfirmOpen = false;
        this.pendingSrVersion = null;
    }

    setActiveSR(sr: 'SR2025' | 'SR2026') {
        if (sr === this.activeSR) {
            this.isSRMenuForcedClosed = true;
            return;
        }
        this.requestSrSwitch(sr);
    }

    constructor(
        private router: Router,
        private themeService: ThemeService,
        private warmup: BackendWarmupService,
        public srVersion: SrVersionService,
        private elementRef: ElementRef,
    ) { }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (!this.elementRef.nativeElement.querySelector('.sr-dropdown-wrapper')?.contains(event.target)) {
            this.srDropdownOpen = false;
        }
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.srConfirmOpen) {
            this.cancelSrSwitch();
        }
    }

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

    get selectedVersion(): SrVersion {
        return this.srVersion.currentVersion;
    }

    set selectedVersion(v: SrVersion) {
        this.srVersion.setVersion(v);
    }

    get availableVersions(): SrVersion[] {
        return this.srVersion.availableVersions;
    }

    onVersionSelect(v: SrVersion) {
        if (v === this.selectedVersion) {
            this.srDropdownOpen = false;
            return;
        }
        this.requestSrSwitch(v);
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
