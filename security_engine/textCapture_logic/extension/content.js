/**
 * AI Inspector — Content Script Orchestrator
 * Initializes all detection modules on each page.
 *
 * Layers:
 *   0. Real-time scan while typing (realtimeMonitor.js)
 *   1. Enter key interception
 *   2. Submit button click interception
 *   3. Fetch API interception (pageScript.js in page world)
 */

(function () {
    "use strict";

    // ── Guard: prevent double injection ─────────────────────────
    if (window.__aiInspectorLoaded) return;
    window.__aiInspectorLoaded = true;

    // Check if monitoring is enabled
    if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("enabled", (data) => {
            if (data.enabled === false) {
                console.log("[AI Inspector] Monitoring disabled by user.");
                return;
            }
            initializeInspector();
        });
    } else {
        initializeInspector();
    }

    function initializeInspector() {
        console.log("[AI Inspector] v2.1 — Content script loaded on", window.location.host);

        const detector = new PIIDetector();
        const platform = detectPlatform();

        if (platform) {
            console.log(`[AI Inspector] Platform detected: ${platform.name}`);
        } else {
            console.log("[AI Inspector] Not on a known AI platform — monitoring form/clipboard/URL only");
        }

        try { new FormMonitor(detector); } catch (e) { console.warn("[AI Inspector] FormMonitor init error:", e); }
        try { new ClipboardMonitor(detector); } catch (e) { console.warn("[AI Inspector] ClipboardMonitor init error:", e); }
        try { new URLScanner(detector); } catch (e) { console.warn("[AI Inspector] URLScanner init error:", e); }

        window.__aiInspectorReport = reportEvent;
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 1: Enter Key Interception
    // ═══════════════════════════════════════════════════════════
    function setupKeyboardInterception(detector, platform) {
        document.addEventListener("keydown", async function (e) {
            if (e.key !== "Enter" || e.shiftKey) return;

            const el = findInputElement(platform);
            const text = getElementText(el);
            if (!text.trim()) return;

            const findings = detector.detect(text);
            if (findings.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                console.log("[AI Inspector] BLOCKED Enter — PII:", findings.map(f => f.name));

                const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");
                if (!proceed) {
                    redactPII(el, text, findings);
                    reportEvent("prompt_blocked", platform.name, findings);
                } else {
                    reportEvent("prompt_allowed", platform.name, findings);
                    simulateEnter(platform);
                }
            }
        }, true);
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 2: Submit Button Click Interception
    // ═══════════════════════════════════════════════════════════
    function setupButtonInterception(detector, platform) {
        document.addEventListener("click", async function (e) {
            if (!e.target.closest(platform.submitButton)) return;

            const el = findInputElement(platform);
            const text = getElementText(el);
            if (!text.trim()) return;

            const findings = detector.detect(text);
            if (findings.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                console.log("[AI Inspector] BLOCKED send button — PII:", findings.map(f => f.name));

                const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");
                if (!proceed) {
                    redactPII(el, text, findings);
                    reportEvent("prompt_blocked", platform.name, findings);
                } else {
                    reportEvent("prompt_allowed", platform.name, findings);
                }
            }
        }, true);
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 3: Fetch Interception (page-world script)
    // ═══════════════════════════════════════════════════════════
    function setupFetchInterception(detector, platform) {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("pageScript.js");
        script.onload = () => script.remove();
        document.documentElement.appendChild(script);

        window.addEventListener("__aiInspectorFetchIntercept", function (e) {
            const { text, url } = e.detail;
            const findings = detector.detect(text);
            if (findings.length > 0) {
                console.warn("[AI Inspector] PII in outgoing API call:", url, findings.map(f => f.name));
                AIInspectorAlert.showToast(
                    `PII detected in outgoing request: ${findings.map(f => f.name).join(", ")}`,
                    5000
                );
                reportEvent("api_pii_warned", platform.name, findings);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    function simulateEnter(platform) {
        setTimeout(() => {
            const btn = document.querySelector(platform.submitButton);
            if (btn) {
                btn.click();
            } else {
                const el = findInputElement(platform);
                if (el) {
                    el.dispatchEvent(new KeyboardEvent("keydown", {
                        key: "Enter", code: "Enter", keyCode: 13, bubbles: true,
                    }));
                }
            }
        }, 100);
    }

    function reportEvent(type, source, findings) {
        const event = {
            type, source,
            findings: findings.map(f => ({ name: f.name, severity: f.severity })),
            timestamp: new Date().toISOString(),
            url: window.location.href,
        };

        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            try { chrome.runtime.sendMessage({ action: "pii_event", event }); } catch (e) { /* context invalidated */ }
        }

        console.log(`[AI Inspector] Event: ${type} | ${source} |`, findings.map(f => f.name));
    }
})();
