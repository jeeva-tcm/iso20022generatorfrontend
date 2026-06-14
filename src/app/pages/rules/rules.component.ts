import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { SrVersionService } from '../../services/sr-version.service';

@Component({
    selector: 'app-rules',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
    templateUrl: './rules.component.html',
    styleUrls: ['./rules.component.css']
})
export class RulesComponent {
    constructor(public srVersion: SrVersionService) { }

    /** Active standard release label, e.g. 'SR2025' or 'SR2026'. */
    get sr(): string { return this.srVersion.currentVersion; }

    get isSR2026(): boolean { return this.srVersion.isSR2026; }
}
