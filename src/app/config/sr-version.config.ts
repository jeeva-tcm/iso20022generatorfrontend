/**
 * SR Version Configuration
 * -----------------------
 * Single source of truth for all Standards Release-specific rules.
 * Adding SR2027: just add a new key to SR_VERSION_CONFIG — no component changes needed.
 */

export type SrVersion = 'SR2025' | 'SR2026';

// ─── Per-message-family rules ─────────────────────────────────────────────────

export interface MessageVersionRules {
  /** ISO 20022 message identifier (e.g. pacs.010.001.03) */
  msgDefIdr: string;
  /** Full XML namespace */
  namespace: string;
  /** SWIFT BizSvc value */
  bizSvc: string;
  /** Live-on-network date */
  liveDate: string;
}

// ─── Validation rules per SR ──────────────────────────────────────────────────

export interface SrValidationRules {
  /** Max address lines allowed in hybrid/unstructured postal address */
  maxAddressLines: number;
  /** Require TownName when AddressLine is present (CBPR+ R17/R18) */
  requireTownNameInHybrid: boolean;
  /** SR2026+: structured address fields (Dept, StrtNm, etc.) forbidden with AdrLine */
  strictStructuredAddressSeparation: boolean;
  /** UETR is mandatory in PmtId */
  requireUETR: boolean;
  /** Require InstrId to be populated */
  requireInstrId: boolean;
  /** Max characters for unstructured remittance info */
  maxRemittanceLength: number;
  /** Max characters for Instruction For Debtor Agent */
  maxInstrForDbtrAgt: number;
  /** Max characters for MemberIdentification */
  maxMemberIdLength: number;
}

// ─── Full SR version configuration ───────────────────────────────────────────

export interface SrVersionConfig {
  version: SrVersion;
  label: string;
  description: string;
  releaseYear: number;
  networkLiveDate: string;
  badgeColor: string;

  // Message-family rules
  messages: {
    pacs010Interbank: MessageVersionRules;
    pacs010MarginCollection: MessageVersionRules;
    pacs008: MessageVersionRules;
    pacs009: MessageVersionRules;
    pacs009Adv: MessageVersionRules;
    pacs009Cov: MessageVersionRules;
    pacs004: MessageVersionRules;
    pacs003: MessageVersionRules;
    pacs002: MessageVersionRules;
    camt057: MessageVersionRules;
    camt052: MessageVersionRules;
    camt053: MessageVersionRules;
    camt054: MessageVersionRules;
    camt055: MessageVersionRules;
    camt056: MessageVersionRules;
    pain001: MessageVersionRules;
    pain002: MessageVersionRules;
    pain008: MessageVersionRules;
  };

  validation: SrValidationRules;
}

// ─── SR2025 Configuration ─────────────────────────────────────────────────────

const SR2025: SrVersionConfig = {
  version: 'SR2025',
  label: 'SR2025',
  description: 'Standards Release November 2025 — CBPR+ Combined',
  releaseYear: 2025,
  networkLiveDate: 'November 2025',
  badgeColor: '#1976d2',   // Material blue

  messages: {
    pacs010Interbank: {
      msgDefIdr: 'pacs.010.001.03',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.010.001.03',
      bizSvc: 'swift.cbprplus.03',
      liveDate: 'November 2025',
    },
    pacs010MarginCollection: {
      msgDefIdr: 'pacs.010.001.03',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.010.001.03',
      bizSvc: 'swift.cbprplus.col.02',
      liveDate: 'November 2025',
    },
    pacs008: {
      msgDefIdr: 'pacs.008.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    pacs009: {
      msgDefIdr: 'pacs.009.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08',
      bizSvc: 'swift.cbprplus.03',   // original pacs9 hardcoded value restored
      liveDate: 'November 2025',
    },
    pacs009Adv: {
      msgDefIdr: 'pacs.009.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08',
      bizSvc: 'swift.cbprplus.adv.03',
      liveDate: 'November 2025',
    },
    pacs009Cov: {
      msgDefIdr: 'pacs.009.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08',
      bizSvc: 'swift.cbprplus.cov.03',
      liveDate: 'November 2025',
    },
    pacs004: {
      msgDefIdr: 'pacs.004.001.09',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    pacs003: {
      msgDefIdr: 'pacs.003.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.003.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    pacs002: {
      msgDefIdr: 'pacs.002.001.10',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10',
      bizSvc: 'swift.cbprplus.03',   // original pacs2 form default value restored
      liveDate: 'November 2025',
    },
    camt057: {
      msgDefIdr: 'camt.057.001.06',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.057.001.06',
      bizSvc: 'swift.cbprplus.03',
      liveDate: 'November 2025',
    },
    camt052: {
      msgDefIdr: 'camt.052.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.052.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    camt053: {
      msgDefIdr: 'camt.053.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    camt054: {
      msgDefIdr: 'camt.054.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.054.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    camt055: {
      msgDefIdr: 'camt.055.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.055.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    camt056: {
      msgDefIdr: 'camt.056.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.056.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    pain001: {
      msgDefIdr: 'pain.001.001.09',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    pain002: {
      msgDefIdr: 'pain.002.001.10',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pain.002.001.10',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
    pain008: {
      msgDefIdr: 'pain.008.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2025',
    },
  },

  validation: {
    maxAddressLines: 3,
    requireTownNameInHybrid: true,
    strictStructuredAddressSeparation: false,
    requireUETR: true,
    requireInstrId: true,
    maxRemittanceLength: 140,
    maxInstrForDbtrAgt: 210,
    maxMemberIdLength: 28,
  },
};

// ─── SR2026 Configuration ─────────────────────────────────────────────────────
// NOTE: SR2026 specification is not yet published (expected mid-2026).
// This configuration mirrors SR2025 with anticipated stricter rules.
// Update message versions and validation rules once the SWIFT MyStandards
// SR2026 collection is released.

const SR2026: SrVersionConfig = {
  version: 'SR2026',
  label: 'SR2026',
  description: 'Standards Release November 2026 — CBPR+ Combined (Preview)',
  releaseYear: 2026,
  networkLiveDate: 'November 2026',
  badgeColor: '#7b1fa2',   // Material purple

  messages: {
    // SR2026 uses the same XSD version numbers as SR2025 for pacs/camt/pain messages.
    // The CBPR+ collection version changes: BizSvc suffix .03 → .04.
    // Source: CBPR+ SR2026 XSD files in xsds sr2026/ and pacs SR2026 Changes comparison docs.
    pacs010Interbank: {
      msgDefIdr: 'pacs.010.001.03',           // same version, confirmed by SR2026 XSD filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.010.001.03',
      bizSvc: 'swift.cbprplus.04',            // .03 → .04 per SR2026 BizSvc comparison
      liveDate: 'November 2026',
    },
    pacs010MarginCollection: {
      msgDefIdr: 'pacs.010.001.03',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.010.001.03',
      bizSvc: 'swift.cbprplus.col.02',        // margin collection keeps .col.02
      liveDate: 'November 2026',
    },
    pacs008: {
      msgDefIdr: 'pacs.008.001.08',           // same version, confirmed by SR2026 XSD filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08',
      bizSvc: 'swift.cbprplus.04',            // .03 → .04 per SR2026 BizSvc comparison
      liveDate: 'November 2026',
    },
    pacs009: {
      msgDefIdr: 'pacs.009.001.08',           // same version, confirmed by SR2026 XSD filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08',
      bizSvc: 'swift.cbprplus.04',            // .03 → .04 per SR2026 CORE comparison
      liveDate: 'November 2026',
    },
    pacs009Adv: {
      msgDefIdr: 'pacs.009.001.08',           // same version, confirmed by SR2026 XSD filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08',
      bizSvc: 'swift.cbprplus.adv.04',        // .adv.03 → .adv.04 per SR2026 ADV comparison
      liveDate: 'November 2026',
    },
    pacs009Cov: {
      msgDefIdr: 'pacs.009.001.08',           // same version, confirmed by SR2026 XSD filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08',
      bizSvc: 'swift.cbprplus.cov.04',        // .cov.03 → .cov.04 per SR2026 COV comparison
      liveDate: 'November 2026',
    },
    pacs004: {
      msgDefIdr: 'pacs.004.001.09',           // same version per xsds sr2026/ filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09',
      bizSvc: 'swift.cbprplus.04',            // .02 → .04 per SR2026 collection version
      liveDate: 'November 2026',
    },
    pacs003: {
      msgDefIdr: 'pacs.003.001.08',           // same version per xsds sr2026/ filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.003.001.08',
      bizSvc: 'swift.cbprplus.03',            // pacs.003 SR2026 uses .03 (not .04); per comparison HTML
      liveDate: 'November 2026',
    },
    pacs002: {
      msgDefIdr: 'pacs.002.001.10',           // same version per xsds sr2026/ filename
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10',
      bizSvc: 'swift.cbprplus.04',            // .03 → .04 per SR2026 collection version
      liveDate: 'November 2026',
    },
    camt057: {
      msgDefIdr: 'camt.057.001.06',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.057.001.06',
      bizSvc: 'swift.cbprplus.03',
      liveDate: 'November 2026',
    },
    camt052: {
      msgDefIdr: 'camt.052.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.052.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    camt053: {
      msgDefIdr: 'camt.053.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    camt054: {
      msgDefIdr: 'camt.054.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.054.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    camt055: {
      msgDefIdr: 'camt.055.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.055.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    camt056: {
      msgDefIdr: 'camt.056.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:camt.056.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    pain001: {
      msgDefIdr: 'pain.001.001.09',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    pain002: {
      msgDefIdr: 'pain.002.001.10',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pain.002.001.10',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
    pain008: {
      msgDefIdr: 'pain.008.001.08',
      namespace: 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.08',
      bizSvc: 'swift.cbprplus.02',
      liveDate: 'November 2026',
    },
  },

  validation: {
    maxAddressLines: 2,                        // SR2026: reduced from 3 to 2
    requireTownNameInHybrid: true,
    strictStructuredAddressSeparation: true,   // SR2026: no mixing structured + AdrLine
    requireUETR: true,
    requireInstrId: true,
    maxRemittanceLength: 140,
    maxInstrForDbtrAgt: 210,
    maxMemberIdLength: 28,
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────
// To add SR2027: add SR2027 object above and insert 'SR2027': SR2027 below.

export const SR_VERSION_CONFIG: Record<SrVersion, SrVersionConfig> = {
  SR2025,
  SR2026,
};

export const AVAILABLE_SR_VERSIONS: SrVersion[] = Object.keys(SR_VERSION_CONFIG) as SrVersion[];
export const DEFAULT_SR_VERSION: SrVersion = 'SR2025';
