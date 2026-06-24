import { Component, AfterViewInit, OnDestroy, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/**
 * Marketing landing page reachable only at /home (intentionally absent from the
 * nav bar). Self-contained: inline-ish template + styles, leans on the global
 * CSS vars in styles.css so it inherits light/dark theming for free.
 *
 * Animations are CSS-only; scroll-reveal is a tiny IntersectionObserver that
 * just toggles a class. No animation library / no new deps.
 * ponytail: one component, stdlib IO over a JS lib — feature copy sourced from
 * the real nav + fix-suggester UI so the demo doesn't oversell.
 */
@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink, MatIconModule],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
})
export class HomeComponent implements AfterViewInit, OnDestroy {
    @ViewChildren('reveal') reveals!: QueryList<ElementRef<HTMLElement>>;
    @ViewChildren('counter') counters!: QueryList<ElementRef<HTMLElement>>;
    private io?: IntersectionObserver;
    private countIo?: IntersectionObserver;

    ngAfterViewInit(): void {
        // Reveal-on-scroll: add .in-view once, then stop observing.
        this.io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add('in-view');
                        this.io!.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.15 },
        );
        this.reveals.forEach((r) => this.io!.observe(r.nativeElement));

        // Count-up numbers when they scroll into view (once each).
        this.countIo = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        this.animateCount(e.target as HTMLElement);
                        this.countIo!.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.6 },
        );
        this.counters.forEach((c) => this.countIo!.observe(c.nativeElement));
    }

    ngOnDestroy(): void {
        this.io?.disconnect();
        this.countIo?.disconnect();
    }

    /** Tween a number from 0 → target over ~1.1s, easing out. */
    private animateCount(el: HTMLElement): void {
        const target = Number(el.dataset['to'] ?? 0);
        const dur = 1100;
        const start = performance.now();
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = String(target);
        };
        requestAnimationFrame(tick);
    }

    // ── Hero "live fix" demo — mirrors the real fix-suggester UI ──────────────
    readonly fixDemo = [
        { code: 'SCHEMA_VAL', conf: 'high', was: '<Ccy>US</Ccy>', now: '<Ccy>USD</Ccy>' },
        { code: 'CBPR_R8', conf: 'high', was: '<BICFI>CHAS</BICFI>', now: '<BICFI>CHASUS33</BICFI>' },
        { code: 'HEADER_VAL', conf: 'low', was: '(missing AppHdr)', now: '<AppHdr> … </AppHdr>' },
    ];

    readonly features = [
        {
            icon: 'auto_fix_high', accent: 'camt', tag: 'AI · Auto-Fix',
            title: 'Intelligent Fix Suggester',
            desc: 'Every error returns a ranked, confidence-scored fix with a Was → Now diff. Apply one at a time, or auto-fix the entire document in a single click.',
            link: '/validate', cta: 'See the AI fix',
        },
        {
            icon: 'verified', accent: 'pacs', tag: 'Validate',
            title: 'Three-Layer Validation',
            desc: 'XSD schema, CBPR+ usage guidelines and cross-element business rules in one pass — SR2025 & SR2026 — with a per-issue, per-layer breakdown.',
            link: '/validate', cta: 'Validate a message',
        },
        {
            icon: 'psychology', accent: 'camt', tag: 'AI · Reasoning',
            title: 'Explains Every Rejection',
            desc: 'No raw schema dumps. Each issue is decoded into plain language, mapped to the exact element path and the rule that tripped it.',
            link: '/validate', cta: 'Try it live',
        },
        {
            icon: 'edit_note', accent: 'pain', tag: 'Generate',
            title: 'Guided Manual Entry',
            desc: 'Form builders for every PACS, PAIN and CAMT type. Field-level hints, BIC lookup and live validation produce error-free test data.',
            link: '/generate', cta: 'Build a message',
        },
        {
            icon: 'sync_alt', accent: 'pacs', tag: 'Convert',
            title: 'MT → MX Converter',
            desc: 'Translate legacy SWIFT MT into ISO 20022 MX with the mappings the network actually expects — no manual re-keying.',
            link: '/mt-to-mx', cta: 'Convert MT',
        },
        {
            icon: 'dynamic_feed', accent: 'pain', tag: 'Bulk',
            title: 'Bulk Generation',
            desc: 'Spin up large, varied sets of compliant messages across families for load, regression and integration testing.',
            link: '/bulk-generate', cta: 'Generate in bulk',
        },
    ];

    readonly stats = [
        { value: 3, suffix: '', label: 'Validation layers' },
        { value: 15, suffix: '+', label: 'Message types' },
        { value: 2, suffix: '', label: 'Standard releases' },
        { value: 1, suffix: '-click', label: 'Auto-fix all' },
    ];

    readonly steps = [
        { n: '01', icon: 'content_paste', title: 'Paste or generate', desc: 'Drop in an MX message, convert an MT, or build one from a guided form.' },
        { n: '02', icon: 'travel_explore', title: 'Validate in 3 layers', desc: 'Schema, CBPR+ and business rules run together against SR2025 or SR2026.' },
        { n: '03', icon: 'auto_fix_high', title: 'AI suggests fixes', desc: 'Each error returns a confidence-scored Was → Now correction.' },
        { n: '04', icon: 'task_alt', title: 'Auto-fix & ship', desc: 'One click rewrites the whole document into a clean, compliant message.' },
    ];

    readonly families = [
        { tag: 'PACS', cls: 'pacs', label: 'Payments Clearing & Settlement', items: 'pacs.002 · 003 · 004 · 008 · 009 · 010' },
        { tag: 'PAIN', cls: 'pain', label: 'Payments Initiation', items: 'pain.001 · 002 · 008' },
        { tag: 'CAMT', cls: 'camt', label: 'Cash Management', items: 'camt.052 · 053 · 054 · 055 · 056 · 057' },
    ];

    // Trust-bar marquee — the standards & rails the validator speaks.
    readonly marquee = [
        'ISO 20022', 'SWIFT MX', 'CBPR+', 'SR2025', 'SR2026',
        'MT → MX', 'XSD Schema', 'AppHdr', 'BIC Directory', 'UETR',
    ];

    // Hero terminal demo lines (rendered with a looping typewriter feel).
    readonly termLines = [
        { t: 'cmd', text: '$ validate pacs.008.001.08.xml' },
        { t: 'err', text: '✗ SCHEMA_VAL   <Ccy>US</Ccy> — invalid currency' },
        { t: 'err', text: '✗ CBPR_R8      <BICFI>CHAS</BICFI> — BIC too short' },
        { t: 'err', text: '✗ HEADER_VAL   AppHdr missing' },
        { t: 'ai', text: '⚡ AI fix suggester analysing 3 issues…' },
        { t: 'ok', text: '✓ USD · CHASUS33 · AppHdr rebuilt' },
        { t: 'done', text: '✓ 3 / 3 resolved — message is COMPLIANT' },
    ];

    // FAQ accordion. -1 = all closed.
    openFaq = 0;
    readonly faqs = [
        {
            q: 'Which standards and message types do you support?',
            a: 'ISO 20022 across PACS, PAIN and CAMT families — pacs.002/003/004/008/009/010, pain.001/002/008 and camt.052–057 — validated against both SR2025 and SR2026, including CBPR+ usage guidelines.',
        },
        {
            q: 'What does the AI fix suggester actually do?',
            a: 'For every error it proposes a concrete correction with a Was → Now diff and a confidence score. High-confidence fixes can be auto-applied; the whole document can be repaired in a single click.',
        },
        {
            q: 'How is a message validated?',
            a: 'Three layers run together: XSD schema validation, CBPR+ usage rules, and cross-element business rules. You get a per-issue, per-layer breakdown rather than a single pass/fail.',
        },
        {
            q: 'Can it convert legacy SWIFT MT messages?',
            a: 'Yes. The MT → MX converter translates legacy MT into ISO 20022 MX using the mappings the network expects, so you do not have to re-key anything by hand.',
        },
    ];

    toggleFaq(i: number): void {
        this.openFaq = this.openFaq === i ? -1 : i;
    }
}
