/**
 * AI Inspector — Real-Time PII Monitor
 * Scans the AI platform's input as the user types (150ms debounce)
 * and shows a hard block modal when PII is detected.
 *
 * Uses MutationObserver to handle SPAs where the input element
 * may be re-created on navigation (ChatGPT, Claude, etc.).
 *
 * ProseMirror fix: observes DOM mutations inside the input element
 * (childList + characterData) since standard 'input' events are
 * not reliably fired by ProseMirror editors.
 */

class RealtimeMonitor {
    constructor(piiDetector, platform) {
        this.detector = piiDetector;
        this.platform = platform;
        this._debounceTimer = null;
        this._isModalOpen = false;
        this._lastAllowedFindings = null;
        this._cooldownUntil = 0;
        this._attachedEl = null;
        this._contentObserver = null;

        this._startObserving();
        console.log("[AI Inspector] RealtimeMonitor initialized for", platform.name);
    }

    // ═══════════════════════════════════════════════════════════
    // Persistent DOM observer — watches for input element
    // appearing / re-appearing after SPA navigation
    // ═══════════════════════════════════════════════════════════

    _startObserving() {
        this._tryAttach();

        const domObserver = new MutationObserver(() => this._tryAttach());
        domObserver.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    _tryAttach() {
        const el = findInputElement(this.platform);
        if (!el || el === this._attachedEl) return;

        if (this._attachedEl) this._detach();
        this._attach(el);
    }

    _attach(el) {
        if (el.__aiRealtimeBound) return;
        el.__aiRealtimeBound = true;
        this._attachedEl = el;

        const handler = this._onInput.bind(this);
        el.addEventListener("input", handler, true);
        el.addEventListener("keyup", handler, true);

        // ProseMirror fix: observe DOM mutations inside the input
        if (el.hasAttribute("contenteditable")) {
            this._contentObserver = new MutationObserver(() => this._onInput());
            this._contentObserver.observe(el, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }

        console.log("[AI Inspector] Real-time listener attached to", el.tagName, el.id || el.className);
    }

    _detach() {
        const el = this._attachedEl;
        if (!el) return;
        el.__aiRealtimeBound = false;
        if (this._contentObserver) {
            this._contentObserver.disconnect();
            this._contentObserver = null;
        }
        this._attachedEl = null;
    }

    // ═══════════════════════════════════════════════════════════
    // Debounced scan (150ms)
    // ═══════════════════════════════════════════════════════════

    _onInput() {
        if (this._isModalOpen || Date.now() < this._cooldownUntil) return;
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this._scan(), 150);
    }

    async _scan() {
        if (this._isModalOpen || Date.now() < this._cooldownUntil) return;

        const el = findInputElement(this.platform);
        const text = getElementText(el);
        if (!text.trim()) { this._lastAllowedFindings = null; return; }

        const findings = this.detector.detect(text);
        if (findings.length === 0) { this._lastAllowedFindings = null; return; }

        // Skip if user already allowed these same PII types
        if (this._lastAllowedFindings) {
            const newTypes = findings.map(f => f.name).sort().join(",");
            const oldTypes = this._lastAllowedFindings.sort().join(",");
            if (newTypes === oldTypes) return;
        }

        this._isModalOpen = true;
        console.log("[AI Inspector] REAL-TIME PII detected:", findings.map(f => f.name));

        const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");

        this._isModalOpen = false;
        this._cooldownUntil = Date.now() + 500;

        if (!proceed) {
            redactPII(el, text, findings);
            this._lastAllowedFindings = null;
            this._report("realtime_blocked", findings);
        } else {
            this._lastAllowedFindings = findings.map(f => f.name);
            this._report("realtime_allowed", findings);
        }
    }

    _report(type, findings) {
        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport(type, "realtime", findings);
        }
    }
}
