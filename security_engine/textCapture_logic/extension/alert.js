/**
 * AI Inspector — Modern Block Modal
 * Shows a premium styled modal when PII is detected, with Proceed / Cancel options.
 * Returns a Promise<boolean> — true if user chose to proceed, false if cancelled.
 */

const AIInspectorAlert = (() => {
    // ── Inject styles once ──────────────────────────────────────
    const STYLE_ID = "ai-inspector-alert-styles";

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .ai-inspector-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: aiInspFadeIn 0.2s ease;
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            @keyframes aiInspFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }

            @keyframes aiInspSlideUp {
                from { transform: translateY(24px); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
            }

            .ai-inspector-modal {
                background: #1a1a2e;
                border: 1px solid rgba(255, 75, 75, 0.4);
                border-radius: 16px;
                width: 480px;
                max-width: 92vw;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 75, 75, 0.15);
                animation: aiInspSlideUp 0.25s ease;
                overflow: hidden;
            }

            .ai-inspector-header {
                background: linear-gradient(135deg, #ff4b4b 0%, #cc2936 100%);
                padding: 20px 24px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .ai-inspector-shield {
                width: 40px;
                height: 40px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
            }

            .ai-inspector-header-text h3 {
                margin: 0;
                color: #fff;
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 0.3px;
            }

            .ai-inspector-header-text p {
                margin: 4px 0 0;
                color: rgba(255, 255, 255, 0.8);
                font-size: 12px;
            }

            .ai-inspector-body {
                padding: 20px 24px;
            }

            .ai-inspector-body p {
                color: #b0b0cc;
                font-size: 13px;
                margin: 0 0 14px;
                line-height: 1.5;
            }

            .ai-inspector-findings {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 18px;
            }

            .ai-inspector-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.2px;
            }

            .ai-inspector-badge.critical {
                background: rgba(255, 50, 50, 0.15);
                color: #ff6b6b;
                border: 1px solid rgba(255, 50, 50, 0.3);
            }

            .ai-inspector-badge.high {
                background: rgba(255, 150, 50, 0.15);
                color: #ffaa5b;
                border: 1px solid rgba(255, 150, 50, 0.3);
            }

            .ai-inspector-badge.medium {
                background: rgba(255, 220, 50, 0.12);
                color: #f0d060;
                border: 1px solid rgba(255, 220, 50, 0.25);
            }

            .ai-inspector-match {
                background: #12121f;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                padding: 10px 14px;
                margin-bottom: 18px;
                font-family: 'Cascadia Code', 'Fira Code', monospace;
                font-size: 12px;
                color: #ff6b6b;
                word-break: break-all;
                max-height: 80px;
                overflow-y: auto;
            }

            .ai-inspector-actions {
                display: flex;
                gap: 10px;
                padding: 0 24px 20px;
            }

            .ai-inspector-btn {
                flex: 1;
                padding: 11px 0;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
                border: none;
                letter-spacing: 0.3px;
            }

            .ai-inspector-btn-cancel {
                background: linear-gradient(135deg, #ff4b4b 0%, #cc2936 100%);
                color: #fff;
            }

            .ai-inspector-btn-cancel:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(255, 75, 75, 0.35);
            }

            .ai-inspector-btn-proceed {
                background: rgba(255, 255, 255, 0.06);
                color: #888;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .ai-inspector-btn-proceed:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #aaa;
            }

            /* ── Toast notification (for soft warnings) ── */
            .ai-inspector-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2147483646;
                background: #1a1a2e;
                border: 1px solid rgba(255, 170, 91, 0.4);
                border-radius: 12px;
                padding: 14px 20px;
                color: #ffaa5b;
                font-family: 'Segoe UI', -apple-system, sans-serif;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
                animation: aiInspSlideUp 0.25s ease;
                max-width: 360px;
            }

            .ai-inspector-toast.fade-out {
                animation: aiInspFadeOut 0.3s ease forwards;
            }

            @keyframes aiInspFadeOut {
                to { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Block Modal ─────────────────────────────────────────────

    /**
     * Show a blocking modal with PII findings.
     * @param {Array<{name: string, match: string, severity: string}>} findings
     * @param {string} [source="prompt"] — what triggered it (prompt | paste | form | url)
     * @returns {Promise<boolean>} — true if user chose "Proceed Anyway"
     */
    // ── Global bypass timer ─────────────────────────────────────
    // When "Proceed Anyway" is clicked, ALL modal calls from any layer
    // auto-resolve as true for 3 seconds. This prevents the cascade where
    // real-time, keyboard, and button layers each show their own modal.
    let _proceedBypassUntil = 0;

    function showBlockModal(findings, source = "prompt") {
        // If user recently clicked "Proceed Anyway", auto-allow for 3s
        if (Date.now() < _proceedBypassUntil) {
            console.log("[AI Inspector] Auto-proceeding (bypass active)");
            return Promise.resolve(true);
        }

        injectStyles();

        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "ai-inspector-overlay";

            const sourceLabel = {
                prompt: "AI Prompt Submission",
                paste: "Clipboard Paste",
                form: "Form Submission",
                url: "URL Parameters",
            }[source] || "Input";

            const badges = findings
                .map(
                    (f) =>
                        `<span class="ai-inspector-badge ${f.severity}">${f.name}</span>`
                )
                .join("");

            const matchPreview = findings
                .map((f) => `${f.name}: ${maskValue(f.match)}`)
                .join("\n");

            overlay.innerHTML = `
                <div class="ai-inspector-modal">
                    <div class="ai-inspector-header">
                        <div class="ai-inspector-shield">🛡️</div>
                        <div class="ai-inspector-header-text">
                            <h3>Data Leak Prevention — Blocked</h3>
                            <p>AI Inspector detected sensitive data in ${sourceLabel}</p>
                        </div>
                    </div>
                    <div class="ai-inspector-body">
                        <p>The following PII types were detected and the action has been blocked to protect your data:</p>
                        <div class="ai-inspector-findings">${badges}</div>
                        <div class="ai-inspector-match">${escapeHtml(matchPreview)}</div>
                    </div>
                    <div class="ai-inspector-actions">
                        <button class="ai-inspector-btn ai-inspector-btn-cancel" id="ai-insp-cancel">✕  Remove &amp; Cancel</button>
                        <button class="ai-inspector-btn ai-inspector-btn-proceed" id="ai-insp-proceed">Proceed Anyway →</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const cleanup = (result) => {
                if (result) {
                    // "Proceed Anyway" — set 3-second bypass for ALL layers
                    _proceedBypassUntil = Date.now() + 3000;
                }
                overlay.remove();
                resolve(result);
            };

            overlay.querySelector("#ai-insp-cancel").addEventListener("click", () => cleanup(false));
            overlay.querySelector("#ai-insp-proceed").addEventListener("click", () => cleanup(true));

            // Close on Escape key
            const onKey = (e) => {
                if (e.key === "Escape") {
                    document.removeEventListener("keydown", onKey, true);
                    cleanup(false);
                }
            };
            document.addEventListener("keydown", onKey, true);
        });
    }

    // ── Toast notification (soft warning) ───────────────────────

    /**
     * Show a brief non-blocking toast notification.
     * @param {string} message
     * @param {number} [duration=4000]
     */
    function showToast(message, duration = 4000) {
        injectStyles();
        const toast = document.createElement("div");
        toast.className = "ai-inspector-toast";
        toast.textContent = `🛡️ ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("fade-out");
            setTimeout(() => toast.remove(), 350);
        }, duration);
    }

    // ── Legacy compatibility ────────────────────────────────────

    /**
     * Legacy blockSubmission — wraps the new modal.
     */
    function blockSubmission(event, findings) {
        event.preventDefault();
        event.stopPropagation();

        const converted = findings.map((name) =>
            typeof name === "string"
                ? { name, match: "***", severity: "high" }
                : name
        );
        showBlockModal(converted, "prompt");
    }

    // ── Helpers ─────────────────────────────────────────────────

    function maskValue(val) {
        if (!val || val.length <= 6) return "***";
        return val.slice(0, 3) + "•".repeat(Math.min(val.length - 6, 12)) + val.slice(-3);
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Public API ──────────────────────────────────────────────
    return { showBlockModal, showToast, blockSubmission };
})();
