import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AbstractControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';

/** One field-level entry inside a delta section. */
export interface DeltaField {
  field: string;
  path?: string;
  label?: string;
  /** Angular form control name(s) this field maps to (may be empty if not in the form). */
  formControls?: string[];
  sr2025?: string;
  sr2026?: string;
  maxLength?: number | null;
  pattern?: string | null;
  sr2025Max?: number;
  sr2026Max?: number;
  sr2026Allowed?: string[];
  rule?: string;
  note?: string;
  /**
   * When true, a hard Validators.required is added to the mapped control in the
   * target version. Default (false/absent) only flags the field for the `*`
   * marker — authoritative mandatory enforcement lives in the backend validators.
   * Kept opt-in so we never disable a form's Generate/Validate button for a field
   * the component auto-fills (e.g. InstdAmt auto-fills from the settlement amount).
   */
  enforceRequired?: boolean;
}

/** Full SR-version delta for a single message (vs the SR2025 baseline). */
export interface VersionDelta {
  message: string;
  msgDefIdr?: string;
  title?: string;
  targetVersion: string;
  fixedValues: { bizSvc?: string; msgDefIdr?: string };
  newMandatory: DeltaField[];
  mandatoryRemoved: DeltaField[];
  datatypeChanges: DeltaField[];
  multiplicityChanges: DeltaField[];
  dropdownChanges: DeltaField[];
  newRules: string[];
  removedRules: string[];
}

/** Result of applying a delta to a form — drives template hints (`*`, maxlength). */
export interface AppliedDelta {
  /** Control names that are mandatory in the active version. */
  requiredControls: Set<string>;
  /** Control name -> max length in the active version. */
  maxLengths: Map<string, number>;
  /** Control name -> allowed dropdown values in the active version (version-specific). */
  allowedValues: Map<string, string[]>;
  /** The raw delta that was applied (empty for SR2025). */
  delta: VersionDelta | null;
}

/**
 * VersionDeltaService
 * -------------------
 * Fetches the machine-readable SR2026 field delta for a message from the backend
 * ( /version-delta/{message} — the x-sr-version header is injected by the
 * versionInterceptor) and applies it to a reactive form.
 *
 * The deltas are generated from the "pacs SR2026 Changes" comparison documents
 * and are the single source of truth for per-version field behaviour:
 *   - new mandatory fields  -> Validators.required added
 *   - removed mandatory     -> Validators.required removed
 *   - datatype length change-> Validators.maxLength swapped
 *   - dropdown restriction   -> allowed-value list narrowed
 *
 * SR2025 always resolves to an empty delta, so the baseline behaviour is untouched.
 */
@Injectable({ providedIn: 'root' })
export class VersionDeltaService {
  private cache = new Map<string, Observable<VersionDelta>>();

  constructor(private http: HttpClient, private config: ConfigService) {}

  /**
   * Fetch the delta for a message in the CURRENT version (header-driven).
   * Cached per (message + version) so repeated calls are cheap.
   */
  getDelta(message: string, version: string): Observable<VersionDelta> {
    const cacheKey = `${version}:${message}`;
    if (!this.cache.has(cacheKey)) {
      const obs = this.http
        .get<VersionDelta>(this.config.getApiUrl(`/version-delta/${message}`))
        .pipe(
          catchError(() => of(this.emptyDelta(message, version))),
          shareReplay(1)
        );
      this.cache.set(cacheKey, obs);
    }
    return this.cache.get(cacheKey)!;
  }

  /**
   * Apply a delta to a reactive form: toggle required/maxLength validators on the
   * mapped controls (preserving any pre-existing validators) and compute the
   * template metadata (required set, max lengths, allowed dropdown values).
   *
   * Safe to call repeatedly (e.g. on every version switch) — it is idempotent and
   * skips controls that do not exist in the form.
   */
  applyToForm(form: FormGroup, delta: VersionDelta | null): AppliedDelta {
    const requiredControls = new Set<string>();
    const maxLengths = new Map<string, number>();
    const allowedValues = new Map<string, string[]>();

    // 1. Mandatory removed (SR2026 dropped the "!" marker) — strip any required.
    for (const f of delta?.mandatoryRemoved ?? []) {
      for (const c of f.formControls ?? []) {
        this.setRequired(form.get(c), false);
      }
    }

    // 2. New mandatory — flag for the template `*`; only add a hard required
    //    validator when explicitly opted in (avoids disabling Generate/Validate
    //    for fields the component auto-fills). Backend validators remain the
    //    authoritative mandatory enforcement.
    for (const f of delta?.newMandatory ?? []) {
      for (const c of f.formControls ?? []) {
        if (!form.get(c)) continue;
        requiredControls.add(c);
        if (f.enforceRequired === true) this.setRequired(form.get(c), true);
      }
    }

    // 3. Datatype length changes — swap maxLength validator.
    for (const f of delta?.datatypeChanges ?? []) {
      if (f.maxLength == null) continue;
      for (const c of f.formControls ?? []) {
        if (this.setMaxLength(form.get(c), f.maxLength)) maxLengths.set(c, f.maxLength);
      }
    }

    // 4. Dropdown restrictions — narrow allowed values (template reads this).
    for (const f of delta?.dropdownChanges ?? []) {
      if (!f.sr2026Allowed) continue;
      for (const c of f.formControls ?? []) {
        allowedValues.set(c, f.sr2026Allowed);
      }
    }

    return { requiredControls, maxLengths, allowedValues, delta: delta ?? null };
  }

  /**
   * Remove every validator effect a delta applied — used when switching BACK to
   * SR2025 so the baseline form is fully restored.
   */
  clearFromForm(form: FormGroup, delta: VersionDelta | null): void {
    for (const f of delta?.newMandatory ?? []) {
      for (const c of f.formControls ?? []) this.setRequired(form.get(c), false);
    }
    for (const f of delta?.datatypeChanges ?? []) {
      for (const c of f.formControls ?? []) this.restoreMaxLength(form.get(c));
    }
  }

  // ─── Validator helpers (preserve unrelated validators) ──────────────────────

  private readonly REQUIRED_TAG = '__deltaRequired';
  private readonly MAXLEN_TAG = '__deltaMaxLen';

  private setRequired(ctrl: AbstractControl | null, required: boolean): boolean {
    if (!ctrl) return false;
    const tagged = (ctrl as any)[this.REQUIRED_TAG] === true;
    if (required && !tagged) {
      ctrl.addValidators(Validators.required);
      (ctrl as any)[this.REQUIRED_TAG] = true;
      ctrl.updateValueAndValidity({ emitEvent: false });
    } else if (!required && tagged) {
      ctrl.removeValidators(Validators.required);
      (ctrl as any)[this.REQUIRED_TAG] = false;
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
    return required;
  }

  private setMaxLength(ctrl: AbstractControl | null, max: number): boolean {
    if (!ctrl) return false;
    const prev: ValidatorFn | undefined = (ctrl as any)[this.MAXLEN_TAG];
    if (prev) ctrl.removeValidators(prev);
    const v = Validators.maxLength(max);
    ctrl.addValidators(v);
    (ctrl as any)[this.MAXLEN_TAG] = v;
    ctrl.updateValueAndValidity({ emitEvent: false });
    return true;
  }

  private restoreMaxLength(ctrl: AbstractControl | null): void {
    if (!ctrl) return;
    const prev: ValidatorFn | undefined = (ctrl as any)[this.MAXLEN_TAG];
    if (prev) {
      ctrl.removeValidators(prev);
      (ctrl as any)[this.MAXLEN_TAG] = undefined;
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  /** Create a per-component binding helper for a single message. */
  bind(message: string): VersionDeltaBinding {
    return new VersionDeltaBinding(this, message);
  }

  private emptyDelta(message: string, version: string): VersionDelta {
    return {
      message,
      targetVersion: version,
      fixedValues: {},
      newMandatory: [],
      mandatoryRemoved: [],
      datatypeChanges: [],
      multiplicityChanges: [],
      dropdownChanges: [],
      newRules: [],
      removedRules: [],
    };
  }
}

/**
 * VersionDeltaBinding
 * -------------------
 * Per-component helper that holds the applied delta state and re-applies it on
 * version switch. A component creates one with `versionDelta.bind('pacs008')`,
 * calls `refresh()` in ngOnInit and inside its version$ subscription, and the
 * template reads `isReq(...)` / `maxLen(...)` / `allowed(...)`.
 */
export class VersionDeltaBinding {
  applied: AppliedDelta | null = null;
  private current: VersionDelta | null = null;

  constructor(private svc: VersionDeltaService, private message: string) {}

  /** Fetch the delta for the given version and (re)apply it to the form. */
  refresh(form: FormGroup, version: string, done?: () => void): void {
    this.svc.getDelta(this.message, version).subscribe(delta => {
      if (this.current) this.svc.clearFromForm(form, this.current);
      this.current = delta;
      this.applied = this.svc.applyToForm(form, delta);
      if (done) done();
    });
  }

  /** True when the control is mandatory in the active SR version (`*` marker). */
  isReq(ctrl: string): boolean { return !!this.applied?.requiredControls.has(ctrl); }
  /** Max length for the control in the active SR version (or undefined). */
  maxLen(ctrl: string): number | undefined { return this.applied?.maxLengths.get(ctrl); }
  /** Version-specific allowed dropdown values for the control (or undefined). */
  allowed(ctrl: string): string[] | undefined { return this.applied?.allowedValues.get(ctrl); }
  /** The active delta (null/empty for SR2025). */
  get delta(): VersionDelta | null { return this.applied?.delta ?? null; }
}
