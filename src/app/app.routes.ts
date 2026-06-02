import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
    { path: 'validate', loadComponent: () => import('./pages/validate/validate.component').then(m => m.ValidateComponent) },
    { path: 'history', loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent) },
    { path: 'rules', loadComponent: () => import('./pages/rules/rules.component').then(m => m.RulesComponent) },
    { path: 'help', loadComponent: () => import('./pages/help/help.component').then(m => m.HelpComponent) },
    { path: 'mt-to-mx', loadComponent: () => import('./pages/mt-to-mx/mt-to-mx.component').then(m => m.MtToMxComponent) },
    { path: 'bulk-generate', loadComponent: () => import('./pages/bulk-generate/bulk-generate.component').then(m => m.BulkGenerateComponent) },

    // Manual Entry — hub
    { path: 'generate', loadComponent: () => import('./pages/manual-entry/manual-entry.component').then(m => m.ManualEntryComponent) },

    // PACS — Payments Clearing & Settlement
    { path: 'generate/pacs2',    loadComponent: () => import('./pages/manual-entry/pacs/pacs2/pacs2.component').then(m => m.Pacs2Component) },
    { path: 'generate/pacs3',    loadComponent: () => import('./pages/manual-entry/pacs/pacs3/pacs3.component').then(m => m.Pacs3Component) },
    { path: 'generate/pacs4',    loadComponent: () => import('./pages/manual-entry/pacs/pacs4/pacs4.component').then(m => m.Pacs4Component) },
    { path: 'generate/pacs8',    loadComponent: () => import('./pages/manual-entry/pacs/pacs8/pacs8.component').then(m => m.Pacs8Component) },
    { path: 'generate/pacs9',    loadComponent: () => import('./pages/manual-entry/pacs/pacs9/pacs9.component').then(m => m.Pacs9Component) },
    { path: 'generate/pacs9adv', loadComponent: () => import('./pages/manual-entry/pacs/pacs9adv/pacs9adv.component').then(m => m.Pacs9AdvComponent) },
    { path: 'generate/pacs9cov', loadComponent: () => import('./pages/manual-entry/pacs/pacs9cov/pacs9cov.component').then(m => m.Pacs9CovComponent) },
    { path: 'generate/pacs10',   loadComponent: () => import('./pages/manual-entry/pacs/pacs10/pacs10.component').then(m => m.Pacs10Component) },
    { path: 'generate/pacs10v3', loadComponent: () => import('./pages/manual-entry/pacs/pacs10v3/pacs10v3.component').then(m => m.Pacs10v3Component) },

    // PAIN — Payments Initiation
    { path: 'generate/pain001', loadComponent: () => import('./pages/manual-entry/pain/pain001/pain001.component').then(m => m.Pain001Component) },
    { path: 'generate/pain002', loadComponent: () => import('./pages/manual-entry/pain/pain002/pain002.component').then(m => m.Pain002Component) },
    { path: 'generate/pain008', loadComponent: () => import('./pages/manual-entry/pain/pain008/pain008.component').then(m => m.Pain008Component) },

    // CAMT — Cash Management
    { path: 'generate/camt57',  loadComponent: () => import('./pages/manual-entry/camt/camt057/camt057.component').then(m => m.Camt057Component) },
    { path: 'generate/camt052', loadComponent: () => import('./pages/manual-entry/camt/camt052/camt052.component').then(m => m.Camt052Component) },
    { path: 'generate/camt053', loadComponent: () => import('./pages/manual-entry/camt/camt053/camt053.component').then(m => m.Camt053Component) },
    { path: 'generate/camt054', loadComponent: () => import('./pages/manual-entry/camt/camt054/camt054.component').then(m => m.Camt054Component) },
    { path: 'generate/camt055', loadComponent: () => import('./pages/manual-entry/camt/camt055/camt055.component').then(m => m.Camt055Component) },
    { path: 'generate/camt056', loadComponent: () => import('./pages/manual-entry/camt/camt056/camt056.component').then(m => m.Camt056Component) },

    // Fallback — generic schema explorer for unlisted message types
    { path: 'generate/:type', loadComponent: () => import('./pages/manual-entry/manual-entry.component').then(m => m.ManualEntryComponent) },

    { path: '**', redirectTo: '' }
];
