import { Pacs3Component } from './pages/manual-entry/pacs3/pacs3.component';
import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ValidateComponent } from './pages/validate/validate.component';
import { HistoryComponent } from './pages/history/history.component';
import { RulesComponent } from './pages/rules/rules.component';
import { HelpComponent } from './pages/help/help.component';
import { Pacs8Component } from './pages/manual-entry/pacs8/pacs8.component';
import { Pacs9Component } from './pages/manual-entry/pacs9/pacs9.component';
import { Pacs9CovComponent } from './pages/manual-entry/pacs9cov/pacs9cov.component';
import { Pacs4Component } from './pages/manual-entry/pacs4/pacs4.component';
import { Camt057Component } from './pages/manual-entry/camt057/camt057.component';
import { Camt052Component } from './pages/manual-entry/camt052/camt052.component';
import { Pain001Component } from './pages/manual-entry/pain001/pain001.component';
import { Pain002Component } from './pages/manual-entry/pain002/pain002.component';
import { Pain008Component } from './pages/manual-entry/pain008/pain008.component';
import { ManualEntryComponent } from './pages/manual-entry/manual-entry.component';
import { Pacs2Component } from './pages/manual-entry/pacs2/pacs2.component';
import { Pacs9AdvComponent } from './pages/manual-entry/pacs9adv/pacs9adv.component';
import { Pacs10Component } from './pages/manual-entry/pacs10/pacs10.component';
import { Camt053Component } from './pages/manual-entry/camt053/camt053.component';
import { Camt054Component } from './pages/manual-entry/camt054/camt054.component';
import { MtToMxComponent } from './pages/mt-to-mx/mt-to-mx.component';
import { Camt055Component } from './pages/manual-entry/camt055/camt055.component';
import { Camt056Component } from './pages/manual-entry/camt056/camt056.component';


export const routes: Routes = [
  { path: 'generate/pacs3', component: Pacs3Component },

    { path: '', component: DashboardComponent },
    { path: 'validate', component: ValidateComponent },
    { path: 'history', component: HistoryComponent },
    { path: 'rules', component: RulesComponent },
    { path: 'help', component: HelpComponent },
    { path: 'generate', component: ManualEntryComponent },
    { path: 'generate/pacs8', component: Pacs8Component },
    { path: 'generate/pacs9', component: Pacs9Component },
    { path: 'generate/pacs9adv', component: Pacs9AdvComponent },
    { path: 'generate/pacs9cov', component: Pacs9CovComponent },
    { path: 'generate/pacs4', component: Pacs4Component },
    { path: 'generate/pacs2', component: Pacs2Component },
    { path: 'generate/pacs10', component: Pacs10Component },
    { path: 'generate/camt57', component: Camt057Component },
    { path: 'generate/camt052', component: Camt052Component },
    { path: 'generate/camt053', component: Camt053Component },

    { path: 'generate/camt054', component: Camt054Component },
    { path: 'generate/camt055', component: Camt055Component },
    { path: 'generate/camt056', component: Camt056Component },
    { path: 'generate/pain001', component: Pain001Component },
    { path: 'generate/pain002', component: Pain002Component },
    { path: 'generate/pain008', component: Pain008Component },
    { path: 'generate/:type', component: ManualEntryComponent },
    { path: 'mt-to-mx', component: MtToMxComponent },
    { path: '**', redirectTo: '' }
];