import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClientModule, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { MatNativeDateModule } from '@angular/material/core';
import { SelectivePreloadStrategy } from './services/selective-preload.strategy';
import { versionInterceptor } from './services/version.interceptor';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes, withPreloading(SelectivePreloadStrategy)),
        provideAnimations(),
        provideHttpClient(withFetch(), withInterceptors([versionInterceptor])),
        importProvidersFrom(MatNativeDateModule)
    ]
};
