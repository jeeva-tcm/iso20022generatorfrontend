import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  FixSuggesterService,
  FixSuggestionResponse,
  IssueRef,
  BatchFix
} from '../../services/fix-suggester.service';
import { diffLines, DiffLine, hasChanges } from '../../utils/inline-diff';

export interface BatchFixItem {
  suggestion: FixSuggestionResponse;
  selected: boolean;
  diffLines: DiffLine[];
  hasChanges: boolean;
}

@Component({
  selector: 'app-fix-suggester',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './fix-suggester.component.html',
  styleUrls: ['./fix-suggester.component.css']
})
export class FixSuggesterComponent implements OnInit, OnChanges {

  /** Full XML string of the current file */
  @Input() xml!: string;

  /** Single-issue mode: the one issue to fix */
  @Input() issue?: IssueRef;

  /** Batch mode: all issues to fix */
  @Input() issues?: IssueRef[];

  /** 'single' or 'batch' */
  @Input() mode: 'single' | 'batch' = 'single';

  /** Emits the updated XML after Accept */
  @Output() applied = new EventEmitter<string>();

  /** Emits when user dismisses the modal */
  @Output() dismissed = new EventEmitter<void>();

  // ── state ──────────────────────────────────────────────────────────────
  loading = false;
  applying = false;
  errorMsg: string | null = null;

  // Single mode
  suggestion: FixSuggestionResponse | null = null;
  singleDiff: DiffLine[] = [];
  singleHasChanges = false;

  // Batch mode
  batchItems: BatchFixItem[] = [];
  get selectedCount(): number { return this.batchItems.filter(i => i.selected).length; }

  constructor(private fixService: FixSuggesterService) {}

  ngOnInit() {
    this.loadSuggestions();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Re-load if inputs change (e.g. modal reused for different issue)
    if (changes['issue'] || changes['issues'] || changes['mode']) {
      this.reset();
      this.loadSuggestions();
    }
  }

  private reset() {
    this.loading = false;
    this.applying = false;
    this.errorMsg = null;
    this.suggestion = null;
    this.singleDiff = [];
    this.singleHasChanges = false;
    this.batchItems = [];
  }

  private loadSuggestions() {
    if (this.mode === 'single' && this.issue) {
      this.loading = true;
      this.fixService.suggest(this.xml, this.issue).subscribe({
        next: (s) => {
          this.loading = false;
          this.suggestion = s;
          if (s.confidence === 'unavailable') {
            this.errorMsg = 'AI fix unavailable — API key not configured or service unreachable.';
          } else {
            this.singleDiff = diffLines(s.original_fragment, s.fragment_xml);
            this.singleHasChanges = hasChanges(this.singleDiff);
          }
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = 'Failed to get fix suggestion. Check backend connectivity.';
          console.error('[FixSuggester]', err);
        }
      });

    } else if (this.mode === 'batch' && this.issues?.length) {
      this.loading = true;
      // Cap at 20
      const issuesToSend = this.issues.slice(0, 20);
      this.fixService.suggestBatch(this.xml, issuesToSend).subscribe({
        next: (resp) => {
          this.loading = false;
          this.batchItems = resp.fixes.map(s => {
            const dl = diffLines(s.original_fragment, s.fragment_xml);
            return {
              suggestion: s,
              selected: s.confidence !== 'unavailable',
              diffLines: dl,
              hasChanges: hasChanges(dl)
            };
          });
          const unavailable = this.batchItems.filter(i => i.suggestion.confidence === 'unavailable').length;
          if (unavailable > 0) {
            this.errorMsg = `${unavailable} fix(es) unavailable — AI service unreachable for those issues.`;
          }
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = 'Failed to get batch fix suggestions. Check backend connectivity.';
          console.error('[FixSuggester]', err);
        }
      });
    }
  }

  toggleBatchItem(item: BatchFixItem) {
    if (item.suggestion.confidence !== 'unavailable') {
      item.selected = !item.selected;
    }
  }

  acceptSingle() {
    if (!this.suggestion || this.suggestion.confidence === 'unavailable') return;
    this.applying = true;
    this.fixService.apply(this.xml, this.suggestion.xpath, this.suggestion.fragment_xml).subscribe({
      next: (resp) => {
        this.applying = false;
        this.applied.emit(resp.new_xml);
      },
      error: (err) => {
        this.applying = false;
        this.errorMsg = `Failed to apply fix: ${err?.error?.detail ?? err.message}`;
        console.error('[FixSuggester] apply error', err);
      }
    });
  }

  acceptSelected() {
    const selected = this.batchItems.filter(i => i.selected && i.suggestion.confidence !== 'unavailable');
    if (selected.length === 0) return;
    const fixes: BatchFix[] = selected.map(i => ({
      xpath: i.suggestion.xpath,
      fragment_xml: i.suggestion.fragment_xml
    }));
    this.applying = true;
    this.fixService.applyBatch(this.xml, fixes).subscribe({
      next: (resp) => {
        this.applying = false;
        this.applied.emit(resp.new_xml);
      },
      error: (err) => {
        this.applying = false;
        this.errorMsg = `Failed to apply fixes: ${err?.error?.detail ?? err.message}`;
        console.error('[FixSuggester] apply-batch error', err);
      }
    });
  }

  dismiss() {
    this.dismissed.emit();
  }

  confidenceLabel(c: string): string {
    if (c === 'high') return 'High confidence';
    if (c === 'low') return 'Low confidence — review carefully';
    return 'Unavailable';
  }

  confidenceClass(c: string): string {
    if (c === 'high') return 'conf-high';
    if (c === 'low') return 'conf-low';
    return 'conf-unavail';
  }
}
