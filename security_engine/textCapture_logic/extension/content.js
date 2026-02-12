/**
 * AI Inspector — Content Script Orchestrator
 * Initializes all detection modules on each page.
 *
 * REWRITTEN: Fixed multiple blocking flaws:
 * 1. Intercepts BOTH Enter key AND submit button clicks
 * 2. Uses MutationObserver to watch for dynamically loaded submit buttons
 * 3. Reads contenteditable divs correctly (innerText, not value)
 * 4. Hooks into fetch() to catch the actual API call as last-resort defense
 * 5. Periodically scans input for PII and shows inline warnings
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
            console.log(`[AI Inspector] Platform detected: ${platform.name} ${platform.icon}`);
        } else {
            console.log("[AI Inspector] Not on a known AI platform — monitoring form/clipboard/URL only");
        }

        // ── AI Platform interception ────────────────────────────
        if (platform) {
            setupKeyboardInterception(detector, platform);
            setupButtonInterception(detector, platform);
            setupFetchInterception(detector, platform);

            // LAYER 0: Real-time scan while typing (150ms debounce, hard block modal)
            try { new RealtimeMonitor(detector, platform); } catch (e) { console.warn("[AI Inspector] RealtimeMonitor init error:", e); }
        }

        // ── Initialize monitoring modules ───────────────────────
        try { new FormMonitor(detector); } catch (e) { console.warn("[AI Inspector] FormMonitor init error:", e); }
        try { new ClipboardMonitor(detector); } catch (e) { console.warn("[AI Inspector] ClipboardMonitor init error:", e); }
        try { new URLScanner(detector); } catch (e) { console.warn("[AI Inspector] URLScanner init error:", e); }

        // ── Expose reporter ─────────────────────────────────────
        window.__aiInspectorReport = reportEvent;
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 1: Keyboard Interception (Enter key)
    // ═══════════════════════════════════════════════════════════
    function setupKeyboardInterception(detector, platform) {
        document.addEventListener("keydown", async function (e) {
            if (e.key !== "Enter" || e.shiftKey) return;

            const text = getInputText(platform);
            if (!text.trim()) return;

            const findings = detector.detect(text);
            if (findings.length > 0) {
                // Block immediately
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                console.log("[AI Inspector] BLOCKED Enter key — PII detected:", findings.map(f => f.name));

                const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");
                if (!proceed) {
                    // User chose cancel — strip only the PII from the input
                    redactPII(platform, findings);
                    reportEvent("prompt_blocked", platform.name, findings);
                } else {
                    reportEvent("prompt_allowed", platform.name, findings);
                    // Re-trigger Enter after user chose to proceed
                    simulateEnter(platform);
                }
            }
        }, true);  // capture phase — fires BEFORE React/page handlers
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 2: Submit Button Interception (click on send button)
    // ═══════════════════════════════════════════════════════════
    function setupButtonInterception(detector, platform) {
        // Watch for clicks on submit buttons using event delegation
        document.addEventListener("click", async function (e) {
            const sendBtn = e.target.closest(platform.submitButton);
            if (!sendBtn) return;

            const text = getInputText(platform);
            if (!text.trim()) return;

            const findings = detector.detect(text);
            if (findings.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                console.log("[AI Inspector] BLOCKED send button click — PII detected:", findings.map(f => f.name));

                const proceed = await AIInspectorAlert.showBlockModal(findings, "prompt");
                if (!proceed) {
                    redactPII(platform, findings);
                    reportEvent("prompt_blocked", platform.name, findings);
                } else {
                    reportEvent("prompt_allowed", platform.name, findings);
                }
            }
        }, true);  // capture phase
    }

    // ═══════════════════════════════════════════════════════════
    // LAYER 3: Fetch Interception (last resort — catch API call)
    // ═══════════════════════════════════════════════════════════
    function setupFetchInterception(detector, platform) {
        // Inject an EXTERNAL script into the PAGE context to intercept fetch
        // (MV3 CSP prohibits inline scripts — must use script.src, not script.textContent)
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("pageScript.js");
        script.onload = () => script.remove();
        document.documentElement.appendChild(script);

        // Listen for the custom event from the page context
        window.addEventListener("__aiInspectorFetchIntercept", function (e) {
            const { text, url } = e.detail;
            const findings = detector.detect(text);
            if (findings.length > 0) {
                console.warn("[AI Inspector] PII detected in outgoing API call:", url, findings.map(f => f.name));
                AIInspectorAlert.showToast(
                    `⚠️ PII detected in outgoing request: ${findings.map(f => f.name).join(', ')}`,
                    5000
                );
                reportEvent("api_pii_warned", platform.name, findings);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    /**
     * Get text from the platform's input — handles both textarea and contenteditable.
     * 
     * ChatGPT (ProseMirror) structure:
     *   <div id="prompt-textarea" contenteditable="true" class="ProseMirror">
     *       <p>line one</p>
     *       <p>line two</p>
     *   </div>
     * 
     * NOTE: There is also a hidden <textarea name="prompt-textarea" style="display:none">
     * which must be skipped — our selectors target the div explicitly.
     */
    function getInputText(platform) {
        // querySelectorAll returns ALL matches; we pick the first VISIBLE one
        const candidates = document.querySelectorAll(platform.inputSelector);
        let el = null;
        for (const candidate of candidates) {
            // Skip hidden elements (like ChatGPT's fallback textarea)
            if (candidate.offsetParent === null && candidate.tagName === 'TEXTAREA') continue;
            if (getComputedStyle(candidate).display === 'none') continue;
            el = candidate;
            break;
        }

        if (!el) {
            // This is normal during SPA page load — the input hasn't rendered yet.
            // The MutationObserver in realtimeMonitor will retry when it appears.
            console.debug("[AI Inspector] Input element not found yet for:", platform.name);
            return "";
        }

        // For contenteditable divs (ChatGPT ProseMirror, Claude, Gemini)
        if (el.hasAttribute("contenteditable")) {
            // ProseMirror wraps each line in <p> tags — collect them for reliable extraction
            const paragraphs = el.querySelectorAll("p");
            if (paragraphs.length > 0) {
                return Array.from(paragraphs)
                    .map(p => p.innerText || p.textContent || "")
                    .join("\n")
                    .trim();
            }
            // Fallback: direct innerText (handles non-ProseMirror contenteditable)
            return (el.innerText || el.textContent || "").trim();
        }

        // For standard textareas / inputs
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
            return (el.value || "").trim();
        }

        // Ultimate fallback
        return (el.innerText || el.textContent || el.value || "").trim();
    }

    /**
     * Remove only the detected PII from the input, leaving the rest intact.
     * Uses Selection API + execCommand('insertText') for contenteditable
     * so ProseMirror processes it as a real user edit.
     */
    function redactPII(platform, findings) {
        // Use same element-finding logic as getInputText (skip hidden elements)
        const candidates = document.querySelectorAll(platform.inputSelector);
        let el = null;
        for (const candidate of candidates) {
            if (candidate.offsetParent === null && candidate.tagName === 'TEXTAREA') continue;
            if (getComputedStyle(candidate).display === 'none') continue;
            el = candidate;
            break;
        }
        if (!el) return;

        let text = getInputText(platform);

        // Strip each matched PII value
        for (const f of findings) {
            if (f.match) {
                text = text.split(f.match).join("");
            }
        }

        // Clean up leftover whitespace
        text = text.replace(/  +/g, " ").trim();

        if (el.hasAttribute("contenteditable")) {
            // ProseMirror-compatible: select all → insertText
            // Direct innerHTML mutation is rejected by ProseMirror's internal model
            el.focus();

            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);

            document.execCommand("insertText", false, text);
        } else {
            el.value = text;
            el.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    /**
     * Simulate pressing Enter to re-send after user chose "Proceed Anyway".
     */
    function simulateEnter(platform) {
        const el = document.querySelector(platform.inputSelector);
        if (!el) return;

        // Brief delay to avoid re-triggering our own listener
        setTimeout(() => {
            // Use the send button if available
            const btn = document.querySelector(platform.submitButton);
            if (btn) {
                btn.click();
            } else {
                el.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "Enter", code: "Enter", keyCode: 13, bubbles: true
                }));
            }
        }, 100);
    }

    // ═══════════════════════════════════════════════════════════
    // Event Reporting (to background service worker)
    // ═══════════════════════════════════════════════════════════
    function reportEvent(type, source, findings) {
        const event = {
            type,
            source,
            findings: findings.map((f) => ({
                name: f.name,
                severity: f.severity,
            })),
            timestamp: new Date().toISOString(),
            url: window.location.href,
        };

        if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.sendMessage
        ) {
            try {
                chrome.runtime.sendMessage({ action: "pii_event", event });
            } catch (e) {
                // Extension context may be invalidated
            }
        }

        // Also log locally
        console.log(`[AI Inspector] Event: ${type} | ${source} |`, findings.map(f => f.name));
    }
})();
