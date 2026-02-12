/**
 * AI Inspector — URL Parameter Scanner
 * Scans URL query parameters, path segments, and hash fragments for PII.
 * Monitors SPA navigation via hashchange / popstate events.
 */

class URLScanner {
    constructor(piiDetector) {
        this.detector = piiDetector;
        this._scannedURLs = new Set();
        this._init();
    }

    _init() {
        // Scan current URL
        this.scanURL(window.location.href);

        // SPA navigation
        window.addEventListener("hashchange", () => this.scanURL(window.location.href));
        window.addEventListener("popstate", () => this.scanURL(window.location.href));

        console.log("[AI Inspector] URLScanner initialized");
    }

    scanURL(url) {
        if (this._scannedURLs.has(url)) return;
        this._scannedURLs.add(url);

        // Keep memory bounded (max 500 URLs)
        if (this._scannedURLs.size > 500) {
            this._scannedURLs.delete(this._scannedURLs.values().next().value);
        }

        try {
            const urlObj = new URL(url);
            const findings = [];

            // Query parameters
            for (const [key, value] of urlObj.searchParams.entries()) {
                const pii = this.detector.detect(value);
                if (pii.length > 0) findings.push({ location: `?${key}`, piiTypes: pii });

                const keyPii = this.detector.detect(key);
                if (keyPii.length > 0) findings.push({ location: `?${key} (name)`, piiTypes: keyPii });
            }

            // Path segments (skip short ones like "v1", "api")
            for (const seg of urlObj.pathname.split("/").filter(s => s.length >= 5)) {
                const pii = this.detector.detect(decodeURIComponent(seg));
                if (pii.length > 0) findings.push({ location: `/${seg}`, piiTypes: pii });
            }

            // Hash fragment
            if (urlObj.hash.length > 1) {
                const hashPii = this.detector.detect(decodeURIComponent(urlObj.hash.slice(1)));
                if (hashPii.length > 0) findings.push({ location: "#fragment", piiTypes: hashPii });
            }

            if (findings.length > 0) this._alert(url, findings);
        } catch (e) { /* invalid URL */ }
    }

    _alert(url, findings) {
        const allPii = findings.flatMap(f => f.piiTypes);
        const summary = findings.map(f => `${f.location}: ${f.piiTypes.map(p => p.name).join(", ")}`).join(" | ");

        console.warn(`[AI Inspector] ⚠️ PII in URL:\n  ${url}\n  ${summary}`);
        AIInspectorAlert.showToast(`PII found in URL: ${allPii.map(p => p.name).join(", ")}`, 5000);

        if (typeof window.__aiInspectorReport === "function") {
            window.__aiInspectorReport("url_pii_detected", "url", allPii);
        }
    }
}
