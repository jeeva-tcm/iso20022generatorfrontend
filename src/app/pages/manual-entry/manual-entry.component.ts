import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfigService } from '../../services/config.service';

interface SchemaNode {
    name: string;
    label: string;
    type: string;
    mandatory: boolean;
    repeatable: boolean;
    children: SchemaNode[];
    options?: string[];
}

@Component({
    selector: 'app-manual-entry',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
    templateUrl: './manual-entry.component.html',
    styleUrl: './manual-entry.component.css'
})
export class ManualEntryComponent implements OnInit {
    viewMode: 'form' | 'xml' = 'form';
    allTypes: string[] = [];
    filteredTypes: string[] = [];
    searchQuery = '';
    showSuggestions = false;

    selectedType = '';
    schema: SchemaNode | null = null;
    loading = false;

    // Grouped types: Family -> List of IDs
    groupedTypes: Record<string, string[]> = {};
    families: string[] = [];
    selectedFamily: string | null = null;

    // path -> value
    formData: Record<string, string> = {};

    // path -> isExpanded
    expandedPaths: Record<string, boolean> = {};

    previewXml = '';

    popularMessages = [
        { id: 'pacs.008.001.08', name: 'Customer Credit Transfer', type: 'pacs', route: 'pacs8' },
        { id: 'pacs.003.001.08', name: 'Customer Direct Debit', type: 'pacs', route: 'pacs3' },
        { id: 'pacs.009.001.08', name: 'FI Credit Transfer', type: 'pacs', route: 'pacs9' },
        { id: 'pacs.004.001.09', name: 'Payment Return', type: 'pacs', route: 'pacs4' },
        { id: 'pacs.002.001.10', name: 'Payment Status Report', type: 'pacs', route: 'pacs2' },
        { id: 'camt.057.001.08', name: 'Notification to Receive', type: 'camt', route: 'camt57' },
        { id: 'camt.052.001.08', name: 'Bank To Customer Report', type: 'camt', route: 'camt052' },
        { id: 'camt.053.001.08', name: 'Bank To Customer Statement', type: 'camt', route: 'camt053' },
        { id: 'pain.001.001.09', name: 'Credit Transfer Init', type: 'pain', route: 'pain001' },
        { id: 'pain.002.001.10', name: 'Pmt Status Report', type: 'pain', route: 'pain002' }
    ];

    constructor(
        private http: HttpClient,
        private config: ConfigService,
        private snackBar: MatSnackBar,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit() {
        this.fetchMessageTypes();
        this.route.params.subscribe(params => {
            if (params['type']) {
                this.selectType(params['type']);
            }
        });
    }

    gotoMessage(route: string) {
        this.router.navigate(['/generate', route]);
    }

    fetchMessageTypes() {
        this.http.get<string[]>(this.config.getApiUrl('/messages')).subscribe({
            next: (types) => {
                this.allTypes = types;
                this.groupTypes(types);
                this.filteredTypes = [...types].slice(0, 20);
            },
            error: (err) => console.error('Failed to fetch message types', err)
        });
    }

    groupTypes(types: string[]) {
        const groups: Record<string, string[]> = {};
        for (const type of types) {
            const family = type.split('.')[0].toUpperCase();
            if (!groups[family]) groups[family] = [];
            groups[family].push(type);
        }
        this.groupedTypes = groups;
        this.families = Object.keys(groups).sort();
    }

    onSearchInput() {
        this.selectedFamily = null;
        if (!this.searchQuery) {
            this.filteredTypes = this.allTypes.slice(0, 20);
            return;
        }
        const q = this.searchQuery.toLowerCase();
        this.filteredTypes = this.allTypes
            .filter(t => t.toLowerCase().includes(q))
            .slice(0, 100); // Increased limit significantly
        this.showSuggestions = true;
    }

    selectType(type: string) {
        this.selectedType = type;
        this.searchQuery = type;
        this.showSuggestions = false;
        this.selectedFamily = null;
        this.fetchSchema(type);
    }

    selectFamily(family: string) {
        this.selectedFamily = family;
        this.searchQuery = '';
        this.filteredTypes = this.groupedTypes[family] || [];
    }

    fetchSchema(type: string) {
        this.loading = true;
        this.schema = null;
        this.formData = {};
        this.expandedPaths = {};

        this.http.get<SchemaNode>(this.config.getApiUrl(`/messages/${type}/schema`)).subscribe({
            next: (schema) => {
                if (schema) {
                    this.applyMandatoryOverrides(schema, type);
                }
                this.schema = schema;
                this.loading = false;
                // Expand everything by default to show all fields as requested
                if (schema) {
                    const autoExpandAll = (node: SchemaNode, path: string) => {
                        this.expandedPaths[path] = true;
                        if (node.children) {
                            for (const child of node.children) {
                                autoExpandAll(child, `${path}.${child.name}`);
                            }
                        }
                    };
                    autoExpandAll(schema, schema.name);
                    this.prepopulateDefaults(schema, schema.name);
                }
                this.updatePreview();
            },
            error: (err) => {
                console.error('Failed to fetch schema', err);
                this.loading = false;
                this.snackBar.open(`Error loading schema for ${type}`, 'Close', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom' });
            }
        });
    }

    applyMandatoryOverrides(node: SchemaNode, type: string) {
        const t = type.toLowerCase();
        // Skip CAMT as requested by user
        if (t.startsWith('camt.')) return;

        if (t.startsWith('pacs.') || t.startsWith('pain.')) {
            const mandatoryNames = ['Dbtr', 'Cdtr', 'DbtrAgt', 'CdtrAgt', 'DbtrFi', 'CdtrFi'];
            if (mandatoryNames.includes(node.name)) {
                node.mandatory = true;
            }
        }
        if (node.children) {
            for (const child of node.children) {
                this.applyMandatoryOverrides(child, type);
            }
        }
    }

    prepopulateDefaults(node: SchemaNode, path: string, depth: number = 0) {
        const n = node.name;
        const isLeaf = !node.children || node.children.length === 0;

        // RULE: Only fill values for mandatory fields to keep the XML concise.
        // Exception: Always process the root/Document and recurse to find mandatory children.
        if (node.mandatory || depth === 0) {

            // 1. Specific ISO 20022 logic for mandatory common fields
            if (n === 'CreDtTm' || n === 'CreDt' || n === 'Dt' || n === 'TradDt' || n === 'SttlmDt' || n.includes('DtTm')) {
                const now = new Date();
                this.formData[path] = n.includes('Tm') ? now.toISOString().split('.')[0] + 'Z' : now.toISOString().split('T')[0];
            }
            else if (n === 'MsgId' || n === 'BizMsgIdr' || n === 'InstrId' || n === 'EndToEndId' || (n === 'Id' && (path.includes('GrpHdr') || path.includes('Assgnmt')))) {
                this.formData[path] = `${n.toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            }
            else if (n === 'UETR' || n === 'OrgnlUETR') {
                this.formData[path] = '550e8400-e29b-41d4-a716-446655440000';
            }
            else if (n === 'NbOfTxs' || n === 'TtlNbOfTxs') {
                this.formData[path] = '1';
            }
            else if (n === 'Amt' || n === 'InstdAmt' || n === 'IntrBkSttlmAmt' || n === 'TtlIntrBkSttlmAmt') {
                this.formData[path] = '1500.00';
            }
            else if (n === 'Ccy' || n === 'InstdAmtCcy' || n === 'IntrBkSttlmAmtCcy') {
                this.formData[path] = 'USD';
            }
            else if (n === 'BIC' || n === 'BICFI' || n === 'AnyBIC' || n === 'OrgAnyBIC') {
                if (path.includes('Dbtr')) this.formData[path] = 'BBBBUS33XXX';
                else if (path.includes('Cdtr')) this.formData[path] = 'CCCCGB2LXXX';
                else this.formData[path] = 'BANKUS33XXX';
            }
            else if (n === 'IBAN') {
                this.formData[path] = 'US12345678901234567890';
            }
            else if (n === 'Ctry' || n === 'SttlmCtry' || n === 'Issr' || n === 'CtryOfBirth') {
                this.formData[path] = 'US';
            }
            else if (n === 'Nm') {
                if (path.includes('Dbtr')) this.formData[path] = 'Debtor Name';
                else if (path.includes('Cdtr')) this.formData[path] = 'Creditor Name';
                else this.formData[path] = 'Global Trading Corp';
            }
            else if (n === 'PstCd') {
                this.formData[path] = '10001';
            }
            else if (n === 'CityOfBirth' || n === 'TwnNm') {
                this.formData[path] = 'New York';
            }
            else if (n === 'BirthDt') {
                this.formData[path] = '1980-01-01';
            }
            else if (n === 'SvcLvl' || n === 'Cd' || n === 'Prtry') {
                if (path.includes('SvcLvl')) this.formData[path] = 'URGP';
                else if (isLeaf) {
                    if (n === 'Cd') this.formData[path] = 'OTHR';
                    else if (n === 'Prtry') this.formData[path] = 'CUSTOM';
                    else this.formData[path] = 'ADDR';
                }
            }
            // 2. Generic leaf fallback (ONLY for mandatory leaves)
            else if (isLeaf && !this.formData[path]) {
                if (node.type === 'number' || node.type === 'decimal') {
                    this.formData[path] = '100.00';
                } else if (node.type === 'boolean') {
                    this.formData[path] = 'true';
                } else {
                    // Context-aware realistic placeholders
                    if (n === 'ChanlTp') this.formData[path] = 'SWIFT';
                    else if (n === 'MmbId') this.formData[path] = 'CLR00123';
                    else if (n === 'OrgnlMsgId') this.formData[path] = 'ORIG-998877';
                    else if (n === 'OrgnlMsgNmId') this.formData[path] = 'pacs.008.001.08';
                    else this.formData[path] = 'VALUE_DATA';
                }
            }
        }

        // ALWAYS recurse to find mandatory sub-fields
        if (node.children) {
            // If the current node is mandatory and all children are now optional (likely due to a choice),
            // we should pick at least the first mandatory child of that branch to ensure the structure
            // isn't empty.
            let hasMandatoryChild = node.children.some(c => c.mandatory);

            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                // Force fill the first child of a mandatory choice/group if none other are mandatory
                if (node.mandatory && !hasMandatoryChild && i === 0 && !child.children?.length) {
                    (child as any).mandatory = true;
                }
                this.prepopulateDefaults(child, `${path}.${child.name}`, depth + 1);
            }
        }
    }

    toggleNode(path: string) {
        this.expandedPaths[path] = !this.expandedPaths[path];
    }

    isExpanded(path: string): boolean {
        return !!this.expandedPaths[path];
    }

    updatePreview() {
        if (!this.schema) {
            this.previewXml = '';
            return;
        }
        const xml = this.generateXml(this.schema, this.schema.name, 0);
        this.previewXml = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
    }

    generateXml(node: SchemaNode, path: string, depth: number): string {
        const value = this.formData[path];
        const indent = '  '.repeat(depth);

        if (node.children && node.children.length > 0) {
            const attrs = node.children.filter(c => (c as any).isAttribute);
            const elements = node.children.filter(c => !(c as any).isAttribute);

            let attrStr = '';
            for (const attr of attrs) {
                const attrVal = this.formData[`${path}.${attr.name}`];
                if (attrVal) {
                    attrStr += ` ${attr.name}="${this.escapeXml(attrVal)}"`;
                }
            }

            let childXml = '';
            for (const child of elements) {
                childXml += this.generateXml(child, `${path}.${child.name}`, depth + 1);
            }

            if (childXml || value || attrStr) {
                let tag = node.name;
                if (depth === 0 && (this.schema as any)?.namespace) {
                    tag += ` xmlns="${(this.schema as any).namespace}"`;
                }
                tag += attrStr;

                if (childXml) {
                    return `${indent}<${tag}>\n${childXml}${indent}</${node.name}>\n`;
                } else if (value) {
                    return `${indent}<${tag}>${this.escapeXml(value)}</${node.name}>\n`;
                } else {
                    return `${indent}<${tag}/>\n`;
                }
            }
            return '';
        } else if (value) {
            return `${indent}<${node.name}>${this.escapeXml(value)}</${node.name}>\n`;
        }
        return '';
    }

    escapeXml(unsafe: string) {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    onBlur() {
        // Delay to allow selectType mousedown to fire
        setTimeout(() => this.showSuggestions = false, 200);
    }

    copyToClipboard() {
        const fullXml = `<?xml version="1.0" encoding="UTF-8"?>\n${this.previewXml}`;
        navigator.clipboard.writeText(fullXml).then(() => {
            this.snackBar.open('XML copied to clipboard!', 'Close', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom' });
        });
    }

    downloadXml() {
        const fullXml = `<?xml version="1.0" encoding="UTF-8"?>\n${this.previewXml}`;
        const blob = new Blob([fullXml], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.selectedType}-${Date.now()}.xml`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    generateFinalXml() {
        // This is the same as copy/download but could be expanded to validate
        this.copyToClipboard();
    }
}
