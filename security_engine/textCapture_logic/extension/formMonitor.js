/**
 * AI Inspector — Form Submission Monitor
 * Intercepts native HTML form submissions to detect PII leaks.
 *
 * NOTE: fetch() and XHR interception was removed — content scripts run in
 * an isolated JS world and cannot override the PAGE's window.fetch.
 * Real page-world interception is handled by pageScript.js (injected via script.src).
 */

class FormMonitor {
    constructor(piiDetector) {
        this.detector = piiDetector;
        this.init();
    }

    init() {
        // Intercept native form submissions
        document.addEventListener("submit", this._handleSubmit.bind(this), true);

        console.log("[AI Inspector] FormMonitor initialized");
    }

    // ── Native form submit ──────────────────────────────────────

    async _handleSubmit(event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;

        const formData = new FormData(form);
        const piiFields = [];

        for (const [name, value] of formData.entries()) {
            if (typeof value !== "string") continue;
            const findings = this.detector.detect(value);
            if (findings.length > 0) {
                piiFields.push({ field: name, findings });
            }
        }

        if (piiFields.length === 0) return;

        event.preventDefault();
        event.stopPropagation();

        // Flatten findings for the modal
        const allFindings = piiFields.flatMap((f) =>
            f.findings.map((finding) => ({
                ...finding,
                name: `${finding.name} (field: ${f.field})`,
            }))
        );

        const proceed = await AIInspectorAlert.showBlockModal(allFindings, "form");

        if (proceed) {
            // Re-submit programmatically — bypass our own listener
            form.removeEventListener("submit", this._handleSubmit);
            form.submit();
        } else {
            this._reportEvent("form_blocked", allFindings);
        }
    }

    // ── Reporting ───────────────────────────────────────────────

    _reportEvent(type, findings) {
        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport(type, "form", findings);
        }
    }
}
