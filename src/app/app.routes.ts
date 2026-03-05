import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ValidateComponent } from './pages/validate/validate.component';
import { HistoryComponent } from './pages/history/history.component';
import { RulesComponent } from './pages/rules/rules.component';
import { HelpComponent } from './pages/help/help.component';
import { Pacs8Component } from './pages/manual-entry/pacs8/pacs8.component';
import { Pacs9Component } from './pages/manual-entry/pacs9/pacs9.component';
import { Pacs9CovComponent } from './pages/manual-entry/pacs9cov/pacs9cov.component';
import { Camt057Component } from './pages/manual-entry/camt057/camt057.component';
import { ManualEntryComponent } from './pages/manual-entry/manual-entry.component';
import { MtToMxComponent } from './pages/mt-to-mx/mt-to-mx.component';

export const routes: Routes = [
    { path: '', component: DashboardComponent },
    { path: 'validate', component: ValidateComponent },
    { path: 'history', component: HistoryComponent },
    { path: 'rules', component: RulesComponent },
    { path: 'help', component: HelpComponent },
    { path: 'generate', component: ManualEntryComponent },
    { path: 'generate/pacs8', component: Pacs8Component },
    { path: 'generate/pacs9', component: Pacs9Component },
    { path: 'generate/pacs9cov', component: Pacs9CovComponent },
    { path: 'generate/camt57', component: Camt057Component },
    { path: 'mt-to-mx', component: MtToMxComponent },
    { path: '**', redirectTo: '' }
];
