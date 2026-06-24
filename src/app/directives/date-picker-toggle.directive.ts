import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2 } from '@angular/core';

/**
 * Makes the native date/datetime-local calendar icon a real toggle.
 *
 * Chromium quirk: clicking the native indicator while the picker is open
 * light-dismisses it (on pointerdown) and the same click reopens it — it
 * blinks instead of closing. There's no API to close a native picker, and
 * suppressing the reopen via preventDefault is unreliable across versions.
 *
 * So we hide the native indicator and own the interaction: a button drives
 * showPicker() to open. Clicking that button while open dismisses the picker
 * (its pointerdown is an outside-click) and we simply don't reopen — a clean
 * toggle. Open-state is synced closed on value change and on any outside click.
 */
let stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const s = document.createElement('style');
    s.textContent = `
.dpt-parent{position:relative}
.dpt-host::-webkit-calendar-picker-indicator{display:none!important}
.dpt-btn{position:absolute;display:flex;align-items:center;justify-content:center;padding:0;margin:0;border:0;background:transparent;color:inherit;cursor:pointer;opacity:.6;z-index:2}
.dpt-btn:hover{opacity:1}
.dpt-btn svg{width:16px;height:16px;pointer-events:none}`;
    document.head.appendChild(s);
}

const CAL_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
    '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>' +
    '<line x1="3" y1="10" x2="21" y2="10"/></svg>';

const BTN_W = 30;

@Directive({
    selector: 'input[type=date], input[type=datetime-local]',
    standalone: true
})
export class DatePickerToggleDirective implements AfterViewInit, OnDestroy {
    private open = false;
    private btn?: HTMLButtonElement;
    private cleanup: (() => void)[] = [];

    constructor(private el: ElementRef<HTMLInputElement>, private r: Renderer2) {}

    ngAfterViewInit() {
        const input = this.el.nativeElement;
        // ponytail: no controllable picker (old browser) → leave the native behavior untouched.
        if (typeof input.showPicker !== 'function') return;
        const parent = input.parentElement;
        if (!parent) return;

        injectStyles();
        parent.classList.add('dpt-parent');
        input.classList.add('dpt-host');
        // ponytail: reserve the indicator's space for our button (fixed inset, matches BTN_W).
        input.style.paddingRight = (BTN_W + 4) + 'px';

        const btn = this.r.createElement('button') as HTMLButtonElement;
        btn.type = 'button';
        btn.tabIndex = -1;
        btn.className = 'dpt-btn';
        btn.setAttribute('aria-label', 'Toggle calendar');
        btn.innerHTML = CAL_SVG;
        this.btn = btn;
        this.r.appendChild(parent, btn);
        this.reposition();

        this.cleanup.push(this.r.listen(btn, 'click', () => this.toggle()));
        this.cleanup.push(this.r.listen(input, 'mouseenter', () => this.reposition()));
        this.cleanup.push(this.r.listen(input, 'change', () => (this.open = false)));
        this.cleanup.push(this.r.listen('window', 'resize', () => this.reposition()));
        // Picker dismissed by clicking elsewhere in the page → keep our flag honest.
        this.cleanup.push(this.r.listen('document', 'pointerdown', (e: Event) => {
            if (e.target !== this.btn && e.target !== input) this.open = false;
        }));
    }

    private reposition() {
        const input = this.el.nativeElement, btn = this.btn;
        if (!btn || !input.offsetParent) return; // hidden (e.g. inactive tab)
        btn.style.left = (input.offsetLeft + input.offsetWidth - BTN_W) + 'px';
        btn.style.top = input.offsetTop + 'px';
        btn.style.height = input.offsetHeight + 'px';
        btn.style.width = BTN_W + 'px';
    }

    private toggle() {
        const input = this.el.nativeElement;
        if (this.open) { this.open = false; return; } // this click already dismissed it; don't reopen
        try { input.showPicker(); this.open = true; } catch { /* not allowed yet */ }
    }

    ngOnDestroy() {
        this.cleanup.forEach(fn => fn());
        this.btn?.remove();
    }
}
