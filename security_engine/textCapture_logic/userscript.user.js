// ==UserScript==
// @name         AI Inspector — PII Data Leak Prevention
// @description  Intercepts PII leaks across major AI platforms
// @version      2.0.0
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://www.perplexity.ai/*
// @match        https://copilot.microsoft.com/*
// @match        https://*/*
// @require      regex.js
// @require      platformDetector.js
// @require      alert.js
// @require      formMonitor.js
// @require      clipboardMonitor.js
// @require      urlScanner.js
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    console.log("[AI Inspector] v2.0 — Loaded");

    // ── Initialize core detector ────────────────────────────────
    const detector = new PIIDetector();
    const platform = detectPlatform();

    if (platform) {
        console.log(`[AI Inspector] Detected platform: ${platform.name} ${platform.icon}`);
    }

    // ── AI Platform keydown interception ─────────────────────────
    // Only active on recognized AI platforms
    if (platform) {
        document.addEventListener("keydown", async function (e) {
            if (e.key !== "Enter" || e.shiftKey) return;

            const input = document.querySelector(platform.inputSelector);
            if (!input) return;

            const text = input.value || input.innerText || input.textContent || "";
            if (!text.trim()) return;

            const findings = detector.detect(text);

            if (findings.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");

                if (!proceed) {
                    console.log("[AI Inspector] Submission blocked by user.");
                    reportEvent("prompt_blocked", platform.name, findings);
                } else {
                    console.log("[AI Inspector] User chose to proceed.");
                    reportEvent("prompt_allowed", platform.name, findings);
                }
            }
        }, true);
    }

    // ── Initialize monitoring modules ──────────────────────────
    const formMonitor = new FormMonitor(detector);
    const clipboardMonitor = new ClipboardMonitor(detector);
    const urlScanner = new URLScanner(detector);

    // ── Prompt logging (legacy) ─────────────────────────────────
    if (platform) {
        document.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                const input = document.querySelector(platform.inputSelector);
                if (!input) return;

                const text = input.value || input.innerText || "";
                if (!text.trim()) return;

                const log = {
                    time: new Date().toISOString(),
                    platform: platform.name,
                    prompt: text,
                };

                // Store locally
                let logs = JSON.parse(localStorage.getItem("ai_inspector_logs") || "[]");
                logs.push(log);
                // Keep last 500 entries
                if (logs.length > 500) logs = logs.slice(-500);
                localStorage.setItem("ai_inspector_logs", JSON.stringify(logs));
            }
        });
    }

    // ── Event reporting ─────────────────────────────────────────
    function reportEvent(type, source, findings) {
        const event = {
            type,
            source,
            findings: findings.map(f => ({ name: f.name, severity: f.severity })),
            timestamp: new Date().toISOString(),
            url: window.location.href,
        };

        // Store in localStorage for the popup / dashboard
        let events = JSON.parse(localStorage.getItem("ai_inspector_events") || "[]");
        events.push(event);
        if (events.length > 200) events = events.slice(-200);
        localStorage.setItem("ai_inspector_events", JSON.stringify(events));

        // If running as extension, report to background script
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "pii_event", event });
        }
    }

    // Expose reportEvent to other modules
    window.__aiInspectorReport = reportEvent;
})();
