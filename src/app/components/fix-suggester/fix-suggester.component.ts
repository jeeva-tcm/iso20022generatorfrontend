import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy,
  SimpleChanges, HostListener, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, ElementRef, AfterViewChecked
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

type ItemStatus = 'ready' | 'applied' | 'failed' | 'unavailable' | 'no-change' | 'resolved';

export interface BatchFixItem {
  suggestion: FixSuggestionResponse;
  selected: boolean;
  expanded: boolean;
  diffLines: DiffLine[];
  hasChanges: boolean;
  status: ItemStatus;
  /** Per-line summary (for single-line value changes) — used by inline char diff */
  inlineFrom?: string;
  inlineTo?: string;
}

@Component({
  selector: 'app-fix-suggester',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './fix-suggester.component.html',
  styleUrls: ['./fix-suggester.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixSuggesterComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {

  @Input() xml!: string;
  @Input() issue?: IssueRef;
  @Input() issues?: IssueRef[];
  @Input() mode: 'single' | 'batch' = 'single';

  @Output() applied = new EventEmitter<string>();
  @Output() dismissed = new EventEmitter<void>();

  /** Native input ref so we can drive .indeterminate as a property
   * (Angular doesn't reflect [indeterminate] to the IDL attribute reliably). */
  @ViewChild('masterCheck') masterCheck?: ElementRef<HTMLInputElement>;

  // ── state ──────────────────────────────────────────────────────────────
  loading = false;
  applying = false;
  errorMsg: string | null = null;

  // Single mode
  suggestion: FixSuggestionResponse | null = null;
  singleDiff: DiffLine[] = [];
  singleHasChanges = false;
  singleInlineFrom = '';
  singleInlineTo = '';

  // Batch mode
  batchItems: BatchFixItem[] = [];

  // Derived counters (recomputed on changes via OnPush)
  get total(): number { return this.batchItems.length; }
  get selectedCount(): number {
    return this.batchItems.filter(i => i.selected && i.status === 'ready').length;
  }
  get actionableCount(): number {
    return this.batchItems.filter(i => i.status === 'ready').length;
  }
  get appliedCount(): number {
    return this.batchItems.filter(i => i.status === 'applied').length;
  }
  get unavailableCount(): number {
    return this.batchItems.filter(i => i.status === 'unavailable').length;
  }

  /** True when every actionable fix is selected — drives the master checkbox state. */
  get allSelected(): boolean {
    return this.actionableCount > 0 && this.selectedCount === this.actionableCount;
  }
  get someSelected(): boolean {
    return this.selectedCount > 0 && this.selectedCount < this.actionableCount;
  }

  constructor(
    private fixService: FixSuggesterService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ── lifecycle ──────────────────────────────────────────────────────────
  ngOnInit() {
    document.body.classList.add('fs-modal-open');
    this.loadSuggestions();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['issue'] || changes['issues'] || changes['mode']) {
      this.reset();
      this.loadSuggestions();
    }
  }

  ngOnDestroy() {
    document.body.classList.remove('fs-modal-open');
  }

  ngAfterViewChecked() {
    // Drive the native .indeterminate property — Angular's property binding
    // doesn't reliably set this IDL attribute on input[type=checkbox].
    if (this.masterCheck) {
      this.masterCheck.nativeElement.indeterminate = this.someSelected;
    }
  }

  // ── keyboard ───────────────────────────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEsc() {
    if (!this.applying) this.dismiss();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      this.primaryAction();
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────
  private reset() {
    this.loading = false;
    this.applying = false;
    this.errorMsg = null;
    this.suggestion = null;
    this.singleDiff = [];
    this.singleHasChanges = false;
    this.singleInlineFrom = '';
    this.singleInlineTo = '';
    this.batchItems = [];
  }

  private classifyStatus(s: FixSuggestionResponse, hasChg: boolean): ItemStatus {
    if (s.confidence === 'unavailable') return 'unavailable';
    // 'resolved' = this issue's element was already corrected by an earlier
    // fix in the same batch (overlapping defect). It's a success, not a
    // no-op — show it as already-handled, and don't require user action.
    if ((s.confidence as string) === 'resolved') return 'resolved';
    if (!hasChg) return 'no-change';
    return 'ready';
  }

  /**
   * Strip XML tags from a fragment to expose the inner value when both sides
   * differ only in their text node. Used for the inline before→after pill.
   * Returns null when no clean single-value extraction is possible.
   */
  private extractInner(fragment: string): string | null {
    const m = fragment.match(/^<([\w:.-]+)(\s[^>]*)?>([\s\S]*?)<\/\1>\s*$/);
    return m ? m[3].trim() : null;
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
            const innerA = this.extractInner(s.original_fragment);
            const innerB = this.extractInner(s.fragment_xml);
            if (innerA !== null && innerB !== null && innerA !== innerB
                && !innerA.includes('\n') && !innerB.includes('\n')
                && innerA.length < 200 && innerB.length < 200) {
              this.singleInlineFrom = innerA;
              this.singleInlineTo = innerB;
            }
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = 'Failed to get fix suggestion. Check backend connectivity.';
          this.cdr.markForCheck();
          console.error('[FixSuggester]', err);
        }
      });

    } else if (this.mode === 'batch' && this.issues?.length) {
      this.loading = true;
      const issuesToSend = this.issues.slice(0, 20);
      this.fixService.suggestBatch(this.xml, issuesToSend).subscribe({
        next: (resp) => {
          this.loading = false;
          this.batchItems = resp.fixes.map(s => {
            const dl = diffLines(s.original_fragment, s.fragment_xml);
            const chg = hasChanges(dl);
            const status = this.classifyStatus(s, chg);
            const innerA = this.extractInner(s.original_fragment);
            const innerB = this.extractInner(s.fragment_xml);
            const inline = (
              innerA !== null && innerB !== null && innerA !== innerB
              && !innerA.includes('\n') && !innerB.includes('\n')
              && innerA.length < 200 && innerB.length < 200
            );
            return {
              suggestion: s,
              selected: status === 'ready',
              expanded: false,
              diffLines: dl,
              hasChanges: chg,
              status,
              inlineFrom: inline ? innerA! : undefined,
              inlineTo:   inline ? innerB! : undefined,
            };
          });
          if (this.unavailableCount > 0) {
            this.errorMsg = `${this.unavailableCount} fix${this.unavailableCount === 1 ? '' : 'es'} couldn't be generated — AI unavailable for those issues.`;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = 'Failed to get batch fix suggestions. Check backend connectivity.';
          this.cdr.markForCheck();
          console.error('[FixSuggester]', err);
        }
      });
    }
  }

  // ── interactions ───────────────────────────────────────────────────────
  toggleBatchItem(item: BatchFixItem) {
    if (item.status === 'ready') {
      item.selected = !item.selected;
      this.cdr.markForCheck();
    }
  }

  toggleExpanded(item: BatchFixItem, ev?: Event) {
    if (ev) ev.stopPropagation();
    item.expanded = !item.expanded;
    this.cdr.markForCheck();
  }

  toggleAll() {
    const target = !this.allSelected;
    this.batchItems.forEach(i => {
      if (i.status === 'ready') i.selected = target;
    });
    this.cdr.markForCheck();
  }

  /** Bound to the master <input type=checkbox>. */
  onMasterChange(_: Event) {
    this.toggleAll();
  }

  /** Apply on Cmd/Ctrl-Enter. Routes to the correct accept handler. */
  primaryAction() {
    if (this.mode === 'single') this.acceptSingle();
    else this.acceptSelected();
  }

  acceptSingle() {
    if (!this.suggestion || this.suggestion.confidence === 'unavailable' || !this.singleHasChanges) return;
    this.applying = true;
    this.cdr.markForCheck();
    this.fixService.apply(this.xml, this.suggestion.xpath, this.suggestion.fragment_xml).subscribe({
      next: (resp) => {
        this.applying = false;
        this.applied.emit(resp.new_xml);
      },
      error: (err) => {
        this.applying = false;
        this.errorMsg = `Failed to apply fix: ${err?.error?.detail ?? err.message}`;
        this.cdr.markForCheck();
        console.error('[FixSuggester] apply error', err);
      }
    });
  }

  acceptSelected() {
    const selected = this.batchItems.filter(i => i.selected && i.status === 'ready');
    if (selected.length === 0) return;
    const fixes: BatchFix[] = selected.map(i => ({
      xpath: i.suggestion.xpath,
      fragment_xml: i.suggestion.fragment_xml
    }));
    this.applying = true;
    this.cdr.markForCheck();
    this.fixService.applyBatch(this.xml, fixes).subscribe({
      next: (resp) => {
        // Mark all selected items as applied for the closing animation
        selected.forEach(i => i.status = 'applied');
        this.applying = false;
        this.cdr.markForCheck();
        // Brief pause so the user sees the green check, then emit.
        setTimeout(() => this.applied.emit(resp.new_xml), 350);
      },
      error: (err) => {
        this.applying = false;
        this.errorMsg = `Failed to apply fixes: ${err?.error?.detail ?? err.message}`;
        this.cdr.markForCheck();
        console.error('[FixSuggester] apply-batch error', err);
      }
    });
  }

  dismiss() {
    this.dismissed.emit();
  }

  // ── presentation helpers ───────────────────────────────────────────────
  confidenceLabel(c: string): string {
    if (c === 'high') return 'High confidence';
    if (c === 'low')  return 'Needs review';
    if (c === 'resolved') return 'Resolved by another fix';
    return 'Unavailable';
  }

  confidenceClass(c: string): string {
    if (c === 'high') return 'conf-high';
    if (c === 'low')  return 'conf-low';
    if (c === 'resolved') return 'conf-resolved';
    return 'conf-unavail';
  }

  statusIcon(s: ItemStatus): string {
    switch (s) {
      case 'applied':     return 'check_circle';
      case 'resolved':    return 'check_circle';
      case 'failed':      return 'error';
      case 'unavailable': return 'cloud_off';
      case 'no-change':   return 'remove_circle_outline';
      default:            return 'auto_fix_high';
    }
  }

  /** Returns severity dot color class derived from confidence + has-change. */
  itemStatusClass(item: BatchFixItem): string {
    return `item-${item.status} conf-${item.suggestion.confidence}`;
  }

  /** Click on the card body (anywhere except the checkbox) toggles expanded. */
  onCardClick(item: BatchFixItem, ev: Event) {
    const target = ev.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button')) return;
    this.toggleExpanded(item);
  }

  // Track-by helpers for *ngFor stability
  trackByCode = (i: number, item: BatchFixItem) => item.suggestion.issue_code + '|' + item.suggestion.xpath + '|' + i;
  trackByLine = (i: number) => i;
}
