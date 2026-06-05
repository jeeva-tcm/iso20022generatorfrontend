import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';
import { ThemeService } from './services/theme.service';
import { BackendWarmupService } from './services/backend-warmup.service';
import { ChatbotComponent } from './chatbot/chatbot.component';


@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTooltipModule,
        ChatbotComponent
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
    activeSR: 'SR2025' | 'SR2026' = 'SR2025';

    constructor(
        private router: Router,
        private themeService: ThemeService,
        private warmup: BackendWarmupService
    ) { }

    ngOnInit() {
        // Fire-and-forget: wakes the Render backend immediately on app boot
        // and keeps it warm with a periodic ping so Vercel users don't hit
        // 30-60s cold-start latency. Also logs Firestore connectivity.
        this.warmup.start();

        this.updateState(this.router.url);

        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd)
        ).subscribe((e: any) => {
            this.updateState(e.urlAfterRedirects || e.url);
        });
    }

    toggleTheme() {
        this.themeService.toggleTheme();
    }

    get isDarkMode(): boolean {
        return this.themeService.getTheme() === 'dark';
    }

    setActiveSR(sr: 'SR2025' | 'SR2026') {
        this.activeSR = sr;
        this.isSRMenuForcedClosed = true;
    }

    private updateState(url: string) {
        this.isValidatePage = url.includes('/validate');
        this.isManualEntryActive = url.includes('/generate');
        this.isMtToMxActive = url.includes('/mt-to-mx');
        this.isBulkGenerateActive = url.includes('/bulk-generate');
        this.isFullWidthPage = this.isManualEntryActive || this.isMtToMxActive;
    }
}
