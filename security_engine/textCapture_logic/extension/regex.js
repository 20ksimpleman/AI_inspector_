/**
 * AI Inspector — PII Detection Engine
 * Comprehensive regex-based PII detection with example/dummy data exclusion.
 * 
 * FIX: Example exclusion now checks only the MATCHED PII value, not the entire
 * input text. Previously, typing "test@gmail.com" was suppressed because
 * /test@/i matched the whole text — even though it's a real email.
 */

class PIIDetector {
    constructor() {
        this.patterns = [
            // ── Identity Documents ──────────────────────────────────
            { name: "Email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, severity: "high" },
            { name: "Phone Number", regex: /\b(\+?\d{1,3}[\s-]?)?\d{10}\b/g, severity: "high" },
            { name: "SSN", regex: /\b(?!000|666|9\d{2})\d{3}-\d{2}-\d{4}\b/g, severity: "critical" },
            { name: "Aadhaar", regex: /\b\d{4}\s\d{4}\s\d{4}\b/g, severity: "high" },
            { name: "PAN (India)", regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g, severity: "high" },
            { name: "Passport", regex: /\b[A-Z]\d{7}\b/g, severity: "high" },
            { name: "Driving License", regex: /\b[A-Z]{2}\d{13,14}\b/g, severity: "medium" },
            { name: "Voter ID (India)", regex: /\b[A-Z]{3}\d{7}\b/g, severity: "medium" },

            // ── Financial ───────────────────────────────────────────
            { name: "Credit Card", regex: /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})\b/g, severity: "critical" },
            { name: "IFSC Code", regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g, severity: "medium" },
            { name: "IBAN", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/g, severity: "high" },
            { name: "GSTIN", regex: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g, severity: "medium" },

            // ── Network / Infrastructure ────────────────────────────
            { name: "IP Address", regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, severity: "medium" },
            { name: "MAC Address", regex: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, severity: "medium" },

            // ── API Keys & Secrets ──────────────────────────────────
            { name: "AWS Access Key", regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, severity: "critical" },
            { name: "GitHub Token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b/g, severity: "critical" },
            { name: "OpenAI API Key", regex: /\bsk-[A-Za-z0-9]{48}\b/g, severity: "critical" },
            { name: "Stripe Key", regex: /\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{24,}\b/g, severity: "critical" },
            { name: "Private Key", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },

            // ── Auth Tokens ─────────────────────────────────────────
            { name: "JWT Token", regex: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g, severity: "high" },
            { name: "Bearer Token", regex: /\b[Bb]earer\s+[A-Za-z0-9_\-.]+\b/g, severity: "high" },
            { name: "Password", regex: /\b(?:password|passwd|pwd)\s*(?:is|[:=])\s*["']?[^\s"']{6,}["']?/gi, severity: "critical" },
        ];

        // Patterns that indicate example/dummy data — applied to the MATCHED VALUE only
        this.examplePatterns = [
            /^test@example\.com$/i,
            /^user@example\.(com|org|net)$/i,
            /^admin@example\.com$/i,
            /^example@/i,
            /example\.(?:com|org|net)$/i,
            /^dummy|^sample|^placeholder|^fake/i,
            /^0{3}-0{2}-0{4}$/,             // 000-00-0000
            /^123-45-6789$/,                 // classic example SSN
            /^1234567890$/,                  // dummy phone
            /xxxx/i,
            /\*{4,}/,
            /^your[_-]?(?:api|key)/i,
            /^<[A-Z_]+>$/,
            /^\$\{[^}]+\}$/,
            /^process\.env\.[A-Z_]+$/,
            /^sk-xxx/i,
            /^AKIA[X]{16}$/,                 // dummy AWS key
        ];
    }

    /**
     * Detect PII in text.
     * @param {string} text — input to scan
     * @returns {Array<{name: string, match: string, severity: string}>}
     */
    detect(text) {
        if (!text || !text.trim()) return [];

        const findings = [];
        for (const rule of this.patterns) {
            // Reset regex lastIndex (global flag)
            rule.regex.lastIndex = 0;
            const m = rule.regex.exec(text);
            if (m) {
                const matchedValue = m[0];
                // Check if this specific matched value is example/dummy data
                if (!this._isExampleValue(matchedValue)) {
                    findings.push({
                        name: rule.name,
                        match: matchedValue,
                        severity: rule.severity,
                    });
                }
            }
        }
        return findings;
    }

    /**
     * Quick boolean check — does the text contain any PII?
     */
    hasPII(text) {
        return this.detect(text).length > 0;
    }

    /**
     * Return the highest severity found.
     */
    maxSeverity(findings) {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        let max = 0;
        for (const f of findings) {
            max = Math.max(max, order[f.severity] || 0);
        }
        return Object.entries(order).find(([, v]) => v === max)?.[0] || "low";
    }

    /**
     * Check if a SPECIFIC matched PII value is example/dummy data.
     * This is now checked per-match, NOT on the entire input text.
     * @private
     */
    _isExampleValue(value) {
        return this.examplePatterns.some(p => p.test(value));
    }
}

// Legacy compatibility — expose flat array for userscript
const piiPatterns = new PIIDetector().patterns;
