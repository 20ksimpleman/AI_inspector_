/**
 * AI Inspector — URL Parameter Scanner
 * Scans URL query parameters and path segments for PII.
 * Monitors SPA navigation via History API interception.
 */

class URLScanner {
    constructor(piiDetector) {
        this.detector = piiDetector;
        this._scannedURLs = new Set();
        this.init();
    }

    init() {
        // Scan current URL on load
        this.scanURL(window.location.href);

        // Monitor SPA navigation (pushState / replaceState)
        this._interceptHistoryAPI();

        // Monitor hash changes
        window.addEventListener("hashchange", () => {
            this.scanURL(window.location.href);
        });

        // Monitor popstate (back/forward)
        window.addEventListener("popstate", () => {
            this.scanURL(window.location.href);
        });

        console.log("[AI Inspector] URLScanner initialized");
    }

    // ── URL scanning ────────────────────────────────────────────

    scanURL(url) {
        // Deduplicate — don't scan the same URL twice
        if (this._scannedURLs.has(url)) return;
        this._scannedURLs.add(url);

        // Keep memory bounded
        if (this._scannedURLs.size > 500) {
            const first = this._scannedURLs.values().next().value;
            this._scannedURLs.delete(first);
        }

        try {
            const urlObj = new URL(url);
            const findings = [];

            // Scan query parameters
            for (const [key, value] of urlObj.searchParams.entries()) {
                const pii = this.detector.detect(value);
                if (pii.length > 0) {
                    findings.push({
                        location: `?${key}`,
                        piiTypes: pii,
                    });
                }

                // Also check the key itself
                const keyPii = this.detector.detect(key);
                if (keyPii.length > 0) {
                    findings.push({
                        location: `?${key} (param name)`,
                        piiTypes: keyPii,
                    });
                }
            }

            // Scan path segments
            const pathSegments = urlObj.pathname.split("/").filter(Boolean);
            for (const segment of pathSegments) {
                // Skip very short segments (e.g., "v1", "api")
                if (segment.length < 5) continue;

                const pii = this.detector.detect(decodeURIComponent(segment));
                if (pii.length > 0) {
                    findings.push({
                        location: `/${segment}`,
                        piiTypes: pii,
                    });
                }
            }

            // Scan hash fragment
            if (urlObj.hash.length > 1) {
                const hashContent = decodeURIComponent(urlObj.hash.slice(1));
                const hashPii = this.detector.detect(hashContent);
                if (hashPii.length > 0) {
                    findings.push({
                        location: `#fragment`,
                        piiTypes: hashPii,
                    });
                }
            }

            if (findings.length > 0) {
                this._logAlert(url, findings);
            }
        } catch (e) {
            // Invalid URL — skip silently
        }
    }

    // ── History API interception ────────────────────────────────

    _interceptHistoryAPI() {
        const self = this;
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            const newURL = args[2]
                ? new URL(args[2], window.location.origin).href
                : window.location.href;
            self.scanURL(newURL);
            return result;
        };

        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            const newURL = args[2]
                ? new URL(args[2], window.location.origin).href
                : window.location.href;
            self.scanURL(newURL);
            return result;
        };
    }

    // ── Alerting ────────────────────────────────────────────────

    _logAlert(url, findings) {
        const allPii = findings.flatMap((f) => f.piiTypes);
        const summary = findings
            .map(
                (f) =>
                    `${f.location}: ${f.piiTypes.map((p) => p.name).join(", ")}`
            )
            .join(" | ");

        console.warn(
            `[AI Inspector] ⚠️ PII detected in URL:\n  URL: ${url}\n  ${summary}`
        );

        // Show a toast warning (non-blocking for URL scanning)
        AIInspectorAlert.showToast(
            `PII found in URL parameters: ${allPii.map(p => p.name).join(", ")}`,
            5000
        );

        // Report event
        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport("url_pii_detected", "url", allPii);
        }
    }
}
