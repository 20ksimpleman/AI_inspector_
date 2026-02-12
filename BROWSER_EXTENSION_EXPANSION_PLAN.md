# Browser Extension Expansion - Implementation Plan

## Goal
Expand the AI Inspector browser extension to intercept PII leaks across multiple AI platforms and new attack vectors.

---

## Current State vs Target State

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CURRENT                           TARGET                               │
│  ────────                          ──────                               │
│  ✅ ChatGPT only                   ✅ ChatGPT, Claude, Gemini,          │
│                                       Perplexity, Copilot               │
│  ❌ No form monitoring             ✅ Universal form interception       │
│  ❌ No clipboard monitoring        ✅ Copy/paste PII detection          │
│  ❌ No URL scanning                ✅ URL parameter scanning            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Multi-Platform AI Support

### Platform Selectors

| Platform | URL Pattern | Input Selector | Submit Method |
|----------|-------------|----------------|---------------|
| **ChatGPT** | `chat.openai.com/*` | `textarea#prompt-textarea` | Enter key |
| **Claude** | `claude.ai/*` | `div.ProseMirror[contenteditable]` | Enter key |
| **Gemini** | `gemini.google.com/*` | `rich-textarea div[contenteditable]` | Enter key |
| **Perplexity** | `perplexity.ai/*` | `textarea[placeholder*="Ask"]` | Enter key |
| **Copilot** | `copilot.microsoft.com/*` | `textarea#userInput` | Enter key |

### Files to Create/Modify

#### [MODIFY] userscript.user.js
Add new `@match` directives:
```javascript
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://www.perplexity.ai/*
// @match        https://copilot.microsoft.com/*
```

#### [NEW] platformDetector.js
```javascript
const PLATFORM_CONFIG = {
    chatgpt: {
        hostPattern: /chat\.openai\.com/,
        inputSelector: 'textarea#prompt-textarea, textarea',
        submitButton: 'button[data-testid="send-button"]'
    },
    claude: {
        hostPattern: /claude\.ai/,
        inputSelector: 'div.ProseMirror[contenteditable="true"]',
        submitButton: 'button[aria-label="Send Message"]'
    },
    gemini: {
        hostPattern: /gemini\.google\.com/,
        inputSelector: 'rich-textarea div[contenteditable]',
        submitButton: 'button.send-button'
    },
    perplexity: {
        hostPattern: /perplexity\.ai/,
        inputSelector: 'textarea[placeholder*="Ask"]',
        submitButton: 'button[aria-label="Submit"]'
    },
    copilot: {
        hostPattern: /copilot\.microsoft\.com/,
        inputSelector: 'textarea#userInput',
        submitButton: 'button[aria-label="Submit"]'
    }
};

function detectPlatform() {
    const host = window.location.host;
    for (const [name, config] of Object.entries(PLATFORM_CONFIG)) {
        if (config.hostPattern.test(host)) {
            return { name, ...config };
        }
    }
    return null;
}
```

---

## Phase 2: Form Submission Monitoring

#### [NEW] formMonitor.js
```javascript
class FormMonitor {
    constructor(piiDetector) {
        this.piiDetector = piiDetector;
        this.init();
    }

    init() {
        // Intercept form submissions
        document.addEventListener('submit', this.handleSubmit.bind(this), true);
        
        // Intercept XHR/Fetch for AJAX forms
        this.interceptFetch();
    }

    handleSubmit(event) {
        const form = event.target;
        const formData = new FormData(form);
        const piiFields = [];

        for (const [name, value] of formData.entries()) {
            const findings = this.piiDetector.detect(String(value));
            if (findings.length > 0) {
                piiFields.push({ field: name, piiTypes: findings });
            }
        }

        if (piiFields.length > 0) {
            event.preventDefault();
            this.showBlockModal(piiFields);
        }
    }

    showBlockModal(piiFields) {
        // Show user-friendly modal with option to proceed or cancel
    }
}
```

---

## Phase 3: Clipboard Monitoring

#### [NEW] clipboardMonitor.js
```javascript
class ClipboardMonitor {
    constructor(piiDetector) {
        this.piiDetector = piiDetector;
        this.init();
    }

    init() {
        // Monitor paste events (high priority)
        document.addEventListener('paste', this.handlePaste.bind(this), true);
        
        // Monitor copy events (medium priority - just warn)
        document.addEventListener('copy', this.handleCopy.bind(this), true);
    }

    handlePaste(event) {
        const clipboardData = event.clipboardData.getData('text');
        const findings = this.piiDetector.detect(clipboardData);

        if (findings.length > 0 && this.isAIPlatform()) {
            event.preventDefault();
            this.showWarning('Blocked paste with PII', findings);
        }
    }

    handleCopy(event) {
        const selection = window.getSelection().toString();
        const findings = this.piiDetector.detect(selection);

        if (findings.length > 0) {
            this.showNotification('Warning: Copying sensitive data');
        }
    }

    isAIPlatform() {
        return detectPlatform() !== null;
    }
}
```

---

## Phase 4: URL Parameter Scanning

#### [NEW] urlScanner.js
```javascript
class URLScanner {
    constructor(piiDetector) {
        this.piiDetector = piiDetector;
        this.init();
    }

    init() {
        // Scan on page load
        this.scanURL(window.location.href);
        
        // Monitor SPA navigation
        this.interceptHistoryAPI();
        
        // Monitor hash changes
        window.addEventListener('hashchange', () => {
            this.scanURL(window.location.href);
        });
    }

    scanURL(url) {
        try {
            const urlObj = new URL(url);
            const findings = [];

            // Scan query parameters
            for (const [key, value] of urlObj.searchParams.entries()) {
                const pii = this.piiDetector.detect(value);
                if (pii.length > 0) {
                    findings.push({ param: key, piiTypes: pii });
                }
            }

            // Scan path segments (optional)
            const pathSegments = urlObj.pathname.split('/');
            for (const segment of pathSegments) {
                const pii = this.piiDetector.detect(segment);
                if (pii.length > 0) {
                    findings.push({ param: 'PATH_SEGMENT', piiTypes: pii });
                }
            }

            if (findings.length > 0) {
                this.logAlert(url, findings);
            }
        } catch (e) {
            console.error('[URLScanner] Error:', e);
        }
    }

    interceptHistoryAPI() {
        const self = this;
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            const result = originalPushState.apply(this, args);
            self.scanURL(args[2] || window.location.href);
            return result;
        };

        history.replaceState = function(...args) {
            const result = originalReplaceState.apply(this, args);
            self.scanURL(args[2] || window.location.href);
            return result;
        };
    }

    logAlert(url, findings) {
        console.warn('[AI Inspector] PII in URL:', { url, findings });
        // Send to backend for audit logging
    }
}
```

---

## File Structure (Proposed)

```
security_engine/
└── textCapture_logic/
    ├── userscript.user.js      [MODIFY] - Add multi-platform @match
    ├── regex.js                [KEEP]   - PII patterns
    ├── alert.js                [KEEP]   - Alert UI
    │
    ├── platformDetector.js     [NEW]    - Platform config & detection
    ├── formMonitor.js          [NEW]    - Form submission interception
    ├── clipboardMonitor.js     [NEW]    - Copy/paste monitoring
    ├── urlScanner.js           [NEW]    - URL parameter scanning
    │
    └── extension/              [NEW]    - Chrome/Firefox extension
        ├── manifest.json
        ├── background.js
        └── popup/
            ├── popup.html
            └── popup.js
```

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 P0 | Multi-platform AI support | Medium | Very High |
| 🔴 P0 | Clipboard paste monitoring | Low | Very High |
| 🟠 P1 | Form submission monitoring | Medium | High |
| 🟡 P2 | URL parameter scanning | Low | Medium |
| 🔵 P3 | Browser extension packaging | Medium | Low |

---

## Testing Plan

### Manual Testing Matrix

| Test Case | Platforms | Expected Result |
|-----------|-----------|-----------------|
| Type PII + Enter | All 5 AI platforms | Submission blocked |
| Paste PII | All 5 AI platforms | Paste blocked with warning |
| Submit form with PII | Any website | Form blocked with modal |
| Navigate to URL with PII param | Any website | Console warning logged |

---

## Questions Before Implementation

1. **Userscript vs Extension:** Keep as Tampermonkey userscript or convert to Chrome extension?
2. **Blocking behavior:** Hard block or soft warn with option to proceed?
3. **Clipboard scope:** Monitor all copies or only pastes into AI platforms?
