import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SrVersionService } from './sr-version.service';

export const versionInterceptor: HttpInterceptorFn = (req, next) => {
  const srVersionService = inject(SrVersionService);
  const version = srVersionService.currentVersion; // 'SR2025' or 'SR2026'

  // Clone the request to add the custom x-sr-version header
  const modifiedReq = req.clone({
    headers: req.headers.set('x-sr-version', version)
  });

  return next(modifiedReq);
};
