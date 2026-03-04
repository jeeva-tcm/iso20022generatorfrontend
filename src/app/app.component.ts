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
        MatTooltipModule
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    title = 'ISO 20022 Validator';
    isValidatePage = false;
    isManualEntryActive = false;
    isMenuForcedClosed = false;

    constructor(
        private router: Router,
        private themeService: ThemeService
    ) { }

    ngOnInit() {
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

    private updateState(url: string) {
        this.isValidatePage = url.includes('/validate');
        this.isManualEntryActive = url.includes('/generate');
    }
}
