import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private readonly baseUrl = environment.apiBaseUrl;

  getApiUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
