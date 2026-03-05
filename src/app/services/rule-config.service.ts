import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type RuleSet = 'SR2025' | 'SR2026';

/**
 * Simple configuration service that holds the currently selected rule set.
 * The value is persisted in localStorage so it survives page reloads.
 */
@Injectable({
    providedIn: 'root'
})
export class RuleConfigService {
    private readonly storageKey = 'selectedRuleSet';
    private ruleSetSubject = new BehaviorSubject<RuleSet>(this.loadFromStorage());

    /** Observable for components to react to changes */
    ruleSet$ = this.ruleSetSubject.asObservable();

    /** Get current rule set synchronously */
    get selectedRuleSet(): RuleSet {
        return this.ruleSetSubject.value;
    }

    /** Change the rule set and persist */
    setRuleSet(set: RuleSet): void {
        this.ruleSetSubject.next(set);
        localStorage.setItem(this.storageKey, set);
    }

    private loadFromStorage(): RuleSet {
        const stored = localStorage.getItem(this.storageKey);
        return stored === 'SR2026' ? 'SR2026' : 'SR2025'; // default SR2025
    }
}
