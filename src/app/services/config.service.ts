// import { Injectable } from '@angular/core';

// @Injectable({
//     providedIn: 'root'
// })
// export class ConfigService {
//     /**
//      * For Global Deployment:
//      * 1. If null/undefined, the app will try to use the current window origin + /api
//      * 2. You can set this to a hardcoded URL for cross-domain setups
//      */
//     private readonly baseUrl = 'http://127.0.0.1:8001';

//     getApiUrl(path: string): string {
//         // Check if we are in production build/running on a remote server
//         if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
//             // Automatic fallback for global deployment: use the same domain/IP we are currently on
//             // This assumes the API is proxied or served from the same host
//             const port = window.location.port ? ':' + window.location.port : '';
//             return `${window.location.protocol}//${window.location.hostname}${port}${path}`;
//         }

//         // Default for local development
//         return `${this.baseUrl}${path}`;
//     }
// }

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private readonly localUrl = 'http://127.0.0.1:8001';
  // private readonly productionUrl = 'https://backend-python-production-0cc8.up.railway.app';
  private readonly productionUrl = 'https://iso20022generatorbackend.onrender.com';

  getApiUrl(path: string): string {

    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const base = isLocal ? this.localUrl : this.productionUrl;

    return `${base}${path}`;
  }
}
