/**
 * AI Inspector — Modern Block Modal (Light & Bright Theme)
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
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: aiInspFadeIn 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
            }

            @keyframes aiInspFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }

            @keyframes aiInspSlideUp {
                from { transform: translateY(16px); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
            }

            .ai-inspector-modal {
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                width: 440px;
                max-width: 90vw;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                animation: aiInspSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                overflow: hidden;
            }

            .ai-inspector-header {
                padding: 24px 24px 0;
                text-align: center;
            }

            .ai-inspector-icon-wrapper {
                width: 48px;
                height: 48px;
                background: #fee2e2;
                color: #ef4444;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
            }

            .ai-inspector-icon-wrapper svg {
                width: 24px;
                height: 24px;
                stroke-width: 2;
            }

            .ai-inspector-title {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
                letter-spacing: -0.01em;
            }

            .ai-inspector-subtitle {
                margin: 8px 0 0;
                font-size: 14px;
                color: #6b7280;
                line-height: 1.5;
            }

            .ai-inspector-body {
                padding: 20px 24px;
            }

            .ai-inspector-findings {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                margin-bottom: 16px;
            }

            .ai-inspector-badge {
                display: inline-flex;
                align-items: center;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #e5e7eb;
            }

            .ai-inspector-badge.critical {
                background: #fef2f2;
                color: #b91c1c;
                border-color: #fca5a5;
            }

            .ai-inspector-badge.high {
                background: #fff7ed;
                color: #c2410c;
                border-color: #fdba74;
            }

            .ai-inspector-match {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
                font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
                font-size: 11px;
                color: #4b5563;
                word-break: break-all;
                max-height: 80px;
                overflow-y: auto;
            }

            .ai-inspector-actions {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 0 24px 24px;
            }

            .ai-inspector-btn {
                width: 100%;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid transparent;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .ai-inspector-btn-primary {
                background: #4f46e5;
                color: #ffffff;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            }

            .ai-inspector-btn-primary:hover {
                background: #4338ca;
            }

            .ai-inspector-btn-secondary {
                background: #ffffff;
                color: #d97706; /* Amber-600 for caution */
                border-color: #e5e7eb;
            }

            .ai-inspector-btn-secondary:hover {
                background: #f9fafb;
                color: #b45309;
            }

            /* ── Toast notification (soft warning) ── */
            .ai-inspector-toast {
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 2147483646;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 16px;
                color: #1f2937;
                font-family: -apple-system, sans-serif;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                display: flex;
                align-items: center;
                gap: 12px;
                animation: aiInspSlideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                max-width: 380px;
            }

            .ai-inspector-toast-icon {
                color: #f59e0b;
                display: flex;
                flex-shrink: 0;
            }

            .ai-inspector-toast.fade-out {
                animation: aiInspFadeOutUp 0.2s ease forwards;
            }

            @keyframes aiInspSlideInRight {
                from { transform: translateX(20px); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
            }

            @keyframes aiInspFadeOutUp {
                to { opacity: 0; transform: translateY(-8px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Icons (SVG) ─────────────────────────────────────────────
    const ICONS = {
        shield: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
        lock: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
        alert: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
    };

    // ── Block Modal ─────────────────────────────────────────────

    let _proceedBypassUntil = 0;

    function showBlockModal(findings, source = "prompt") {
        if (Date.now() < _proceedBypassUntil) {
            console.log("[AI Inspector] Auto-proceeding (bypass active)");
            return Promise.resolve(true);
        }

        injectStyles();

        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "ai-inspector-overlay";

            const sourceLabels = {
                prompt: "AI Prompt",
                paste: "Clipboard Paste",
                form: "Form Submission",
                url: "URL Parameter"
            };
            const sourceText = sourceLabels[source] || "Input";

            const badges = findings.map(f =>
                `<span class="ai-inspector-badge ${f.severity}">${f.name}</span>`
            ).join("");

            const matchPreview = findings.map(f => `${f.name}: ${maskValue(f.match)}`).join("\n");

            overlay.innerHTML = `
                <div class="ai-inspector-modal">
                    <div class="ai-inspector-header">
                        <div class="ai-inspector-icon-wrapper">
                            ${ICONS.lock}
                        </div>
                        <h3 class="ai-inspector-title">Data Leak Prevented</h3>
                        <p class="ai-inspector-subtitle">
                            AI Inspector blocked sensitive data in your ${sourceText}.
                        </p>
                    </div>
                    <div class="ai-inspector-body">
                        <div class="ai-inspector-findings">${badges}</div>
                        <div class="ai-inspector-match">${escapeHtml(matchPreview)}</div>
                    </div>
                    <div class="ai-inspector-actions">
                        <button class="ai-inspector-btn ai-inspector-btn-primary" id="ai-insp-cancel">
                            Secure My Data (Remove PII)
                        </button>
                        <button class="ai-inspector-btn ai-inspector-btn-secondary" id="ai-insp-proceed">
                            I understand the risk, proceed anyway
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Focus primary button
            const cancelBtn = overlay.querySelector("#ai-insp-cancel");
            const proceedBtn = overlay.querySelector("#ai-insp-proceed");
            cancelBtn.focus();

            const cleanup = (result) => {
                if (result) _proceedBypassUntil = Date.now() + 3000;
                overlay.remove();
                resolve(result);
            };

            cancelBtn.addEventListener("click", () => cleanup(false));
            proceedBtn.addEventListener("click", () => cleanup(true));

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

    function showToast(message, duration = 4000) {
        injectStyles();
        const toast = document.createElement("div");
        toast.className = "ai-inspector-toast";
        toast.innerHTML = `
            <div class="ai-inspector-toast-icon">${ICONS.warning}</div>
            <div>${message}</div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("fade-out");
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }

    // ── Helpers ─────────────────────────────────────────────────

    function maskValue(val) {
        if (!val || val.length <= 6) return "***";
        return val.slice(0, 3) + "•".repeat(Math.min(val.length - 6, 8)) + val.slice(-3);
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    return { showBlockModal, showToast };
})();
