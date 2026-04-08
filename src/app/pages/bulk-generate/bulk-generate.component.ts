import JSZip from 'jszip';
import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfigService } from '../../services/config.service';

interface MessageBlock {
  id: string;
  label: string;
  mandatory: boolean;
  requires?: string[];
}

interface MessageTypeConfig {
  id: string;
  label: string;
  description: string;
  family: string;
  badge: string;
  blocks: MessageBlock[];
}

interface MessageFamily {
  name: string;
  label: string;
  messages: MessageTypeConfig[];
}

interface GeneratedMessage {
  index: number;
  xml: string;
  message_type: string;
  status: string;
  error?: string;
  validation_report?: any;
}

interface DependencyWarning {
  blockId: string;
  blockLabel: string;
  requiredId: string;
  requiredLabel: string;
}

/**
 * Single source of truth: Manual Entry popularMessages.
 * Bulk Generation dynamically derives its config from this list.
 * When a new message is added in Manual Entry, add it here
 * and it automatically appears in both Manual Entry AND Bulk Generation.
 */
const MANUAL_ENTRY_MESSAGES: {
  id: string;
  name: string;
  type: string;
  bulkId: string;          // key used by the backend bulk generator
}[] = [
  // ── PACS Messages ──
  { id: 'pacs.008.001.08', name: 'Customer Credit Transfer',     type: 'pacs', bulkId: 'pacs.008' },
  { id: 'pacs.003.001.08', name: 'Customer Direct Debit',        type: 'pacs', bulkId: 'pacs.003' },
  { id: 'pacs.009.001.08', name: 'FI Credit Transfer',           type: 'pacs', bulkId: 'pacs.009' },
  { id: 'pacs.009.001.08_ADV', name: 'FI Credit Transfer (Adv)', type: 'pacs', bulkId: 'pacs.009' },
  { id: 'pacs.009.001.08 COV', name: 'FI Credit Transfer (Cov)', type: 'pacs', bulkId: 'pacs.009.cov' },
  { id: 'pacs.004.001.09', name: 'Payment Return',               type: 'pacs', bulkId: 'pacs.004' },
  { id: 'pacs.002.001.10', name: 'Payment Status Report',        type: 'pacs', bulkId: 'pacs.002' },
  { id: 'pacs.010.001.10', name: 'Interbank Direct Debit',       type: 'pacs', bulkId: 'pacs.010' },
  { id: 'pacs.010.001.03', name: 'Margin Collection',            type: 'pacs', bulkId: 'pacs.010.v3' },

  // ── CAMT Messages ──
  { id: 'camt.057.001.08', name: 'Notification to Receive',              type: 'camt', bulkId: 'camt.057' },
  { id: 'camt.052.001.08', name: 'Account Report',                       type: 'camt', bulkId: 'camt.052' },
  { id: 'camt.053.001.08', name: 'Bank To Customer Statement',           type: 'camt', bulkId: 'camt.053' },
  { id: 'camt.054.001.08', name: 'Debit Credit Notification',            type: 'camt', bulkId: 'camt.054' },
  { id: 'camt.055.001.08', name: 'Customer Payment Cancellation Request',type: 'camt', bulkId: 'camt.055' },
  { id: 'camt.056.001.11', name: 'FI To FI Payment Cancellation',        type: 'camt', bulkId: 'camt.056' },

  // ── PAIN Messages ──
  { id: 'pain.001.001.09', name: 'Credit Transfer Initiation',   type: 'pain', bulkId: 'pain.001' },
  { id: 'pain.002.001.10', name: 'Payment Status Report',        type: 'pain', bulkId: 'pain.002' },
  { id: 'pain.008.001.08', name: 'Direct Debit Initiation',      type: 'pain', bulkId: 'pain.008' },
];

@Component({
  selector: 'app-bulk-generate',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './bulk-generate.component.html',
  styleUrl: './bulk-generate.component.css'
})
export class BulkGenerateComponent implements OnInit {

  /** All message configs dynamically built from Manual Entry source */
  messageConfigs: MessageTypeConfig[] = [];

  /** Grouped by family for category display */
  messageFamilies: MessageFamily[] = [];

  selectedConfig: MessageTypeConfig | null = null;

  messageCount: number = 10;
  messageCountError: string = '';

  // block selection: blockId -> boolean
  blockChecked: Record<string, boolean> = {};

  // dependency warnings list
  dependencyWarnings: DependencyWarning[] = [];

  // generation state
  isGenerating = false;
  generatedMessages: GeneratedMessage[] = [];
  expandedIndex: number | null = null;

  // generation stats from backend response
  generationStats: {
    requested: number;
    produced: number;
    totalAttempts: number;
  } | null = null;

  // preview / results view
  view: 'config' | 'results' = 'config';

  // loading state for blocks
  loadingBlocks = false;

  // ── Search State ──
  searchQuery = '';
  showDropdown = false;
  highlightedSuggestionIndex = -1;
  searchSuggestions: MessageTypeConfig[] = [];

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private snackBar: MatSnackBar,
    private elRef: ElementRef
  ) {}

  /** Close dropdown when clicking outside the search container */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const searchContainer = this.elRef.nativeElement.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(event.target as Node)) {
      this.showDropdown = false;
      this.highlightedSuggestionIndex = -1;
    }
  }

  ngOnInit() {
    this.buildConfigsFromManualEntry();
  }

  // ── Dynamic Config Builder ────────────────────────────────────────────────

  /**
   * Build message configs from the single source of truth (MANUAL_ENTRY_MESSAGES).
   * Groups them by family (PACS, CAMT, PAIN) for the UI.
   * Blocks are loaded on-demand from the backend when a message is selected.
   */
  private buildConfigsFromManualEntry() {
    const familyMap: Record<string, { label: string; configs: MessageTypeConfig[] }> = {};

    const familyLabels: Record<string, string> = {
      pacs: 'PACS Messages',
      camt: 'Cash Management (CAMT)',
      pain: 'Payment Initiation (PAIN)',
    };

    for (const msg of MANUAL_ENTRY_MESSAGES) {
      const cfg: MessageTypeConfig = {
        id: msg.bulkId,
        label: msg.id,
        description: msg.name,
        family: msg.type.toUpperCase(),
        badge: msg.type,
        blocks: [],  // loaded on-demand from backend
      };

      if (!familyMap[msg.type]) {
        familyMap[msg.type] = {
          label: familyLabels[msg.type] || msg.type.toUpperCase(),
          configs: [],
        };
      }
      familyMap[msg.type].configs.push(cfg);
      this.messageConfigs.push(cfg);
    }

    // Build ordered family groups
    const familyOrder = ['pacs', 'camt', 'pain'];
    for (const key of familyOrder) {
      if (familyMap[key]) {
        this.messageFamilies.push({
          name: key,
          label: familyMap[key].label,
          messages: familyMap[key].configs,
        });
      }
    }

    // Any remaining families not in the order
    for (const key of Object.keys(familyMap)) {
      if (!familyOrder.includes(key)) {
        this.messageFamilies.push({
          name: key,
          label: familyMap[key].label,
          messages: familyMap[key].configs,
        });
      }
    }
  }

  // ── Search / Filter Logic ──────────────────────────────────────────────────

  /** Filtered families based on searchQuery — filters cards across code, description, and family */
  get filteredFamilies(): MessageFamily[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.messageFamilies;

    return this.messageFamilies
      .map(family => {
        const filtered = family.messages.filter(cfg =>
          cfg.label.toLowerCase().includes(q) ||
          cfg.description.toLowerCase().includes(q) ||
          cfg.family.toLowerCase().includes(q) ||
          cfg.id.toLowerCase().includes(q) ||
          family.label.toLowerCase().includes(q)
        );
        return { ...family, messages: filtered };
      })
      .filter(family => family.messages.length > 0);
  }

  /** Total count of visible messages after filtering */
  get filteredMessageCount(): number {
    return this.filteredFamilies.reduce((sum, f) => sum + f.messages.length, 0);
  }

  /** Whether the search has no results */
  get hasNoResults(): boolean {
    return this.searchQuery.trim().length > 0 && this.filteredMessageCount === 0;
  }

  onSearchInput() {
    const q = this.searchQuery.trim().toLowerCase();
    this.highlightedSuggestionIndex = -1;

    if (q.length === 0) {
      this.searchSuggestions = [];
      this.showDropdown = false;
      return;
    }

    // Build flat suggestion list (max 8)
    this.searchSuggestions = this.messageConfigs.filter(cfg =>
      cfg.label.toLowerCase().includes(q) ||
      cfg.description.toLowerCase().includes(q) ||
      cfg.family.toLowerCase().includes(q) ||
      cfg.id.toLowerCase().includes(q)
    ).slice(0, 8);

    this.showDropdown = this.searchSuggestions.length > 0;
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (!this.showDropdown || this.searchSuggestions.length === 0) {
      // If Enter is pressed with an exact-ish match
      if (event.key === 'Enter') {
        const q = this.searchQuery.trim().toLowerCase();
        const exact = this.messageConfigs.find(cfg =>
          cfg.label.toLowerCase() === q ||
          cfg.description.toLowerCase() === q
        );
        if (exact) {
          this.selectSuggestion(exact);
        }
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedSuggestionIndex = Math.min(
          this.highlightedSuggestionIndex + 1,
          this.searchSuggestions.length - 1
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedSuggestionIndex = Math.max(
          this.highlightedSuggestionIndex - 1,
          0
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (this.highlightedSuggestionIndex >= 0 && this.highlightedSuggestionIndex < this.searchSuggestions.length) {
          this.selectSuggestion(this.searchSuggestions[this.highlightedSuggestionIndex]);
        } else if (this.searchSuggestions.length === 1) {
          this.selectSuggestion(this.searchSuggestions[0]);
        }
        break;

      case 'Escape':
        this.showDropdown = false;
        this.highlightedSuggestionIndex = -1;
        break;
    }
  }

  selectSuggestion(cfg: MessageTypeConfig) {
    this.showDropdown = false;
    this.highlightedSuggestionIndex = -1;
    this.searchQuery = cfg.label;
    this.selectMessageType(cfg);
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchSuggestions = [];
    this.showDropdown = false;
    this.highlightedSuggestionIndex = -1;
  }

  onSearchFocus() {
    if (this.searchQuery.trim().length > 0 && this.searchSuggestions.length > 0) {
      this.showDropdown = true;
    }
  }

  // ── Message Type Selection ──────────────────────────────────────────────────

  selectMessageType(cfg: MessageTypeConfig) {
    this.selectedConfig = cfg;
    this.blockChecked = {};
    this.dependencyWarnings = [];
    this.generatedMessages = [];
    this.view = 'config';
    this.expandedIndex = null;

    // If blocks haven't been loaded yet, fetch from backend
    if (cfg.blocks.length === 0) {
      this.loadBlocksFromBackend(cfg);
    } else {
      // Pre-check mandatory blocks
      cfg.blocks.forEach(b => {
        this.blockChecked[b.id] = b.mandatory;
      });
    }
  }

  private loadBlocksFromBackend(cfg: MessageTypeConfig) {
    this.loadingBlocks = true;
    this.http.get<any>(this.config.getApiUrl(`/bulk-generate/blocks/${cfg.id}`)).subscribe({
      next: (res) => {
        const blocks: MessageBlock[] = (res.blocks || []).map((b: any) => ({
          id: b.id,
          label: b.label,
          mandatory: b.mandatory,
          requires: b.requires || undefined
        }));
        cfg.blocks = blocks;
        this.loadingBlocks = false;

        // Pre-check mandatory blocks
        cfg.blocks.forEach(b => {
          this.blockChecked[b.id] = b.mandatory;
        });
      },
      error: () => {
        this.loadingBlocks = false;
        this.snackBar.open('Failed to load block configuration.', 'Close', {
          duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom'
        });
      }
    });
  }

  // ── Block Checkbox Logic ───────────────────────────────────────────────────

  onBlockChange(blockId: string, checked: boolean) {
    if (!this.selectedConfig) return;

    const block = this.selectedConfig.blocks.find(b => b.id === blockId);
    if (!block || block.mandatory) return;  // mandatory blocks can't be toggled

    this.blockChecked[blockId] = checked;

    if (checked) {
      // Auto-check required dependencies
      this.autoCheckDependencies(blockId);
    } else {
      // Uncheck blocks that depend on this one
      this.autoClearDependents(blockId);
    }

    this.updateDependencyWarnings();
  }

  private autoCheckDependencies(blockId: string) {
    if (!this.selectedConfig) return;
    const block = this.selectedConfig.blocks.find(b => b.id === blockId);
    if (!block?.requires) return;
    block.requires.forEach(reqId => {
      if (!this.blockChecked[reqId]) {
        this.blockChecked[reqId] = true;
        this.autoCheckDependencies(reqId);
      }
    });
  }

  private autoClearDependents(blockId: string) {
    if (!this.selectedConfig) return;
    this.selectedConfig.blocks
      .filter(b => b.requires?.includes(blockId) && !b.mandatory)
      .forEach(dependent => {
        this.blockChecked[dependent.id] = false;
        this.autoClearDependents(dependent.id);
      });
  }

  private updateDependencyWarnings() {
    if (!this.selectedConfig) return;
    const warnings: DependencyWarning[] = [];

    this.selectedConfig.blocks.forEach(block => {
      if (this.blockChecked[block.id] && block.requires) {
        block.requires.forEach(reqId => {
          if (!this.blockChecked[reqId]) {
            const reqBlock = this.selectedConfig!.blocks.find(b => b.id === reqId);
            if (reqBlock) {
              warnings.push({
                blockId: block.id,
                blockLabel: block.label,
                requiredId: reqId,
                requiredLabel: reqBlock.label
              });
            }
          }
        });
      }
    });

    this.dependencyWarnings = warnings;
  }

  // ── Count Validation ───────────────────────────────────────────────────────

  onCountChange() {
    const v = this.messageCount;
    if (!v || v < 1) {
      this.messageCountError = 'Minimum value is 1.';
    } else if (v > 500) {
      this.messageCountError = 'Maximum value is 500.';
    } else if (!Number.isInteger(v)) {
      this.messageCountError = 'Must be a whole number.';
    } else {
      this.messageCountError = '';
    }
  }

  // ── Selected Blocks List ───────────────────────────────────────────────────

  get selectedBlocks(): string[] {
    return Object.entries(this.blockChecked)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  get mandatoryBlocks(): MessageBlock[] {
    return this.selectedConfig?.blocks.filter(b => b.mandatory) ?? [];
  }

  get optionalBlocks(): MessageBlock[] {
    const mandatoryIds = new Set(this.mandatoryBlocks.map(b => b.id));
    return this.selectedConfig?.blocks.filter(b => !b.mandatory && !mandatoryIds.has(b.id)) ?? [];
  }

  get canGenerate(): boolean {
    return !!(
      this.selectedConfig &&
      !this.messageCountError &&
      this.messageCount >= 1 &&
      this.dependencyWarnings.length === 0 &&
      this.selectedConfig.blocks.length > 0
    );
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  generate() {
    if (!this.canGenerate || !this.selectedConfig) return;

    this.isGenerating = true;
    this.generatedMessages = [];
    this.generationStats = null;

    const payload = {
      message_type: this.selectedConfig.id,
      count: this.messageCount,
      selected_blocks: this.selectedBlocks
    };

    this.http.post<any>(this.config.getApiUrl('/bulk-generate'), payload).subscribe({
      next: (res) => {
        this.generatedMessages = res.messages || [];
        this.isGenerating = false;
        this.expandedIndex = null;

        // Store generation stats for display
        this.generationStats = {
          requested: res.requested || this.messageCount,
          produced: res.count || 0,
          totalAttempts: res.total_attempts || 0
        };

        // Backend guarantees exactly N valid messages — always show success
        this.view = 'results';
        this.snackBar.open(
          `✅ Generated ${res.count} valid messages successfully.`,
          'Close',
          { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom' }
        );
      },
      error: (err) => {
        this.isGenerating = false;
        // Handle both string detail and object detail from HTTP 500 catastrophic errors
        const detail = typeof err?.error?.detail === 'string'
          ? err.error.detail
          : err?.error?.detail?.message || err?.message || 'Generation failed. Please try again.';
        this.snackBar.open(`❌ ${detail}`, 'Close', {
          duration: 8000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      }
    });
  }

  // ── Results Actions ────────────────────────────────────────────────────────

  toggleExpand(idx: number) {
    this.expandedIndex = this.expandedIndex === idx ? null : idx;
  }

  copyXml(msg: GeneratedMessage) {
    navigator.clipboard.writeText(msg.xml).then(() => {
      this.snackBar.open(`Message #${msg.index} copied to clipboard.`, 'Close', { duration: 2500 });
    });
  }

  downloadXml(msg: GeneratedMessage) {
    const blob = new Blob([msg.xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.selectedConfig?.id || 'message'}-${String(msg.index).padStart(4, '0')}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async downloadAll() {
    if (!this.generatedMessages.length) return;
    const zip = new JSZip();
    const msgId = this.selectedConfig?.id || 'bulk';
    this.generatedMessages.forEach(m => {
      const filename = `${msgId}-${String(m.index).padStart(4, '0')}.xml`;
      zip.file(filename, m.xml);
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${msgId}-${this.generatedMessages.length}-messages.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadZip() {
    // Download each XML as individual file by triggering multiple downloads
    this.generatedMessages.forEach((msg, i) => {
      setTimeout(() => this.downloadXml(msg), i * 80);
    });
  }

  backToConfig() {
    this.view = 'config';
  }

  regenerate() {
    this.generate();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getFamilyClass(family: string): string {
    return family.toLowerCase();
  }

  getLineCount(xml: string): number {
    return xml.split('\n').length;
  }

  trackByIndex(_i: number, msg: GeneratedMessage) {
    return msg.index;
  }
}
