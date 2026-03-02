import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ConfigService } from '../../../services/config.service';

@Component({
  selector: 'app-pacs8',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
  templateUrl: './pacs8.component.html',
  styleUrl: './pacs8.component.css'
})
export class Pacs8Component {
  form: FormGroup;
  generatedXml: string = '';
  currentTab: 'form' | 'preview' = 'form';

  // Validation state
  isValidating = false;
  validationReport: any = null;
  expandedIssue: any = null;
  expandedLayers: { [key: string]: boolean } = {};

  // Helper to create address controls
  private createAddressControls() {
    return {
      AddrType: ['none'],
      AdrLine1: [''],
      AdrLine2: [''],
      StrtNm: [''],
      BldgNb: [''],
      PstCd: [''],
      TwnNm: [''],
      Ctry: ['']
    };
  }

  // Iterate over these keys to add controls dynamically
  agentPrefixes = [
    'dbtrAgt', 'cdtrAgt',
    'prvsInstgAgt1', 'prvsInstgAgt2', 'prvsInstgAgt3',
    'intrmyAgt1', 'intrmyAgt2', 'intrmyAgt3'
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private config: ConfigService
  ) {
    // Base controls
    const controls: any = {
      // Application Header
      fromBic: ['BBBBUS33XXX', Validators.required],
      toBic: ['CCCCGB2LXXX', Validators.required],
      bizMsgId: ['MSG-2026-B-001', Validators.required],

      // Group Header
      msgId: ['MSG-2026-B-001', Validators.required],
      creDtTm: [new Date().toISOString(), Validators.required],

      // Transaction Info
      instrId: ['INSTR-ID-999', Validators.required],
      endToEndId: ['E2E-REF-777', Validators.required],
      txId: ['TX-ID-555', Validators.required],
      uetr: ['550e8400-e29b-41d4-a716-446655440000', Validators.required],

      // Payment Type
      svcLvlCd: ['SEPA', Validators.required],

      // Amount & Date
      amount: ['1500.00', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      currency: ['USD', Validators.required],
      sttlmDt: ['2026-02-02', Validators.required],

      // Agents (Main)
      instgAgtBic: ['BBBBUS33XXX', Validators.required],
      instdAgtBic: ['CCCCGB2LXXX', Validators.required],

      // Debtor
      dbtrName: ['John Doe Corp', Validators.required],
      dbtrIban: ['US12345678901234567890', Validators.required],

      // Creditor
      cdtrName: ['Jane Smith Ltd', Validators.required],
      cdtrIban: ['GB98765432109876543210', Validators.required],

      // Agent BICs (Optional/Required)
      dbtrAgtBic: ['BBBBUS33XXX', Validators.required],
      cdtrAgtBic: ['CCCCGB2LXXX', Validators.required],

      prvsInstgAgt1Bic: [''],
      prvsInstgAgt2Bic: [''],
      prvsInstgAgt3Bic: [''],
      intrmyAgt1Bic: [''],
      intrmyAgt2Bic: [''],
      intrmyAgt3Bic: [''],
    };

    // Add address controls for Main Entities
    this.addAddressControlsToArray(controls, 'instgAgt');
    this.addAddressControlsToArray(controls, 'instdAgt');
    this.addAddressControlsToArray(controls, 'dbtr');
    this.addAddressControlsToArray(controls, 'cdtr');

    // Add address controls for all other agents
    this.agentPrefixes.forEach(prefix => {
      this.addAddressControlsToArray(controls, prefix);
    });

    this.form = this.fb.group(controls);
  }

  addAddressControlsToArray(controls: any, prefix: string) {
    const addr = this.createAddressControls();
    Object.keys(addr).forEach(key => {
      controls[prefix + key] = (addr as any)[key];
    });
  }

  ngOnInit(): void {
    this.generateXml();
  }

  // Helper for CBPR DateTime format
  getIsoDateWithOffset(): string {
    const now = new Date();
    const p = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const timeStr = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    return `${dateStr}T${timeStr}+00:00`;
  }

  generateXml() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
    }

    const v = this.form.value;
    const creDt = this.getIsoDateWithOffset();

    let grpCreDtTm = v.creDtTm;
    if (grpCreDtTm && grpCreDtTm.endsWith('Z')) {
      grpCreDtTm = creDt;
    }

    // Construct Optional Agents XML
    let prvsInstgAgtsXml = '';
    prvsInstgAgtsXml += this.buildAgentXml('PrvsInstgAgt1', 'prvsInstgAgt1', v);
    prvsInstgAgtsXml += this.buildAgentXml('PrvsInstgAgt2', 'prvsInstgAgt2', v);
    prvsInstgAgtsXml += this.buildAgentXml('PrvsInstgAgt3', 'prvsInstgAgt3', v);

    let intrmyAgtsXml = '';
    intrmyAgtsXml += this.buildAgentXml('IntrmyAgt1', 'intrmyAgt1', v);
    intrmyAgtsXml += this.buildAgentXml('IntrmyAgt2', 'intrmyAgt2', v);
    intrmyAgtsXml += this.buildAgentXml('IntrmyAgt3', 'intrmyAgt3', v);

    // Build Address Blocks
    const dbtrAddr = this.buildAddressXml(v, 'dbtr');
    const cdtrAddr = this.buildAddressXml(v, 'cdtr');
    const instgAgtAddr = this.buildAddressXml(v, 'instgAgt');
    const instdAgtAddr = this.buildAddressXml(v, 'instdAgt');

    const dbtrAgtBlock = this.buildAgentXml('DbtrAgt', 'dbtrAgt', v);
    const cdtrAgtBlock = this.buildAgentXml('CdtrAgt', 'cdtrAgt', v);

    // Build the full XML
    this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
	<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
		<Fr>
			<FIId>
				<FinInstnId>
					<BICFI>${v.fromBic}</BICFI>
				</FinInstnId>
			</FIId>
		</Fr>
		<To>
			<FIId>
				<FinInstnId>
					<BICFI>${v.toBic}</BICFI>
				</FinInstnId>
			</FIId>
		</To>
		<BizMsgIdr>${v.bizMsgId}</BizMsgIdr>
		<MsgDefIdr>pacs.008.001.08</MsgDefIdr>
		<BizSvc>swift.cbprplus.01</BizSvc>
		<CreDt>${creDt}</CreDt>
	</AppHdr>
	<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
		<FIToFICstmrCdtTrf>
			<GrpHdr>
				<MsgId>${v.msgId}</MsgId>
				<CreDtTm>${grpCreDtTm}</CreDtTm>
				<NbOfTxs>1</NbOfTxs>
				<SttlmInf>
					<SttlmMtd>INDA</SttlmMtd>
				</SttlmInf>
			</GrpHdr>
			<CdtTrfTxInf>
				<PmtId>
					<InstrId>${v.instrId}</InstrId>
					<EndToEndId>${v.endToEndId}</EndToEndId>
					<TxId>${v.txId}</TxId>
					<UETR>${v.uetr}</UETR>
				</PmtId>
				<PmtTpInf>
					<SvcLvl>
						<Cd>${v.svcLvlCd}</Cd>
					</SvcLvl>
				</PmtTpInf>
				<IntrBkSttlmAmt Ccy="${v.currency}">${v.amount}</IntrBkSttlmAmt>
				<IntrBkSttlmDt>${v.sttlmDt}</IntrBkSttlmDt>
				<ChrgBr>SHAR</ChrgBr>
				${prvsInstgAgtsXml}<InstgAgt>
					<FinInstnId>
						<BICFI>${v.instgAgtBic}</BICFI>
            ${instgAgtAddr}
					</FinInstnId>
				</InstgAgt>
				<InstdAgt>
					<FinInstnId>
						<BICFI>${v.instdAgtBic}</BICFI>
            ${instdAgtAddr}
					</FinInstnId>
				</InstdAgt>
				${intrmyAgtsXml}<Dbtr>
					<Nm>${v.dbtrName}</Nm>
          ${dbtrAddr}
				</Dbtr>
				<DbtrAcct>
					<Id>
						<IBAN>${v.dbtrIban}</IBAN>
					</Id>
				</DbtrAcct>
				${dbtrAgtBlock}
				${cdtrAgtBlock}
				<Cdtr>
					<Nm>${v.cdtrName}</Nm>
          ${cdtrAddr}
				</Cdtr>
				<CdtrAcct>
					<Id>
						<IBAN>${v.cdtrIban}</IBAN>
					</Id>
				</CdtrAcct>
				<Purp>
					<Cd>CASH</Cd>
				</Purp>
			</CdtTrfTxInf>
		</FIToFICstmrCdtTrf>
	</Document>
</BusMsgEnvlp>`;
  }

  buildAgentXml(tagName: string, prefix: string, v: any): string {
    const bic = v[prefix + 'Bic'];
    if (!bic) return '';

    const addrXml = this.buildAddressXml(v, prefix);

    return `<${tagName}>
					<FinInstnId>
						<BICFI>${bic}</BICFI>
            ${addrXml}
					</FinInstnId>
				</${tagName}>
				`;
  }

  buildAddressXml(v: any, prefix: string): string {
    const type = v[prefix + 'AddrType'];
    if (!type || type === 'none') return '';

    let content = '';

    if (type === 'structured' || type === 'hybrid') {
      if (v[prefix + 'StrtNm']) content += `<StrtNm>${v[prefix + 'StrtNm']}</StrtNm>\n`;
      if (v[prefix + 'BldgNb']) content += `<BldgNb>${v[prefix + 'BldgNb']}</BldgNb>\n`;
      if (v[prefix + 'PstCd']) content += `<PstCd>${v[prefix + 'PstCd']}</PstCd>\n`;
      if (v[prefix + 'TwnNm']) content += `<TwnNm>${v[prefix + 'TwnNm']}</TwnNm>\n`;
      if (v[prefix + 'Ctry']) content += `<Ctry>${v[prefix + 'Ctry']}</Ctry>\n`;
    }

    if (type === 'unstructured' || type === 'hybrid') {
      if (v[prefix + 'AdrLine1']) content += `<AdrLine>${v[prefix + 'AdrLine1']}</AdrLine>\n`;
      if (v[prefix + 'AdrLine2']) content += `<AdrLine>${v[prefix + 'AdrLine2']}</AdrLine>\n`;
    }

    if (!content) return '';

    return `<PstlAdr>
              ${content}
            </PstlAdr>`;
  }

  // ===== Validation Report Helpers (same as Validate page) =====
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

  isLayerPass(report: any, k: string) { return this.getLayerStatus(report, k).includes('✅'); }
  isLayerFail(report: any, k: string) { return this.getLayerStatus(report, k).includes('❌'); }
  isLayerWarn(report: any, k: string) {
    const s = this.getLayerStatus(report, k);
    return s.includes('⚠') || s.includes('WARNING') || s.includes('WARN');
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

  toggleLayer(layerName: string) {
    this.expandedLayers[layerName] = !this.isLayerExpanded(layerName);
  }

  isLayerExpanded(layerName: string): boolean {
    return !!this.expandedLayers[layerName];
  }

  // ===== Validate Message =====
  validateMessage() {
    this.generateXml();

    if (!this.generatedXml?.trim()) return;

    this.isValidating = true;
    this.validationReport = null;
    this.expandedIssue = null;
    this.expandedLayers = {};

    this.http.post(this.config.getApiUrl('/validate'), {
      xml_content: this.generatedXml,
      mode: 'Full 1-3',
      message_type: 'pacs.008.001.08',
      store_in_history: true
    }).subscribe({
      next: (data: any) => {
        this.validationReport = data;
        this.isValidating = false;
        // Auto-expand layers with issues
        if (data?.details) {
          const layers = [...new Set(data.details.map((x: any) => x.layer))];
          layers.forEach(l => {
            this.expandedLayers[this.getLayerName(String(l))] = true;
          });
        }
      },
      error: (err) => {
        this.isValidating = false;
        this.validationReport = {
          status: 'FAIL',
          errors: 1,
          warnings: 0,
          message: 'pacs.008.001.08',
          total_time_ms: 0,
          layer_status: { '1': { status: '❌', time: 0 } },
          details: [{
            severity: 'ERROR',
            layer: 1,
            code: 'BACKEND_ERROR',
            path: '',
            message: 'Could not reach the validation backend. Please ensure the server is running.',
            fix_suggestion: 'Check if the backend is running on the expected port.'
          }]
        };
      }
    });
  }

  downloadXml() {
    this.generateXml();
    const blob = new Blob([this.generatedXml], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacs.008-${new Date().getTime()}.xml`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  copyToClipboard() {
    this.generateXml();
    navigator.clipboard.writeText(this.generatedXml).then(() => {
      alert('XML copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  }

  switchToPreview() {
    this.generateXml();
    this.currentTab = 'preview';
  }
}
