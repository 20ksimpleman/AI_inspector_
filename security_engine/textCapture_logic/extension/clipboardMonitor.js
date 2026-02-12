/**
 * AI Inspector — Clipboard Monitor
 * Monitors paste (hard block on AI platforms) and copy (soft warning) events.
 */

class ClipboardMonitor {
    constructor(piiDetector) {
        this.detector = piiDetector;
        this.init();
    }

    init() {
        // Paste — high priority: block PII being pasted into AI platforms
        document.addEventListener("paste", this._handlePaste.bind(this), true);

        // Copy — medium priority: warn when copying PII
        document.addEventListener("copy", this._handleCopy.bind(this), true);

        console.log("[AI Inspector] ClipboardMonitor initialized");
    }

    // ── Paste interception ──────────────────────────────────────

    async _handlePaste(event) {
        // Only block paste on AI platforms
        if (!this._isAIPlatform()) return;

        // Bypass flag — let re-dispatched pastes through
        if (this._bypassNextPaste) {
            this._bypassNextPaste = false;
            return;
        }

        const clipboardText = event.clipboardData
            ? event.clipboardData.getData("text")
            : "";

        if (!clipboardText.trim()) return;

        const findings = this.detector.detect(clipboardText);
        if (findings.length === 0) return;

        // Find the contenteditable root BEFORE the modal steals focus.
        // event.target may be a <p> child inside ProseMirror — walk up.
        let editableEl = this._findEditableRoot(event.target);

        event.preventDefault();
        event.stopPropagation();

        const proceed = await AIInspectorAlert.showBlockModal(findings, "paste");

        if (proceed) {
            await this._insertText(editableEl, clipboardText);
            this._reportEvent("paste_allowed", findings);
        } else {
            this._reportEvent("paste_blocked", findings);
        }
    }

    /**
     * Walk up from the event target to find the contenteditable root or
     * the platform's known input element.
     */
    _findEditableRoot(target) {
        // Walk up to find the contenteditable ancestor
        let el = target;
        while (el && el !== document.body) {
            if (el.getAttribute("contenteditable") === "true") return el;
            if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el;
            el = el.parentElement;
        }

        // Fallback: find via platform selector
        const platform = detectPlatform();
        if (platform) {
            const candidates = document.querySelectorAll(platform.inputSelector);
            for (const c of candidates) {
                if (c.offsetParent === null && c.tagName === 'TEXTAREA') continue;
                try { if (getComputedStyle(c).display === 'none') continue; } catch (e) { continue; }
                return c;
            }
        }
        return target;
    }

    /**
     * Insert text into the target element after the modal closes.
     * Uses multiple strategies with fallbacks for ProseMirror compatibility.
     */
    async _insertText(el, text) {
        if (!el) return;

        // 1. Restore focus
        el.focus();

        // 2. Wait for ProseMirror to process the focus event
        await new Promise(r => setTimeout(r, 100));

        if (el.getAttribute("contenteditable") === "true") {
            // 3a. Position cursor at end of content
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);  // collapse to end
            sel.removeAllRanges();
            sel.addRange(range);

            // 3b. Insert via execCommand (ProseMirror's input pipeline)
            const success = document.execCommand("insertText", false, text);

            if (!success) {
                // Fallback: dispatch InputEvent (works in some editors)
                el.dispatchEvent(new InputEvent("beforeinput", {
                    inputType: "insertFromPaste",
                    data: text,
                    bubbles: true,
                    cancelable: true,
                }));
            }
        } else if (el.value !== undefined) {
            // Standard textarea / input
            const start = el.selectionStart || 0;
            const end = el.selectionEnd || 0;
            el.value = el.value.slice(0, start) + text + el.value.slice(end);
            el.selectionStart = el.selectionEnd = start + text.length;
            el.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    // ── Copy warning ────────────────────────────────────────────

    _handleCopy(event) {
        const selection = window.getSelection().toString();
        if (!selection.trim()) return;

        const findings = this.detector.detect(selection);
        if (findings.length === 0) return;

        // Soft warning — don't block the copy
        AIInspectorAlert.showToast(
            `Warning: Copying sensitive data (${findings.map(f => f.name).join(", ")})`,
            4000
        );
        this._reportEvent("copy_warned", findings);
    }

    // ── Helpers ─────────────────────────────────────────────────

    _isAIPlatform() {
        return detectPlatform() !== null;
    }

    _reportEvent(type, findings) {
        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport(type, "clipboard", findings);
        }
    }
}
