import { Injectable } from '@angular/core';

/**
 * UetrService — session-scoped UETR management.
 *
 * Responsibilities:
 *  - Generate cryptographically-random UUID v4 (RFC 4122)
 *  - Validate UUID v4 format (lowercase, exact 36 chars)
 *  - Track all UETRs used in this browser session to detect duplicates
 *    across different messages (pacs.008, pacs.009, pacs.009-COV, camt.057)
 */
@Injectable({ providedIn: 'root' })
export class UetrService {

  /** UUID v4 regex — lowercase only, strict variant & version bits */
  static readonly UUID_V4_PATTERN =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

  /** All UETRs generated or accepted during this browser session */
  private sessionUetrs = new Set<string>();

  /**
   * Generate a new UUID v4 (lowercase).
   * Guarantees uniqueness within this session by regenerating on collision
   * (astronomically unlikely but handled for correctness).
   */
  generate(): string {
    let uuid: string;
    let attempts = 0;
    do {
      uuid = this._generateRaw();
      attempts++;
    } while (this.sessionUetrs.has(uuid) && attempts < 100);
    this.sessionUetrs.add(uuid);
    return uuid;
  }

  /**
   * Validate a UETR value.
   * Returns one of:
   *  - 'ok'        — valid UUID v4, not a duplicate
   *  - 'format'    — does not match UUID v4 pattern
   *  - 'duplicate' — valid format but already used in this session
   */
  validate(value: string, currentOwner?: string): 'ok' | 'format' | 'duplicate' {
    if (!UetrService.UUID_V4_PATTERN.test(value)) {
      return 'format';
    }
    // Check for duplicate across session, ignoring the current value itself
    // (so the field isn't flagged while it still holds the same generated value)
    if (currentOwner !== value && this.sessionUetrs.has(value) && !this._isOnlyOwner(value, currentOwner)) {
      return 'duplicate';
    }
    return 'ok';
  }

  /**
   * Register a manually-entered UETR as used in this session.
   * Call this when user successfully saves / submits a UETR.
   */
  register(value: string): void {
    if (UetrService.UUID_V4_PATTERN.test(value)) {
      this.sessionUetrs.add(value);
    }
  }

  /**
   * Remove a UETR from tracking (e.g. when a message tab is reset).
   */
  unregister(value: string): void {
    this.sessionUetrs.delete(value);
  }

  /** Check whether the value is only known to one specific owner */
  private _isOnlyOwner(value: string, owner?: string): boolean {
    // For simplicity we rely on the caller understanding the context;
    // the Set prevents cross-message duplicates at generation time.
    return false;
  }

  /** Produce a raw UUID v4 string using crypto.getRandomValues */
  private _generateRaw(): string {
    // Use crypto API for randomness
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version = 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant = 10xx
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
