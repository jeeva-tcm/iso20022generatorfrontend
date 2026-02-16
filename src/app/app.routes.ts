import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ValidateComponent } from './pages/validate/validate.component';
import { HistoryComponent } from './pages/history/history.component';
import { RulesComponent } from './pages/rules/rules.component';
import { HelpComponent } from './pages/help/help.component';

export const routes: Routes = [
    { path: '', component: DashboardComponent },
    { path: 'validate', component: ValidateComponent },
    { path: 'history', component: HistoryComponent },
    { path: 'rules', component: RulesComponent },
    { path: 'help', component: HelpComponent },
    { path: '**', redirectTo: '' }
];
