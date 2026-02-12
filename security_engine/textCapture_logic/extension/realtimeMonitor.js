/**
 * AI Inspector — Real-Time PII Monitor
 * Scans the AI platform's input as the user types and shows a hard block
 * modal immediately when PII is detected (150ms debounce).
 *
 * Two options are given (same as clipboard logic):
 *   - "Remove & Cancel" → clears the input
 *   - "Proceed Anyway"  → lets the user keep typing
 *
 * Uses MutationObserver to handle dynamic SPAs (ChatGPT, Claude, etc.)
 * where the input element may be re-created on navigation.
 *
 * FIX: For ProseMirror editors (ChatGPT), the standard 'input' event is
 * NOT reliably fired. We additionally observe DOM mutations inside the
 * input element itself (childList + characterData) to catch every keystroke.
 */

class RealtimeMonitor {
    constructor(piiDetector, platform) {
        this.detector = piiDetector;
        this.platform = platform;
        this._debounceTimer = null;
        this._isModalOpen = false;       // Prevent stacking modals
        this._lastAllowedFindings = null; // Findings that were allowed via "Proceed Anyway"
        this._cooldownUntil = 0;         // Timestamp — suppress scans until this time
        this._attachedEl = null;          // Reference to the currently attached element
        this._contentObserver = null;     // MutationObserver inside the input element

        this._startObserving();

        console.log("[AI Inspector] RealtimeMonitor initialized for", platform.name);
    }

    // ═══════════════════════════════════════════════════════════
    // Main entry: persistent MutationObserver that always watches
    // for the input element appearing/re-appearing in the DOM
    // ═══════════════════════════════════════════════════════════

    _startObserving() {
        // Try immediately
        this._tryAttach();

        // Persistent DOM observer — never disconnects (SPA navigation re-creates elements)
        const domObserver = new MutationObserver(() => {
            this._tryAttach();
        });

        domObserver.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Find and attach to the input element
    // ═══════════════════════════════════════════════════════════

    _tryAttach() {
        const el = this._findInputElement();
        if (!el) return;

        // Already attached to this exact element
        if (el === this._attachedEl) return;

        // Detach from previous element if it changed
        if (this._attachedEl) {
            this._detachFromInput(this._attachedEl);
        }

        this._attachToInput(el);
    }

    _attachToInput(el) {
        if (el.__aiRealtimeBound) return;
        el.__aiRealtimeBound = true;
        this._attachedEl = el;

        // Standard events
        const handler = this._onInput.bind(this);
        el.addEventListener("input", handler, true);
        el.addEventListener("keyup", handler, true);

        // ── ProseMirror fix ──────────────────────────────────────
        // ProseMirror editors (ChatGPT, Claude) update the DOM directly
        // via their own model, which often does NOT fire the standard
        // 'input' event on the contenteditable div. We observe DOM
        // mutations inside the input div itself.
        if (el.hasAttribute("contenteditable")) {
            this._contentObserver = new MutationObserver(() => {
                this._onInput();
            });
            this._contentObserver.observe(el, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }

        console.log("[AI Inspector] Real-time listener attached to",
            el.tagName, el.id || el.className);
    }

    _detachFromInput(el) {
        if (!el) return;
        el.__aiRealtimeBound = false;
        if (this._contentObserver) {
            this._contentObserver.disconnect();
            this._contentObserver = null;
        }
        this._attachedEl = null;
    }

    // ═══════════════════════════════════════════════════════════
    // Input handler — debounced 150ms scan
    // ═══════════════════════════════════════════════════════════

    _onInput() {
        if (this._isModalOpen) return;
        if (Date.now() < this._cooldownUntil) return;  // Post-modal cooldown

        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this._scan(), 150);
    }

    async _scan() {
        if (this._isModalOpen) return;
        if (Date.now() < this._cooldownUntil) return;

        const text = this._getInputText();
        if (!text.trim()) {
            this._lastAllowedFindings = null;
            return;
        }

        const findings = this.detector.detect(text);
        if (findings.length === 0) {
            this._lastAllowedFindings = null;
            return;
        }

        // Don't re-trigger if user already clicked "Proceed Anyway" for these same PII types
        if (this._lastAllowedFindings) {
            const newTypes = findings.map(f => f.name).sort().join(",");
            const allowedTypes = this._lastAllowedFindings.sort().join(",");
            if (newTypes === allowedTypes) return;
        }

        // ── HARD BLOCK: Show modal with Cancel / Proceed ──
        this._isModalOpen = true;

        console.log("[AI Inspector] REAL-TIME PII detected while typing:", findings.map(f => f.name));

        const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");

        this._isModalOpen = false;
        // 500ms cooldown — the overlay removal triggers MutationObserver which
        // would immediately fire a new scan before the DOM settles
        this._cooldownUntil = Date.now() + 500;

        if (!proceed) {
            // User chose "Remove & Cancel" — strip ONLY the PII from the input
            this._redactPII(text, findings);
            this._lastAllowedFindings = null;
            this._reportEvent("realtime_blocked", findings);
        } else {
            // User chose "Proceed Anyway" — remember the PII types so we don't re-trigger
            this._lastAllowedFindings = findings.map(f => f.name);
            this._reportEvent("realtime_allowed", findings);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers — find element, get text, clear input
    // ═══════════════════════════════════════════════════════════

    _findInputElement() {
        const candidates = document.querySelectorAll(this.platform.inputSelector);
        for (const candidate of candidates) {
            if (candidate.offsetParent === null && candidate.tagName === 'TEXTAREA') continue;
            try {
                if (getComputedStyle(candidate).display === 'none') continue;
            } catch (e) { continue; }
            return candidate;
        }
        return null;
    }

    _getInputText() {
        const el = this._findInputElement();
        if (!el) return "";

        if (el.hasAttribute("contenteditable")) {
            // ProseMirror wraps each line in <p> tags
            const paragraphs = el.querySelectorAll("p");
            if (paragraphs.length > 0) {
                return Array.from(paragraphs)
                    .map(p => p.innerText || p.textContent || "")
                    .join("\n")
                    .trim();
            }
            return (el.innerText || el.textContent || "").trim();
        }

        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
            return (el.value || "").trim();
        }

        return (el.innerText || el.textContent || el.value || "").trim();
    }

    /**
     * Strip only the matched PII values from the input text.
     * Uses Selection API + execCommand('insertText') for contenteditable
     * so ProseMirror processes it as a real user edit (direct innerHTML
     * mutation gets rejected by ProseMirror's internal state model).
     */
    _redactPII(originalText, findings) {
        const el = this._findInputElement();
        if (!el) return;

        let cleaned = originalText;

        // Remove each matched PII value
        for (const f of findings) {
            if (f.match) {
                cleaned = cleaned.split(f.match).join("");
            }
        }

        // Clean up extra whitespace
        cleaned = cleaned.replace(/  +/g, " ").trim();

        if (el.hasAttribute("contenteditable")) {
            // ── ProseMirror-compatible edit ──────────────────────
            // 1. Focus the element
            el.focus();

            // 2. Select ALL text inside the contenteditable
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);

            // 3. Replace selection with cleaned text via execCommand
            //    ProseMirror sees this as a real user edit
            document.execCommand("insertText", false, cleaned);
        } else {
            // Standard textarea/input — direct value set works fine
            el.value = cleaned;
            el.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    _reportEvent(type, findings) {
        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport(type, "realtime", findings);
        }
    }
}
