import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import {
  SrVersion,
  SrVersionConfig,
  SrValidationRules,
  MessageVersionRules,
  SR_VERSION_CONFIG,
  AVAILABLE_SR_VERSIONS,
  DEFAULT_SR_VERSION,
} from '../config/sr-version.config';

@Injectable({ providedIn: 'root' })
export class SrVersionService {
  private readonly SESSION_KEY = 'iso_nova_sr_version';

  private readonly _version$ = new BehaviorSubject<SrVersion>(this.loadSaved());

  /** Observable — subscribe in components to react to version changes. */
  readonly version$: Observable<SrVersion> = this._version$.asObservable().pipe(distinctUntilChanged());

  /** Observable of the full config object for the current version. */
  readonly config$: Observable<SrVersionConfig> = this.version$.pipe(
    map(v => SR_VERSION_CONFIG[v])
  );

  /** Observable of just the validation rules — use in form components. */
  readonly validation$: Observable<SrValidationRules> = this.config$.pipe(
    map(c => c.validation)
  );

  // ─── Synchronous accessors ──────────────────────────────────────────────────

  get currentVersion(): SrVersion {
    return this._version$.value;
  }

  get config(): SrVersionConfig {
    return SR_VERSION_CONFIG[this.currentVersion];
  }

  get validation(): SrValidationRules {
    return this.config.validation;
  }

  get isSR2025(): boolean {
    return this.currentVersion === 'SR2025';
  }

  get isSR2026(): boolean {
    return this.currentVersion === 'SR2026';
  }

  get availableVersions(): SrVersion[] {
    return AVAILABLE_SR_VERSIONS;
  }

  // ─── Mutation ───────────────────────────────────────────────────────────────

  setVersion(version: SrVersion): void {
    if (!SR_VERSION_CONFIG[version]) {
      console.warn(`[SrVersionService] Unknown version "${version}", ignoring.`);
      return;
    }
    sessionStorage.setItem(this.SESSION_KEY, version);
    this._version$.next(version);
  }

  // ─── Message-specific helpers ───────────────────────────────────────────────

  getMessageRules(
    key: keyof SrVersionConfig['messages'],
    version?: SrVersion
  ): MessageVersionRules {
    return SR_VERSION_CONFIG[version ?? this.currentVersion].messages[key];
  }

  getMsgDefIdr(key: keyof SrVersionConfig['messages']): string {
    return this.config.messages[key].msgDefIdr;
  }

  getBizSvc(key: keyof SrVersionConfig['messages']): string {
    return this.config.messages[key].bizSvc;
  }

  getNamespace(key: keyof SrVersionConfig['messages']): string {
    return this.config.messages[key].namespace;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private loadSaved(): SrVersion {
    const stored = sessionStorage.getItem(this.SESSION_KEY) as SrVersion;
    return SR_VERSION_CONFIG[stored] ? stored : DEFAULT_SR_VERSION;
  }
}
