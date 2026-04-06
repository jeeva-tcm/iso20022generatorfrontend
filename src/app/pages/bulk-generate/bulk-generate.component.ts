import JSZip from 'jszip';
import { Component, OnInit } from '@angular/core';
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
  family: 'PACS' | 'CAMT' | 'PAIN';
  badge: string;
  blocks: MessageBlock[];
}

interface GeneratedMessage {
  index: number;
  xml: string;
  message_type: string;
  status: string;
  error?: string;
}

interface DependencyWarning {
  blockId: string;
  blockLabel: string;
  requiredId: string;
  requiredLabel: string;
}

const MESSAGE_CONFIGS: MessageTypeConfig[] = [
  {
    id: 'pacs.008',
    label: 'pacs.008.001.08',
    description: 'Customer Credit Transfer',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',           label: 'Instructing Agent',            mandatory: true },
      { id: 'instructed_agent',            label: 'Instructed Agent',             mandatory: true },
      { id: 'debtor_agent',                label: 'Debtor Agent',                 mandatory: true },
      { id: 'debtor',                      label: 'Debtor',                       mandatory: true },
      { id: 'debtor_account',              label: 'Debtor Account',               mandatory: true,  requires: ['debtor'] },
      { id: 'creditor_agent',              label: 'Creditor Agent',               mandatory: true },
      { id: 'creditor',                    label: 'Creditor',                     mandatory: true },
      { id: 'creditor_account',            label: 'Creditor Account',             mandatory: true,  requires: ['creditor'] },
      { id: 'previous_instructing_agent_1',label: 'Previous Instructing Agent 1', mandatory: false },
      { id: 'previous_instructing_agent_2',label: 'Previous Instructing Agent 2', mandatory: false, requires: ['previous_instructing_agent_1'] },
      { id: 'previous_instructing_agent_3',label: 'Previous Instructing Agent 3', mandatory: false, requires: ['previous_instructing_agent_2'] },
      { id: 'intermediary_agent_1',        label: 'Intermediary Agent 1',         mandatory: false },
      { id: 'intermediary_agent_1_account',label: 'Intermediary Agent 1 Account', mandatory: false, requires: ['intermediary_agent_1'] },
      { id: 'intermediary_agent_2',        label: 'Intermediary Agent 2',         mandatory: false, requires: ['intermediary_agent_1'] },
      { id: 'intermediary_agent_2_account',label: 'Intermediary Agent 2 Account', mandatory: false, requires: ['intermediary_agent_2'] },
      { id: 'intermediary_agent_3',        label: 'Intermediary Agent 3',         mandatory: false, requires: ['intermediary_agent_2'] },
      { id: 'intermediary_agent_3_account',label: 'Intermediary Agent 3 Account', mandatory: false, requires: ['intermediary_agent_3'] },
      { id: 'debtor_agent_account',        label: 'Debtor Agent Account',         mandatory: false, requires: ['debtor_agent'] },
      { id: 'creditor_agent_account',      label: 'Creditor Agent Account',       mandatory: false, requires: ['creditor_agent'] },
      { id: 'ultimate_debtor',             label: 'Ultimate Debtor',              mandatory: false },
      { id: 'ultimate_creditor',           label: 'Ultimate Creditor',            mandatory: false },
      { id: 'payment_type_information',    label: 'Payment Type Information',     mandatory: false },
      { id: 'remittance_information',      label: 'Remittance Information',       mandatory: false },
      { id: 'charges_information',         label: 'Charges Information',          mandatory: false },
      { id: 'settlement_time_request',     label: 'Settlement Time Request',      mandatory: false },
    ]
  },
  {
    id: 'pacs.009',
    label: 'pacs.009.001.08',
    description: 'FI Credit Transfer',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',           label: 'Instructing Agent',            mandatory: true },
      { id: 'instructed_agent',            label: 'Instructed Agent',             mandatory: true },
      { id: 'debtor',                      label: 'Debtor',                       mandatory: false },
      { id: 'debtor_account',              label: 'Debtor Account',               mandatory: false, requires: ['debtor'] },
      { id: 'debtor_agent',                label: 'Debtor Agent',                 mandatory: false },
      { id: 'debtor_agent_account',        label: 'Debtor Agent Account',         mandatory: false, requires: ['debtor_agent'] },
      { id: 'creditor_agent',              label: 'Creditor Agent',               mandatory: false },
      { id: 'creditor_agent_account',      label: 'Creditor Agent Account',       mandatory: false, requires: ['creditor_agent'] },
      { id: 'creditor',                    label: 'Creditor',                     mandatory: false },
      { id: 'creditor_account',            label: 'Creditor Account',             mandatory: false, requires: ['creditor'] },
      { id: 'previous_instructing_agent_1',label: 'Previous Instructing Agent 1', mandatory: false },
      { id: 'previous_instructing_agent_2',label: 'Previous Instructing Agent 2', mandatory: false, requires: ['previous_instructing_agent_1'] },
      { id: 'previous_instructing_agent_3',label: 'Previous Instructing Agent 3', mandatory: false, requires: ['previous_instructing_agent_2'] },
      { id: 'intermediary_agent_1',        label: 'Intermediary Agent 1',         mandatory: false },
      { id: 'intermediary_agent_1_account',label: 'Intermediary Agent 1 Account', mandatory: false, requires: ['intermediary_agent_1'] },
      { id: 'intermediary_agent_2',        label: 'Intermediary Agent 2',         mandatory: false, requires: ['intermediary_agent_1'] },
      { id: 'intermediary_agent_2_account',label: 'Intermediary Agent 2 Account', mandatory: false, requires: ['intermediary_agent_2'] },
      { id: 'intermediary_agent_3',        label: 'Intermediary Agent 3',         mandatory: false, requires: ['intermediary_agent_2'] },
      { id: 'intermediary_agent_3_account',label: 'Intermediary Agent 3 Account', mandatory: false, requires: ['intermediary_agent_3'] },
      { id: 'ultimate_debtor',             label: 'Ultimate Debtor',              mandatory: false },
      { id: 'ultimate_creditor',           label: 'Ultimate Creditor',            mandatory: false },
      { id: 'payment_type_information',    label: 'Payment Type Information',     mandatory: false },
      { id: 'remittance_information',      label: 'Remittance Information',       mandatory: false },
      { id: 'charges_information',         label: 'Charges Information',          mandatory: false },
      { id: 'settlement_time_request',     label: 'Settlement Time Request',      mandatory: false },
    ]
  },
  {
    id: 'pacs.009.cov',
    label: 'pacs.009.001.08 COV',
    description: 'FI Credit Transfer (Coverage)',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',                       label: 'Instructing Agent',                         mandatory: true },
      { id: 'instructed_agent',                        label: 'Instructed Agent',                          mandatory: true },
      { id: 'underlying_customer_credit_transfer',     label: 'Underlying Customer Credit Transfer (COV)', mandatory: true },
      { id: 'debtor',                                  label: 'Debtor',                                    mandatory: false },
      { id: 'debtor_account',                          label: 'Debtor Account',                            mandatory: false, requires: ['debtor'] },
      { id: 'debtor_agent',                            label: 'Debtor Agent',                              mandatory: false },
      { id: 'debtor_agent_account',                    label: 'Debtor Agent Account',                      mandatory: false, requires: ['debtor_agent'] },
      { id: 'creditor_agent',                          label: 'Creditor Agent',                            mandatory: false },
      { id: 'creditor_agent_account',                  label: 'Creditor Agent Account',                    mandatory: false, requires: ['creditor_agent'] },
      { id: 'creditor',                                label: 'Creditor',                                  mandatory: false },
      { id: 'creditor_account',                        label: 'Creditor Account',                          mandatory: false, requires: ['creditor'] },
      { id: 'previous_instructing_agent_1',            label: 'Previous Instructing Agent 1',              mandatory: false },
      { id: 'intermediary_agent_1',                    label: 'Intermediary Agent 1',                      mandatory: false },
      { id: 'intermediary_agent_1_account',            label: 'Intermediary Agent 1 Account',              mandatory: false, requires: ['intermediary_agent_1'] },
      { id: 'intermediary_agent_2',                    label: 'Intermediary Agent 2',                      mandatory: false, requires: ['intermediary_agent_1'] },
      { id: 'intermediary_agent_2_account',            label: 'Intermediary Agent 2 Account',              mandatory: false, requires: ['intermediary_agent_2'] },
      { id: 'intermediary_agent_3',                    label: 'Intermediary Agent 3',                      mandatory: false, requires: ['intermediary_agent_2'] },
      { id: 'ultimate_debtor',                         label: 'Ultimate Debtor',                           mandatory: false },
      { id: 'ultimate_creditor',                       label: 'Ultimate Creditor',                         mandatory: false },
      { id: 'payment_type_information',                label: 'Payment Type Information',                  mandatory: false },
      { id: 'remittance_information',                  label: 'Remittance Information',                    mandatory: false },
    ]
  },
  {
    id: 'pacs.004',
    label: 'pacs.004.001.09',
    description: 'Payment Return',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',  label: 'Instructing Agent',        mandatory: true },
      { id: 'instructed_agent',   label: 'Instructed Agent',         mandatory: true },
      { id: 'debtor_agent',       label: 'Return Debtor Agent',      mandatory: true },
      { id: 'debtor',             label: 'Return Debtor',            mandatory: true },
      { id: 'debtor_account',     label: 'Return Debtor Account',    mandatory: false, requires: ['debtor'] },
      { id: 'creditor_agent',     label: 'Return Creditor Agent',    mandatory: true },
      { id: 'creditor',           label: 'Return Creditor',          mandatory: true },
      { id: 'creditor_account',   label: 'Return Creditor Account',  mandatory: false, requires: ['creditor'] },
      { id: 'intermediary_agent_1',label: 'Intermediary Agent 1',    mandatory: false },
      { id: 'ultimate_debtor',    label: 'Ultimate Debtor',          mandatory: false },
      { id: 'ultimate_creditor',  label: 'Ultimate Creditor',        mandatory: false },
      { id: 'charges_information',label: 'Charges Information',      mandatory: false },
      { id: 'remittance_information',label: 'Remittance Information',mandatory: false },
    ]
  },
  {
    id: 'pacs.003',
    label: 'pacs.003.001.08',
    description: 'Customer Direct Debit',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',        label: 'Instructing Agent',        mandatory: true },
      { id: 'instructed_agent',         label: 'Instructed Agent',         mandatory: true },
      { id: 'debtor_agent',             label: 'Debtor Agent',             mandatory: true },
      { id: 'debtor',                   label: 'Debtor',                   mandatory: true },
      { id: 'debtor_account',           label: 'Debtor Account',           mandatory: true,  requires: ['debtor'] },
      { id: 'creditor_agent',           label: 'Creditor Agent',           mandatory: true },
      { id: 'creditor',                 label: 'Creditor',                 mandatory: true },
      { id: 'creditor_account',         label: 'Creditor Account',         mandatory: true,  requires: ['creditor'] },
      { id: 'creditor_agent_account',   label: 'Creditor Agent Account',   mandatory: false, requires: ['creditor_agent'] },
      { id: 'ultimate_debtor',          label: 'Ultimate Debtor',          mandatory: false },
      { id: 'ultimate_creditor',        label: 'Ultimate Creditor',        mandatory: false },
      { id: 'payment_type_information', label: 'Payment Type Information', mandatory: false },
      { id: 'remittance_information',   label: 'Remittance Information',   mandatory: false },
      { id: 'charges_information',      label: 'Charges Information',      mandatory: false },
    ]
  },
  {
    id: 'pacs.002',
    label: 'pacs.002.001.10',
    description: 'Payment Status Report',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent', label: 'Instructing Agent', mandatory: true },
      { id: 'instructed_agent',  label: 'Instructed Agent',  mandatory: true },
      { id: 'debtor',            label: 'Original Debtor',   mandatory: false },
      { id: 'creditor',          label: 'Original Creditor', mandatory: false },
      { id: 'charges_information',label: 'Charges Information', mandatory: false },
    ]
  },
  {
    id: 'pacs.010',
    label: 'pacs.010.001.10',
    description: 'Interbank Direct Debit',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',        label: 'Instructing Agent',        mandatory: true },
      { id: 'instructed_agent',         label: 'Instructed Agent',         mandatory: true },
      { id: 'debtor_agent',             label: 'Debtor Agent',             mandatory: true },
      { id: 'debtor',                   label: 'Debtor',                   mandatory: true },
      { id: 'debtor_account',           label: 'Debtor Account',           mandatory: true,  requires: ['debtor'] },
      { id: 'creditor_agent',           label: 'Creditor Agent',           mandatory: false },
      { id: 'creditor',                 label: 'Creditor',                 mandatory: false },
      { id: 'creditor_account',         label: 'Creditor Account',         mandatory: false, requires: ['creditor'] },
      { id: 'payment_type_information', label: 'Payment Type Information', mandatory: false },
      { id: 'remittance_information',   label: 'Remittance Information',   mandatory: false },
    ]
  },
  {
    id: 'pacs.010.v3',
    label: 'pacs.010.001.03',
    description: 'Margin Collection',
    family: 'PACS',
    badge: 'pacs',
    blocks: [
      { id: 'instructing_agent',  label: 'Instructing Agent',  mandatory: true },
      { id: 'instructed_agent',   label: 'Instructed Agent',   mandatory: true },
      { id: 'debtor_agent',       label: 'Debtor Agent',       mandatory: true },
      { id: 'debtor',             label: 'Debtor',             mandatory: true },
      { id: 'debtor_account',     label: 'Debtor Account',     mandatory: true,  requires: ['debtor'] },
      { id: 'creditor_agent',     label: 'Creditor Agent',     mandatory: false },
      { id: 'creditor',           label: 'Creditor',           mandatory: false },
      { id: 'creditor_account',   label: 'Creditor Account',   mandatory: false, requires: ['creditor'] },
      { id: 'remittance_information',label:'Remittance Information',mandatory:false},
    ]
  },
];

@Component({
  selector: 'app-bulk-generate',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './bulk-generate.component.html',
  styleUrl: './bulk-generate.component.css'
})
export class BulkGenerateComponent implements OnInit {

  messageConfigs = MESSAGE_CONFIGS;
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

  // preview / results view
  view: 'config' | 'results' = 'config';

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {}

  // ── Message Type Selection ──────────────────────────────────────────────────

  selectMessageType(cfg: MessageTypeConfig) {
    this.selectedConfig = cfg;
    this.blockChecked = {};
    this.dependencyWarnings = [];
    this.generatedMessages = [];
    this.view = 'config';
    this.expandedIndex = null;

    // Pre-check mandatory blocks
    cfg.blocks.forEach(b => {
      this.blockChecked[b.id] = b.mandatory;
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
      this.dependencyWarnings.length === 0
    );
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  generate() {
    if (!this.canGenerate || !this.selectedConfig) return;

    this.isGenerating = true;
    this.generatedMessages = [];

    const payload = {
      message_type: this.selectedConfig.id,
      count: this.messageCount,
      selected_blocks: this.selectedBlocks
    };

    this.http.post<any>(this.config.getApiUrl('/bulk-generate'), payload).subscribe({
      next: (res) => {
        this.generatedMessages = res.messages || [];
        this.isGenerating = false;
        this.view = 'results';
        this.expandedIndex = null;
        this.snackBar.open(
          `Generated ${res.count} ${this.selectedConfig!.label} messages successfully.`,
          'Close',
          { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom' }
        );
      },
      error: (err) => {
        this.isGenerating = false;
        const detail = err?.error?.detail || err?.message || 'Generation failed.';
        this.snackBar.open(`Error: ${detail}`, 'Close', {
          duration: 5000,
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
