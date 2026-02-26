import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';




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

    constructor(private router: Router) {}

    ngOnInit() {
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd)
        ).subscribe((e: any) => {
            this.isValidatePage = e.urlAfterRedirects?.startsWith('/validate') ?? false;
            document.body.classList.toggle('validate-dark', this.isValidatePage);
        });
        // Set initial state
        this.isValidatePage = this.router.url?.startsWith('/validate') ?? false;
        document.body.classList.toggle('validate-dark', this.isValidatePage);
    }
}


