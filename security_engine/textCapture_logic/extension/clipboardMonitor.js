/**
 * AI Inspector — Clipboard Monitor
 * Paste: hard block on AI platforms (with Proceed Anyway re-insertion).
 * Copy: soft toast warning.
 */

class ClipboardMonitor {
    constructor(piiDetector) {
        this.detector = piiDetector;
        document.addEventListener("paste", this._handlePaste.bind(this), true);
        document.addEventListener("copy", this._handleCopy.bind(this), true);
        console.log("[AI Inspector] ClipboardMonitor initialized");
    }

    // ── Paste interception ──────────────────────────────────────

    async _handlePaste(event) {
        if (!this._isAIPlatform()) return;

        const clipboardText = event.clipboardData
            ? event.clipboardData.getData("text")
            : "";
        if (!clipboardText.trim()) return;

        const findings = this.detector.detect(clipboardText);
        if (findings.length === 0) return;

        // Save the editable root BEFORE the modal steals focus
        const editableEl = findEditableRoot(event.target);

        event.preventDefault();
        event.stopPropagation();

        const proceed = await AIInspectorAlert.showBlockModal(findings, "paste");

        if (proceed) {
            // Restore focus + insert after a micro-delay for ProseMirror
            if (editableEl) {
                editableEl.focus();
                await new Promise(r => setTimeout(r, 100));
                writeToInput(editableEl, clipboardText, "append");
            }
            this._report("paste_allowed", findings);
        } else {
            this._report("paste_blocked", findings);
        }
    }

    // ── Copy warning ────────────────────────────────────────────

    _handleCopy(event) {
        const selection = window.getSelection().toString();
        if (!selection.trim()) return;

        const findings = this.detector.detect(selection);
        if (findings.length === 0) return;

        AIInspectorAlert.showToast(
            `Warning: Copying sensitive data (${findings.map(f => f.name).join(", ")})`,
            4000
        );
        this._report("copy_warned", findings);
    }

    // ── Helpers ─────────────────────────────────────────────────

    _isAIPlatform() { return detectPlatform() !== null; }

    _report(type, findings) {
        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport(type, "clipboard", findings);
        }
    }
}
