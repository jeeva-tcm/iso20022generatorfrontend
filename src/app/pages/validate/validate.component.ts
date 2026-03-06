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
import { ActivatedRoute, Router } from '@angular/router';
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
  handle?: any;
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

  // ── Paste XML state ─────────────────────────────────────────────────────────
  showPasteModal = false;
  pastedXmlContent = '';
  pendingPastedXml = '';

  // ── UI State ─────────────────────────────────────────────────────────────
  searchQuery = '';
  filterStatus: 'All' | 'Passed' | 'Failed' = 'All';
  expandedFile: FileEntry | null = null;

  // ── Pagination State ───────────────────────────────────────────────────────
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];

  // ── XML Editor state ─────────────────────────────────────────────────────────────
  editingEntry: FileEntry | null = null;
  originalContent: string = '';
  editorLineCount: number[] = [1];

  // ── Global options ─────────────────────────────────────────────────────────
  validationMode = 'Full 1-3';
  messageControl = new FormControl('Auto-detect');
  filteredOptions: Observable<string[]> | undefined;
  allMessageTypes: string[] = ['Auto-detect'];
  private standardMXTypes: string[] = [
    'pacs.008.001.08',
    'pacs.009.001.08',
    'pacs.002.001.10',
    'pain.001.001.09',
    'camt.053.001.08',
  ];

  // ── Selected issue (detail view) ───────────────────────────────────────────
  expandedIssue: any = null;

  // ── Summary computed from all files ────────────────────────────────────────
  get summary() {
    const done = this.files.filter(f => f.status !== 'pending' && f.status !== 'validating');
    return {
      passed: done.filter(f => f.status === 'passed' || f.status === 'warnings').length,
      failed: done.filter(f => f.status === 'failed').length,
    };
  }

  get filteredFiles() {
    return this.files.filter(f => {
      if (this.filterStatus !== 'All') {
        if (this.filterStatus === 'Passed' && (f.status !== 'passed' && f.status !== 'warnings')) return false;
        if (this.filterStatus === 'Failed' && f.status !== 'failed') return false;
      }
      if (this.searchQuery && !f.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  get paginatedFiles() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredFiles.slice(startIndex, startIndex + Number(this.pageSize));
  }

  get totalPages() {
    return Math.ceil(this.filteredFiles.length / this.pageSize);
  }

  changePage(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.currentPage = newPage;
      this.expandedFile = null;
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.expandedFile = null;
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

  setFilter(status: 'All' | 'Passed' | 'Failed') {
    this.filterStatus = status;
    this.currentPage = 1; // Reset to page 1 on filter change
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

  downloadFileReport(f: FileEntry, e: MouseEvent) {
    if (e) e.stopPropagation();
    if (!f.report) {
      this.snackBar.open('Run validation to see details.', 'Dismiss', { duration: 3000 });
      return;
    }
    let csv = "File Name,Status,Pass %,Total Errors,Total Warnings,Layer,Severity,Issue Path,Message\n";
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

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `iso20022_report_${f.name}.csv`);
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
    private router: Router,
    private snackBar: MatSnackBar,
    private config: ConfigService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.allMessageTypes = [...this.standardMXTypes];
    await this.restoreWorkspace(); // Restore previous work before handling query params

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

    // Handle History Re-run
    this.route.queryParams.subscribe(params => {
      const reportId = params['reportId'];
      const autoRun = params['autoRun'] === 'true';
      if (reportId) {
        this.loadValidationFromHistory(reportId, autoRun);
      }
    });

    // Handle XML pushed via state (from Manual Entry builders)
    const state = history.state;
    if (state && state.autoValidateXml) {
      this.addXmlFromState(state.autoValidateXml, state.fileName, state.messageType);

      // Clear state so refreshing the page doesn't re-add the file
      window.history.replaceState({}, document.title);
    }
  }

  private addXmlFromState(xml: string, fileName: string, messageType: string) {
    const entry: FileEntry = {
      id: 'f' + Date.now(),
      name: fileName || `generated-${Date.now()}.xml`,
      size: new Blob([xml]).size,
      sizeLabel: this.formatSize(new Blob([xml]).size),
      content: xml,
      status: 'pending',
      report: null,
      messageType: messageType || 'Auto-detect',
      handle: null
    };

    // Check if it already exists to avoid dupes purely from reload
    const existing = this.files.find(f => f.content === xml);
    if (!existing) {
      this.files.unshift(entry);
      this.saveWorkspace();
      this.selectedFile = entry;
      this.validateFile(entry);
    } else {
      this.selectedFile = existing;
      if (existing.status === 'pending') {
        this.validateFile(existing);
      }
    }
  }

  private _filter(value: string): string[] {
    const v = value.toLowerCase();
    if (!v || v === 'auto-detect') return this.standardMXTypes.slice(0, 8);
    return this.allMessageTypes.filter(o => o.toLowerCase().includes(v));
  }

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  @HostListener('dragover', ['$event']) onDragOver(e: DragEvent) {
    e.preventDefault();
    if (this.editingEntry) return;
    this.isDragging = true;
  }
  @HostListener('dragleave', ['$event']) onDragLeave(e: DragEvent) {
    this.isDragging = false;
  }
  @HostListener('drop', ['$event']) async onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    if (this.editingEntry) return;
    const validFiles: File[] = [];
    if (e.dataTransfer && e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const handle = await (item as any).getAsFileSystemHandle?.();
          const file = item.getAsFile();
          if (file) {
            if (handle) (file as any).fileHandle = handle;
            validFiles.push(file);
          }
        }
      }
    } else if (e.dataTransfer?.files) {
      validFiles.push(...Array.from(e.dataTransfer.files));
    }
    await this.loadFiles(validFiles);
  }

  async triggerFilePicker() {
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [{
            description: 'XML Files',
            accept: { 'text/xml': ['.xml', '.xsd', '.txt'] }
          }]
        });
        const validFiles: File[] = [];
        for (const h of handles) {
          const file = await h.getFile();
          (file as any).fileHandle = h;
          validFiles.push(file);
        }
        await this.loadFiles(validFiles);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          this.fileInput?.nativeElement.click(); // Fallback
        }
      }
    } else {
      this.fileInput?.nativeElement.click();
    }
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

    // Handle pending file uploads
    const files = this.pendingFilesToAdd;
    this.pendingFilesToAdd = [];
    if (files.length > 0) {
      await this.processValidFiles(files, replace);
    }

    // Handle pending pasted XML
    const pastedXml = this.pendingPastedXml;
    this.pendingPastedXml = '';
    if (pastedXml) {
      if (replace) {
        this.clearAll();
      }
      this.addPastedEntry(pastedXml);
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
            handle: (file as any).fileHandle
          } as FileEntry;
        })
      );

      this.files = [...this.files, ...newEntries];
      if (this.files.length === 1) {
        this.selectedFile = this.files[0];
      } else {
        this.selectedFile = null;
      }
      this.saveWorkspace(); // PERSIST
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

  // ── Paste XML ───────────────────────────────────────────────────────────────
  validatePastedXml() {
    const xml = this.pastedXmlContent?.trim();
    if (!xml) {
      this.snackBar.open('Please paste XML content first.', 'Dismiss', { duration: 3000 });
      return;
    }
    this.showPasteModal = false;

    // If files already exist, show the Replace/Keep Both popup
    if (this.files.length > 0) {
      this.pendingPastedXml = xml;
      this.pastedXmlContent = '';
      this.showReplaceModal = true;
      return;
    }

    // No existing files — add directly
    this.pastedXmlContent = '';
    this.addPastedEntry(xml);
  }

  private addPastedEntry(xml: string) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const entry: FileEntry = {
      id: crypto.randomUUID(),
      name: `pasted-${ts}.xml`,
      size: new Blob([xml]).size,
      sizeLabel: this.formatSize(new Blob([xml]).size),
      content: xml,
      status: 'pending',
      report: null,
      messageType: '',
    };
    this.files = [...this.files, entry];
    this.selectedFile = entry;
    this.cdr.detectChanges();
    this.validateFile(entry);
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
    this.saveWorkspace(); // PERSIST
  }

  clearAll() {
    this.files = [];
    this.selectedFile = null;
    this.expandedIssue = null;
    this.editingEntry = null;
    this.saveWorkspace(); // PERSIST (Clear storage)
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  openEditor(f: FileEntry, e: MouseEvent) {
    e.stopPropagation();
    this.editingEntry = f;
    this.originalContent = f.content;
    this.updateEditorLines(f.content);
  }

  closeEditor() {
    if (this.editingEntry) {
      this.editingEntry.content = this.originalContent;
    }
    this.editingEntry = null;
  }

  onEditorChange(content: string) {
    this.updateEditorLines(content);
  }

  updateEditorLines(content: string) {
    const lines = (content || '').split('\n').length;
    if (this.editorLineCount.length !== lines) {
      this.editorLineCount = new Array(lines);
    }
  }

  syncScroll(textarea: HTMLTextAreaElement, lineNumbers: HTMLDivElement) {
    lineNumbers.scrollTop = textarea.scrollTop;
  }

  handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveEditor();
    }
  }

  async saveEditor() {
    if (!this.editingEntry) return;
    const entry = this.editingEntry;

    // Strategy 1: Use existing FileSystemHandle (Overwrites original file)
    if (entry.handle) {
      try {
        // Request explicit read-write permission (browser will prompt the user once)
        const perm = await entry.handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const newPerm = await entry.handle.requestPermission({ mode: 'readwrite' });
          if (newPerm !== 'granted') {
            throw new Error('Local write permission denied');
          }
        }

        const writable = await entry.handle.createWritable();
        await writable.write(entry.content);
        await writable.close();

        this.snackBar.open('Saved changes directly to original file!', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      } catch (err: any) {
        console.error('Direct save failed:', err);
        // If direct write failed (e.g. read-only file), we fall through to "Save As" fallback
        this.snackBar.open('Direct save failed. Please select where to save.', 'Dismiss', { duration: 3000 });
        await this.handleSaveAs(entry);
      }
    }
    // Strategy 2: Missing handle (File was drag-dropped or uploaded via standard input)
    else if ('showSaveFilePicker' in window) {
      await this.handleSaveAs(entry);
    }
    // Fallback: Legacy browser support
    else {
      this.snackBar.open('Changes updated in memory. Local file saving not supported in this browser.', 'Close', { duration: 4000 });
    }

    this.originalContent = entry.content;
    this.editingEntry = null;
    this.saveWorkspace(); // PERSIST
    this.validateFile(entry);
  }

  /**
   * Triggers a "Save As" dialog to let the user pick/overwrite their local file.
   * On success, we capture the new handle so future saves are direct/seamless.
   */
  private async handleSaveAs(entry: FileEntry) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: entry.name,
        types: [{
          description: 'XML File',
          accept: { 'text/xml': ['.xml'] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(entry.content);
      await writable.close();

      // Upgrade this entry with the new handle so next "Save" is seamless
      entry.handle = handle;

      this.snackBar.open('File linked and saved successfully!', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } catch (err) {
      console.warn('Save As cancelled or failed');
      this.snackBar.open('Changes updated in memory only.', 'Close', { duration: 3000 });
    }
  }

  validateAll() {
    this.http.get<any>(this.config.getApiUrl('/generate-id')).subscribe({
      next: (data) => {
        const batchId = data.id;
        for (const f of this.files) {
          this.validateFile(f, batchId);
        }
      },
      error: () => {
        // Fallback: use first file's validation without batch grouping
        for (const f of this.files) {
          this.validateFile(f);
        }
      }
    });
  }

  validateFile(entry: FileEntry, batchId?: string) {
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
      store_in_history: true,
      batch_id: batchId
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

  // ── Persistence ────────────────────────────────────────────────────────────
  private readonly DB_NAME = 'ISO_WORKSPACE_DB';
  private readonly STORE_NAME = 'workspace_files';

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveWorkspace() {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);

      // Clear existing first
      store.clear();

      // Add all current files
      for (const f of this.files) {
        // We strip large binary data if needed, but here we store content.
        // Handles CAN be stored in IDB.
        store.put({ ...f, status: f.status === 'validating' ? 'pending' : f.status });
      }
    } catch (e) {
      console.warn('Failed to persist workspace:', e);
    }
  }

  private async restoreWorkspace(): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          if (request.result && request.result.length > 0) {
            this.files = request.result.map((f: any) => ({
              ...f,
              status: f.status === 'validating' ? 'pending' : f.status
            }));
            this.cdr.detectChanges();
          }
          resolve();
        };
        request.onerror = () => resolve();
      } catch (e) {
        console.warn('Failed to restore workspace:', e);
        resolve();
      }
    });
  }

  private loadValidationFromHistory(reportId: string, autoRun: boolean) {
    this.http.get<any>(this.config.getApiUrl(`/history/${reportId}`)).subscribe({
      next: (data) => {
        if (data && data.original_message) {
          const fileName = `re_run_${reportId.substring(0, 8)}.xml`;

          // Check if file already exists in workspace
          const existing = this.files.find(f => f.content === data.original_message);
          if (existing) {
            this.selectedFile = existing;
            if (autoRun) {
              this.validateFile(existing);
            }
            this.cdr.detectChanges();
            return;
          }

          const entry: FileEntry = {
            id: 'f' + Date.now(),
            name: fileName,
            size: data.original_message.length,
            sizeLabel: (data.original_message.length / 1024).toFixed(1) + ' KB',
            content: data.original_message,
            status: 'pending',
            report: null,
            messageType: data.report?.message || 'Auto-detect',
            handle: null
          };

          this.files.unshift(entry); // Add to top
          this.saveWorkspace();
          this.selectedFile = entry;

          if (autoRun) {
            this.validateFile(entry);
          }
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.snackBar.open('Failed to load validation from history.', 'Close', { duration: 3000 });
      }
    });
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
