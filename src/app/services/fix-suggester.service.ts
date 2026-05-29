import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface IssueRef {
  severity: string;
  layer: number;
  code: string;
  path: string;
  message: string;
  fix_suggestion?: string;
  related_test?: string;
  line?: number | null;
}

export interface FixSuggestionResponse {
  xpath: string;
  original_fragment: string;
  fragment_xml: string;
  issue_code: string;
  issue_message: string;
  confidence: 'high' | 'low' | 'unavailable' | 'resolved';
}

export interface SuggestBatchResponse {
  fixes: FixSuggestionResponse[];
}

export interface ApplyResponse {
  new_xml: string;
}

export interface BatchFix {
  xpath: string;
  fragment_xml: string;
}

@Injectable({ providedIn: 'root' })
export class FixSuggesterService {
  constructor(private http: HttpClient, private config: ConfigService) {}

  suggest(xml: string, issue: IssueRef): Observable<FixSuggestionResponse> {
    return this.http.post<FixSuggestionResponse>(
      this.config.getApiUrl('/fixes/suggest'),
      { xml, issue }
    );
  }

  suggestBatch(xml: string, issues: IssueRef[]): Observable<SuggestBatchResponse> {
    return this.http.post<SuggestBatchResponse>(
      this.config.getApiUrl('/fixes/suggest-batch'),
      { xml, issues }
    );
  }

  apply(xml: string, xpath: string, fragment_xml: string): Observable<ApplyResponse> {
    return this.http.post<ApplyResponse>(
      this.config.getApiUrl('/fixes/apply'),
      { xml, xpath, fragment_xml }
    );
  }

  applyBatch(xml: string, fixes: BatchFix[]): Observable<ApplyResponse> {
    return this.http.post<ApplyResponse>(
      this.config.getApiUrl('/fixes/apply-batch'),
      { xml, fixes }
    );
  }
}
