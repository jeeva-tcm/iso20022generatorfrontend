import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface BicRecord {
  bic: string;
  name: string;
  country: string;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class BicSearchService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  search(query: string, limit?: number): Observable<BicRecord[]> {
    if (!query || query.length < 2) {
      return of([]);
    }
    let url = `${this.config.getApiUrl('/bics/search')}?query=${encodeURIComponent(query)}`;
    if (limit && limit > 0) {
      url += `&limit=${limit}`;
    }
    return this.http.get<BicRecord[]>(url).pipe(
      catchError(err => {
        console.error('BIC search failed:', err);
        return of([]);
      })
    );
  }
}
