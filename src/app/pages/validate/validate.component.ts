import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocomplete, MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-validate',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatCheckboxModule,
        MatRadioModule,
        MatIconModule,
        MatProgressBarModule,
        MatChipsModule,
        MatDividerModule,
        MatAutocompleteModule,
        MatSnackBarModule,
        MatTooltipModule
    ],
    templateUrl: './validate.component.html',
    styleUrls: ['./validate.component.css']
})
export class ValidateComponent implements OnInit {
    @ViewChild('auto') autocomplete!: MatAutocomplete;

    xmlContent: string = '';
    validationMode: string = 'Full 1-3';
    messageType: string = 'Auto-detect';
    storeHistory: boolean = true;
    isLoading: boolean = false;
    report: any = null;
    selectedIssue: any = null;
    lineNumbers: number[] = [1];
    highlightTop: number = 0;
    showHighlight: boolean = false;

    messageControl = new FormControl('');
    filteredOptions: Observable<string[]> | undefined;

    allMessageTypes: string[] = ['Auto-detect'];
    private standardMXTypes: string[] = [
        'pacs.008.001.08 (Local/Cross-Border Credit Transfer)',
        'pacs.009.001.08 (FI Credit Transfer)',
        'pacs.002.001.10 (Payment Status Report)',
        'pacs.004.001.09 (Return)',
        'camt.053.001.08 (Statement)',
        'camt.052.001.08 (Report)',
        'camt.054.001.08 (Notification)',
        'camt.029.001.09 (Investigation)',
        'pain.001.001.09 (Initiation)',
        'pain.002.001.10 (Status Report)',
        'pain.008.001.08 (Direct Debit)',
        'head.001.001.02 (AppHdr)'
    ];

    popularMessages: string[] = [
        'pacs.008.001.08 (Local/Cross-Border Credit Transfer)',
        'camt.053.001.08 (Statement)',
        'pain.001.001.09 (Initiation)'
    ];

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private config: ConfigService
    ) {
        // Initialize with standard types immediately
        this.allMessageTypes = ['Auto-detect', ...this.standardMXTypes];
    }



    ngOnInit() {
        // 1. Check for reportId in query params (passed from History page)
        this.route.queryParams.subscribe(params => {
            const reportId = params['reportId'];
            if (reportId) {
                this.loadHistoricalReport(reportId);
            }
        });

        // 2. Fetch dynamic message list from backend and merge with standard ones
        this.http.get<string[]>(this.config.getApiUrl('/messages')).subscribe({
            next: (data) => {
                // Merge, filter out duplicates, and keep Auto-detect at top
                const combined = [...new Set([...this.standardMXTypes, ...data])].sort();
                this.allMessageTypes = ['Auto-detect', ...combined];
                // Re-trigger filter
                this.messageControl.updateValueAndValidity();
            },
            error: (err) => {
                console.warn('Could not fetch message types, using standard list', err);
            }
        });

        this.filteredOptions = this.messageControl.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '')),
        );

        // Sync local model with control
        this.messageControl.valueChanges.subscribe(val => {
            if (val) {
                this.messageType = val.split(' ')[0];
            } else {
                this.messageType = 'Auto-detect';
            }
        });
    }

    loadHistoricalReport(id: string) {
        this.isLoading = true;
        this.http.get<any>(this.config.getApiUrl(`/history/${id}`)).subscribe({
            next: (data) => {
                this.report = data.report;
                this.xmlContent = data.original_message;
                this.updateLineNumbers();
                this.isLoading = false;
                this.scrollToResults();
            },
            error: (err) => {
                console.error("Failed to load historical report:", err);
                this.isLoading = false;
            }
        });
    }

    getMessageFamily(option: string): any {
        const family = option.split('.')[0].toLowerCase();
        if (option === 'Auto-detect') return { icon: 'auto_awesome', color: '#6366f1' };
        if (family === 'pacs') return { icon: 'account_balance', color: '#10b981' };
        if (family === 'camt') return { icon: 'analytics', color: '#f59e0b' };
        if (family === 'pain') return { icon: 'payments', color: '#ef4444' };
        if (family === 'head') return { icon: 'info', color: '#64748b' };
        return { icon: 'insert_drive_file', color: '#94a3b8' };
    }

    private _filter(value: string): string[] {
        const filterValue = value.toLowerCase();

        // Search Engine Style:
        // 1. If empty, show simplified "Popular/Recent" list
        if (!filterValue) {
            return ['Auto-detect', ...this.popularMessages];
        }

        // 2. If typing, show matching results from ALL types (flat list)
        return this.allMessageTypes.filter(option =>
            option.toLowerCase().includes(filterValue)
        );
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            const allowedExtensions = ['.xml', '.xsd', '.txt'];
            const fileName = file.name.toLowerCase();
            const isValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

            // Validate file type
            if (!isValidExtension) {
                this.snackBar.open('Invalid file type. Please upload an XML, XSD, or TXT file.', 'Close', {
                    duration: 4000,
                    panelClass: ['warning-snackbar']
                });
                // Clear the file input
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.xmlContent = e.target.result;
                this.updateLineNumbers();
            };
            reader.readAsText(file);
        }
    }

    updateLineNumbers() {
        const lines = this.xmlContent.split('\n').length;
        this.lineNumbers = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
    }

    handleTabKey(event: KeyboardEvent) {
        if (event.key === 'Tab') {
            event.preventDefault();

            const textarea = event.target as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // Insert tab character at cursor position
            const tab = '\t';
            this.xmlContent = this.xmlContent.substring(0, start) + tab + this.xmlContent.substring(end);

            // Update line numbers
            this.updateLineNumbers();

            // Move cursor after the tab
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 1;
            }, 0);
        }
    }

    onTextareaScroll(event: any) {
        const gutter = document.getElementById('line-gutter');
        if (gutter) {
            gutter.scrollTop = event.target.scrollTop;
        }
    }

    formatXML() {
        if (!this.xmlContent || !this.xmlContent.trim()) return;

        try {
            // Parse the XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(this.xmlContent, 'text/xml');

            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                this.snackBar.open('Invalid XML - cannot format', 'Close', { duration: 3000 });
                return;
            }

            // Format the XML using a recursive function
            const formatNode = (node: Node, indent: number = 0): string => {
                const indentStr = '  '.repeat(indent);

                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element;
                    const tagName = element.tagName;
                    const children = Array.from(element.childNodes);

                    // Check if element has only text content (leaf node)
                    const hasOnlyText = children.length === 1 && children[0].nodeType === Node.TEXT_NODE;
                    const textContent = element.textContent?.trim() || '';

                    // Build attributes string
                    let attrsStr = '';
                    if (element.attributes.length > 0) {
                        attrsStr = Array.from(element.attributes)
                            .map(attr => ` ${attr.name}="${attr.value}"`)
                            .join('');
                    }

                    // If leaf node with simple text, keep on one line
                    if (hasOnlyText && textContent) {
                        return `${indentStr}<${tagName}${attrsStr}>${textContent}</${tagName}>\n`;
                    }

                    // If empty element
                    if (children.length === 0 && !textContent) {
                        return `${indentStr}<${tagName}${attrsStr}/>\n`;
                    }

                    // If element has child elements, format with proper nesting
                    let result = `${indentStr}<${tagName}${attrsStr}>\n`;

                    children.forEach(child => {
                        if (child.nodeType === Node.ELEMENT_NODE) {
                            result += formatNode(child, indent + 1);
                        } else if (child.nodeType === Node.TEXT_NODE) {
                            const text = child.textContent?.trim();
                            if (text) {
                                result += `${indentStr}  ${text}\n`;
                            }
                        }
                    });

                    result += `${indentStr}</${tagName}>\n`;
                    return result;
                }

                return '';
            };

            // Start formatting from root
            let formatted = '';

            // Preserve XML declaration if it exists
            if (this.xmlContent.includes('<?xml')) {
                formatted = '<?xml version="1.0" encoding="UTF-8"?>\n';
            }

            // Format the document element
            if (xmlDoc.documentElement) {
                formatted += formatNode(xmlDoc.documentElement, 0);
            }

            this.xmlContent = formatted.trim();
            this.updateLineNumbers();
        } catch (e) {
            console.error('Formatting error:', e);
            this.snackBar.open('Error formatting XML', 'Close', { duration: 3000 });
        }
    }

    runValidation() {
        if (!this.xmlContent.trim()) return;

        this.isLoading = true;
        this.report = null;
        this.selectedIssue = null;

        // Use the control value if set, otherwise default
        const selectedType = this.messageControl.value || this.messageType;
        // Strip description for API if needed, or backend handles "Auto-detect"
        const cleanType = selectedType === 'Auto-detect' ? 'Auto-detect' : selectedType?.split(' ')[0];

        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.xmlContent,
            mode: this.validationMode,
            message_type: cleanType,
            store_in_history: this.storeHistory
        }).subscribe({
            next: (data: any) => {
                this.report = data;
                this.isLoading = false;
                this.snackBar.open('Validation Complete', 'Close', { duration: 3000 });
                this.scrollToResults();
            },

            error: (err) => {
                console.warn("Backend unavailable, switching to DEMO MODE", err);
                this.snackBar.open('Backend Unreachable. Running in Offline Demo Mode.', 'OK', {
                    duration: 5000,
                    panelClass: ['warning-snackbar']
                });
                this.runDemoValidation();
            }
        });
    }

    runDemoValidation() {
        // Simulate network delay
        setTimeout(() => {
            this.report = {
                validation_id: "VAL-DEMO-" + Math.floor(Math.random() * 10000),
                timestamp: new Date().toISOString(),
                status: "FAIL",
                mode: "Full 1-3",
                message: "pacs.008.001.08",
                errors: 3,
                warnings: 2,
                total_time_ms: 285,
                layer_status: {
                    1: { status: "✅", time: 6 },
                    2: { status: "✅", time: 43 },
                    3: { status: "❌", time: 120 }
                },
                details: [
                    {
                        severity: "ERROR",
                        layer: 3,
                        code: "E001",
                        path: "CdtrAgt.FinInstnId.PstlAdr.TwnNm",
                        message: "Town name mandatory for post-Nov 2026 messages",
                        fix_suggestion: "Add <TwnNm>London</TwnNm> to creditor agent address",
                        related_test: "REG-025"
                    },
                    {
                        severity: "ERROR",
                        layer: 2,
                        code: "REG-002",
                        path: "10",
                        message: "Malformed XML structure",
                        fix_suggestion: "Check closing tags",
                        related_test: "REG-002"
                    },
                    {
                        severity: "WARNING",
                        layer: 3,
                        code: "W005",
                        path: "PmtId.InstrId",
                        message: "Instruction ID is unusually long",
                        fix_suggestion: "Limit to 35 characters",
                        related_test: "UAT-103"
                    }
                ]
            };
            this.isLoading = false;
            this.scrollToResults();
            console.warn("⚠️ Backend not connected. Running in DEMO MODE with sample data.");
            // alert("⚠️ Backend not connected. Running in DEMO MODE with sample data.");
        }, 1500);
    }

    selectIssue(issue: any) {
        if (this.selectedIssue === issue) {
            this.selectedIssue = null;
        } else {
            this.selectedIssue = issue;
        }
    }

    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Dismiss', { duration: 2000 });
        }).catch(err => {
            console.error('Could not copy text: ', err);
            this.snackBar.open('Failed to copy text', 'Close', { duration: 3000 });
        });
    }

    getLineNumber(path: string): string {
        const match = String(path).match(/\d+/);
        return match ? match[0] : path;
    }

    scrollToLine(lineInfo: any) {
        // Extract first sequence of digits from the string (e.g. "Line 5" -> 5)
        const match = String(lineInfo).match(/\d+/);
        const lineNum = match ? parseInt(match[0], 10) : NaN;

        if (isNaN(lineNum)) return;

        const textarea = document.querySelector('.xml-editor') as HTMLTextAreaElement;

        if (textarea) {
            // Calculate character position for selection
            const lines = this.xmlContent.split('\n');
            if (lineNum >= 1 && lineNum <= lines.length) {
                let startChar = 0;
                for (let i = 0; i < lineNum - 1; i++) {
                    startChar += lines[i].length + 1; // +1 for \n
                }
                const endChar = startChar + lines[lineNum - 1].length;

                // Focus and select the line
                textarea.focus();
                textarea.setSelectionRange(startChar, endChar);
            } else {
                textarea.focus();
            }

            const lineHeight = 24;
            const paddingTop = 20;
            const scrollPos = (lineNum - 1) * lineHeight;

            // 1. Scroll the entire PAGE and center the editor card on screen
            const card = document.getElementById('editor-card');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // 2. Center the line inside the editor: Editor is 500px high, so 250px is middle.
            const targetScroll = Math.max(0, scrollPos - 220);

            // Use immediate scroll first to prevent fighting with focus(), then smooth correction
            textarea.scrollTop = targetScroll;

            // 3. Trigger Highlight Bar
            this.showHighlight = true;

            // Continuous sync for smooth animations
            const updateHighlight = () => {
                this.highlightTop = paddingTop + (lineNum - 1) * lineHeight - textarea.scrollTop;
            };

            const syncTimer = setInterval(updateHighlight, 10);

            setTimeout(() => {
                clearInterval(syncTimer);
                setTimeout(() => {
                    this.showHighlight = false;
                }, 3000);
            }, 2000);
        }
    }


    getReportLayers(): string[] {
        if (!this.report?.layer_status) return [];
        return Object.keys(this.report.layer_status).sort().slice(0, 3);
    }

    getLayerIcon(layer: any) {
        const status = this.report?.layer_status[layer]?.status;
        return status === '✅' ? 'check_circle' : (status === '❌' ? 'cancel' : 'skip_next');
    }

    getLayerColor(layer: any) {
        const status = this.report?.layer_status[layer]?.status;
        return status === '✅' ? 'text-green-600' : (status === '❌' ? 'text-red-500' : 'text-gray-400');
    }

    private scrollToResults() {
        // Wait for *ngIf="report" render
        setTimeout(() => {
            const element = document.getElementById('results-section');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }

    clearAll() {
        this.xmlContent = '';
        this.report = null;
        this.selectedIssue = null;
    }
}
