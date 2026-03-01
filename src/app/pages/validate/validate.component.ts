import { Component, OnInit, HostListener, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';

export interface FileEntry {
  id: string;
  name: string;
  size: number;
  sizeLabel: string;
  content: string;
  status: 'pending' | 'validating' | 'passed' | 'failed' | 'warnings';
  report: any;
  messageType: string;
}

@Component({
  selector: 'app-validate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './validate.component.html',
  styleUrls: ['./validate.component.css']
})
export class ValidateComponent implements OnInit {

  // ── File list ──────────────────────────────────────────────────────────────
  files: FileEntry[] = [];
  selectedFile: FileEntry | null = null;
  showReplaceModal = false;
  pendingFilesToAdd: File[] = [];

  // ── Drag state ─────────────────────────────────────────────────────────────
  isDragging = false;

  // ── UI State ─────────────────────────────────────────────────────────────
  searchQuery = '';
  filterStatus: 'All' | 'Passed' | 'Failed' | 'Warnings' = 'All';
  expandedFile: FileEntry | null = null;

  // ── Global options ─────────────────────────────────────────────────────────
  validationMode = 'Full 1-3';
  messageControl = new FormControl('Auto-detect');
  filteredOptions: Observable<string[]> | undefined;
  allMessageTypes: string[] = ['Auto-detect'];
  private standardMXTypes: string[] = [
    'Auto-detect',
    'pacs.008.001.08 (Credit Transfer)',
    'pacs.009.001.08 (FI Credit Transfer)',
    'pacs.002.001.10 (Payment Status)',
    'pacs.004.001.09 (Return)',
    'camt.053.001.08 (Statement)',
    'camt.052.001.08 (Report)',
    'camt.054.001.08 (Notification)',
    'camt.029.001.09 (Investigation)',
    'pain.001.001.09 (Initiation)',
    'pain.002.001.10 (Status Report)',
    'pain.008.001.08 (Direct Debit)',
    'head.001.001.02 (AppHdr)',
  ];

  // ── Selected issue (detail view) ───────────────────────────────────────────
  expandedIssue: any = null;

  // ── Summary computed from all files ────────────────────────────────────────
  get summary() {
    const done = this.files.filter(f => f.status !== 'pending' && f.status !== 'validating');
    return {
      passed: done.filter(f => f.status === 'passed' || f.status === 'warnings').length,
      failed: done.filter(f => f.status === 'failed').length,
      warnings: done.filter(f => f.status === 'warnings').length,
    };
  }

  get filteredFiles() {
    return this.files.filter(f => {
      if (this.filterStatus !== 'All') {
        if (this.filterStatus === 'Passed' && (f.status !== 'passed' && f.status !== 'warnings')) return false;
        if (this.filterStatus === 'Failed' && f.status !== 'failed') return false;
        if (this.filterStatus === 'Warnings' && f.status !== 'warnings') return false;
      }
      if (this.searchQuery && !f.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  get overallPassRate() {
    if (this.files.length === 0) return 0;
    const validated = this.files.filter(f => f.status !== 'pending' && f.status !== 'validating');
    if (validated.length === 0) return 0;
    const passed = validated.filter(f => f.status === 'passed' || f.status === 'warnings').length;
    return Math.round((passed / validated.length) * 100);
  }

  getFilePassRate(f: FileEntry) {
    if (f.status === 'passed' || f.status === 'warnings') return 100;
    if (f.status === 'pending' || f.status === 'validating' || !f.report) return 0;

    let expectedLayers = this.validationMode === 'Layer 1 only' ? 1 :
      this.validationMode === 'Layer 1-2' ? 2 : 3;

    let passedLayers = 0;
    if (f.report.layer_status) {
      Object.keys(f.report.layer_status).forEach(k => {
        if (f.report.layer_status[k].status.includes('✅') || f.report.layer_status[k].status.includes('⚠') || f.report.layer_status[k].status.includes('WARN')) {
          passedLayers++;
        }
      });
    }

    // Ensure we don't divide by 0 and max is 100%
    if (expectedLayers === 0) return 0;
    return Math.min(100, Math.round((passedLayers / expectedLayers) * 100));
  }

  toggleFileRow(f: FileEntry) {
    this.expandedFile = this.expandedFile === f ? null : f;
  }

  expandedLayers: { [key: string]: boolean } = {};

  toggleLayer(f: FileEntry, layerName: string) {
    const key = f.id + '_' + layerName;
    this.expandedLayers[key] = !this.isLayerExpanded(f, layerName);
  }

  isLayerExpanded(f: FileEntry, layerName: string): boolean {
    const key = f.id + '_' + layerName;
    return !!this.expandedLayers[key];
  }

  setFilter(status: 'All' | 'Passed' | 'Failed' | 'Warnings') {
    this.filterStatus = status;
  }

  downloadReport() {
    if (this.files.length === 0) return;

    let csv = "File Name,Status,Pass %,Total Errors,Total Warnings,Layer,Severity,Issue Path,Message\n";

    this.files.forEach(f => {
      const name = `"${f.name.replace(/"/g, '""')}"`;
      const status = f.status.toUpperCase();
      const passRate = `${this.getFilePassRate(f)}%`;
      const errs = f.report?.errors || 0;
      const warns = f.report?.warnings || 0;

      const baseRow = `${name},${status},${passRate},${errs},${warns}`;

      if (f.report && f.report.details && f.report.details.length > 0) {
        f.report.details.forEach((issue: any) => {
          const layer = `"${(issue.layer || '').toString().replace(/"/g, '""')}"`;
          const severity = `"${(issue.severity || '').toString().replace(/"/g, '""')}"`;
          const issuePath = `"${(issue.path || 'Root').toString().replace(/"/g, '""')}"`;
          const msg = `"${(issue.message || '').toString().replace(/"/g, '""')}"`;
          csv += `${baseRow},${layer},${severity},${issuePath},${msg}\n`;
        });
      } else {
        csv += `${baseRow},,,,\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "iso20022_validation_report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getGroupedIssues(report: any) {
    if (!report?.details) return [];
    const layers = [...new Set(report.details.map((x: any) => x.layer))].sort();
    return layers.map(l => {
      const issues = report.details.filter((x: any) => x.layer === l);
      return {
        layer: l,
        name: this.getLayerName(String(l)),
        issues: issues,
        errors: issues.filter((x: any) => x.severity === 'ERROR').length,
        warnings: issues.filter((x: any) => x.severity === 'WARNING').length
      };
    });
  }

  get filesToDisplay(): FileEntry[] {
    return this.selectedFile ? [this.selectedFile] : this.files;
  }

  selectAllFiles() {
    this.selectedFile = null;
    this.expandedFile = null;
  }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private config: ConfigService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.allMessageTypes = [...this.standardMXTypes];

    this.http.get<string[]>(this.config.getApiUrl('/messages')).subscribe({
      next: (data) => {
        const combined = [...new Set([...this.standardMXTypes, ...data])].sort();
        this.allMessageTypes = ['Auto-detect', ...combined.filter(x => x !== 'Auto-detect')];
        this.messageControl.updateValueAndValidity();
      },
      error: () => { }
    });

    this.filteredOptions = this.messageControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
  }

  private _filter(value: string): string[] {
    const v = value.toLowerCase();
    if (!v || v === 'auto-detect') return this.standardMXTypes.slice(0, 8);
    return this.allMessageTypes.filter(o => o.toLowerCase().includes(v));
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  @HostListener('dragover', ['$event']) onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging = true;
  }
  @HostListener('dragleave', ['$event']) onDragLeave(e: DragEvent) {
    this.isDragging = false;
  }
  @HostListener('drop', ['$event']) async onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    const files = Array.from(e.dataTransfer?.files ?? []) as File[];
    await this.loadFiles(files);
  }

  async onFileSelected(event: any) {
    const files = Array.from(event.target.files ?? []) as File[];
    await this.loadFiles(files);
    event.target.value = '';
  }

  private async loadFiles(files: File[]) {
    if (this.files.length + files.length > 100) {
      this.snackBar.open(`Maximum 100 files allowed. You tried to add ${files.length} to ${this.files.length} existing.`, 'Dismiss', { duration: 5000 });
      files = files.slice(0, 100 - this.files.length);
      if (files.length === 0) return;
    }

    const allowed = ['.xml', '.xsd', '.txt'];
    const validFiles = files.filter(file => {
      const isAllowed = allowed.some(ext => file.name.toLowerCase().endsWith(ext));
      if (!isAllowed) this.snackBar.open(`${file.name}: Invalid type. XML/XSD/TXT only.`, 'Dismiss', { duration: 3000 });

      const isSizeOk = file.size <= 1024 * 1024 * 3;
      if (!isSizeOk) this.snackBar.open(`${file.name}: File too large (max 3 MB).`, 'Dismiss', { duration: 5000 });

      return isAllowed && isSizeOk;
    });

    if (validFiles.length === 0) return;

    if (this.files.length > 0) {
      this.pendingFilesToAdd = validFiles;
      this.showReplaceModal = true;
      return;
    }

    await this.processValidFiles(validFiles, false);
  }

  async confirmReplace(replace: boolean) {
    this.showReplaceModal = false;
    const files = this.pendingFilesToAdd;
    this.pendingFilesToAdd = [];
    if (files.length > 0) {
      await this.processValidFiles(files, replace);
    }
  }

  private async processValidFiles(validFiles: File[], replace: boolean) {
    if (this.files.length > 0) {
      if (replace) {
        this.clearAll();
      } else {
        this.files.forEach(f => {
          f.status = 'pending';
          f.report = null;
        });
      }
    }

    try {
      const newEntries: FileEntry[] = await Promise.all(
        validFiles.map(async (file) => {
          const content = await file.text();
          return {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            sizeLabel: this.formatSize(file.size),
            content: content,
            status: 'pending',
            report: null,
            messageType: '',
          } as FileEntry;
        })
      );

      this.files = [...this.files, ...newEntries];
      if (this.files.length === 1) {
        this.selectedFile = this.files[0];
      } else {
        this.selectedFile = null;
      }
      // Ensure UI updates immediately after all files are parsed
      this.cdr.detectChanges();

      this.snackBar.open(`${validFiles.length} file(s) uploaded successfully!`, 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } catch (e) {
      console.error(e);
      this.snackBar.open(`Error reading files`, 'Dismiss', { duration: 3000 });
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  selectFile(f: FileEntry) {
    this.selectedFile = f;
    this.expandedIssue = null;
  }

  removeFile(f: FileEntry, e: MouseEvent) {
    e.stopPropagation();
    const idx = this.files.indexOf(f);
    this.files.splice(idx, 1);
    if (this.selectedFile === f) {
      this.selectedFile = this.files[idx] ?? this.files[idx - 1] ?? null;
    }
  }

  clearAll() {
    this.files = [];
    this.selectedFile = null;
    this.expandedIssue = null;
  }

  validateAll() {
    for (const f of this.files) {
      this.validateFile(f);
    }
  }

  validateFile(entry: FileEntry) {
    if (!entry.content?.trim()) return;

    // Client-side well-formedness pre-check
    const parser = new DOMParser();
    const doc = parser.parseFromString(entry.content, 'text/xml');
    if (doc.querySelector('parsererror')) {
      this.snackBar.open(`${entry.name}: Malformed XML`, 'Dismiss', { duration: 3000 });
      entry.status = 'failed';
      entry.report = {
        status: 'FAIL', errors: 1, warnings: 0,
        message: 'Unknown', total_time_ms: 0,
        layer_status: { '1': { status: '❌', time: 0 } },
        details: [{
          severity: 'ERROR', layer: 1, code: 'XML_SYNTAX', path: '1',
          message: 'Malformed XML — invalid structure or unclosed tags.',
          fix_suggestion: 'Check all tags are properly opened and closed.'
        }]
      };
      return;
    }

    entry.status = 'validating';
    entry.report = null;

    const rawType = (this.messageControl.value || 'Auto-detect').split(' ')[0];
    const cleanType = rawType === 'Auto-detect' ? 'Auto-detect' : rawType;

    this.http.post(this.config.getApiUrl('/validate'), {
      xml_content: entry.content,
      mode: this.validationMode,
      message_type: cleanType,
      store_in_history: true
    }).subscribe({
      next: (data: any) => {
        entry.report = data;
        entry.messageType = data.message ?? '';
        if (data.status === 'PASS') {
          entry.status = data.warnings > 0 ? 'warnings' : 'passed';
        } else {
          entry.status = 'failed';
        }
        if (!this.selectedFile || this.selectedFile === entry) {
          this.selectedFile = entry;
        }
      },
      error: () => {
        entry.status = 'failed';
        this.snackBar.open(`${entry.name}: Validation failed (backend error)`, 'Dismiss', { duration: 3000 });
      }
    });
  }

  // ── Report helpers ─────────────────────────────────────────────────────────
  getReportLayers(report: any): string[] {
    if (!report?.layer_status) return [];
    return Object.keys(report.layer_status).sort();
  }

  getLayerName(k: string): string {
    const names: Record<string, string> = {
      '1': 'Syntax & Format',
      '2': 'Schema Validation',
      '3': 'Business Rules'
    };
    return names[k] ?? `Layer ${k}`;
  }

  getLayerStatus(report: any, k: string): string {
    return report?.layer_status?.[k]?.status ?? '';
  }

  getLayerTime(report: any, k: string): number {
    return report?.layer_status?.[k]?.time ?? 0;
  }

  isLayerPass(report: any, k: string) { return this.getLayerStatus(report, k).includes('✅'); }
  isLayerFail(report: any, k: string) { return this.getLayerStatus(report, k).includes('❌'); }
  isLayerWarn(report: any, k: string) {
    const s = this.getLayerStatus(report, k);
    return s.includes('⚠') || s.includes('WARNING') || s.includes('WARN');
  }

  getIssues(report: any): any[] { return report?.details ?? []; }
  getErrors(report: any): any[] { return this.getIssues(report).filter(i => i.severity === 'ERROR'); }
  getWarnings(report: any): any[] { return this.getIssues(report).filter(i => i.severity === 'WARNING'); }

  toggleIssue(issue: any) {
    this.expandedIssue = this.expandedIssue === issue ? null : issue;
  }

  copyFix(text: string, e: MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Copied!', '', { duration: 1500 });
    });
  }

  getStatusLabel(f: FileEntry): string {
    switch (f.status) {
      case 'passed': return 'PASSED';
      case 'failed': return 'FAILED';
      case 'warnings': return 'WARNINGS';
      case 'validating': return 'VALIDATING…';
      default: return 'PENDING';
    }
  }

  getMessageFamily(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.startsWith('pacs')) return 'pacs';
    if (t.startsWith('camt')) return 'camt';
    if (t.startsWith('pain')) return 'pain';
    if (t.startsWith('sese')) return 'sese';
    if (t.startsWith('head')) return 'head';
    return 'other';
  }
}
