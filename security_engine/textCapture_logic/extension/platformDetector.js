/**
 * AI Inspector — Multi-Platform AI Detector
 * Detects the current AI platform and provides platform-specific selectors.
 *
 * FIX: Updated ChatGPT selector — now uses div#prompt-textarea[contenteditable],
 * added multiple fallback selectors, and added chatgpt.com host pattern.
 */

const PLATFORM_CONFIG = {
    chatgpt: {
        name: "ChatGPT",
        hostPattern: /chat\.openai\.com|chatgpt\.com/,
        inputSelector: [
            // ── IMPORTANT ──────────────────────────────────────────
            // ChatGPT DOM has TWO elements sharing the prompt-textarea name/id:
            //   1. <textarea class="wcDTda_fallbackTextarea" name="prompt-textarea" style="display:none">
            //   2. <div id="prompt-textarea" contenteditable="true" class="ProseMirror">
            // querySelector('#prompt-textarea') returns the FIRST match (the hidden textarea),
            // so we MUST target the div explicitly.
            // Text lives inside <p> tags: <div id="prompt-textarea"><p>user text</p></div>
            // Use el.innerText to extract (handles multiple <p> blocks as newlines).
            // ────────────────────────────────────────────────────────
            'div#prompt-textarea[contenteditable="true"]', // PRIMARY: the real ProseMirror input
            'div.ProseMirror#prompt-textarea',             // ProseMirror class variant
            'div[contenteditable="true"].ProseMirror',     // class-based fallback
            'div#prompt-textarea',                         // id-only fallback (still div, not textarea)
        ].join(', '),
        submitButton: [
            'button[data-testid="send-button"]',
            'button[aria-label="Send prompt"]',
            'button[aria-label="Send"]',
            'form button[type="submit"]',
        ].join(', '),
        icon: "🤖",
    },
    claude: {
        name: "Claude",
        hostPattern: /claude\.ai/,
        inputSelector: [
            'div.ProseMirror[contenteditable="true"]',
            '[contenteditable="true"].ProseMirror',
            'div[contenteditable="true"][role="textbox"]',
            'div.tiptap[contenteditable="true"]',
            'fieldset div[contenteditable="true"]',
            'div[contenteditable="true"]',
        ].join(', '),
        submitButton: [
            'button[aria-label="Send Message"]',
            'button[aria-label="Send"]',
            'button[data-testid="send-button"]',
            'fieldset button',
        ].join(', '),
        icon: "🧠",
    },
    gemini: {
        name: "Gemini",
        hostPattern: /gemini\.google\.com/,
        inputSelector: [
            'rich-textarea div[contenteditable]',
            'div[contenteditable="true"]',
            '.ql-editor',
        ].join(', '),
        submitButton: [
            'button.send-button',
            'button[aria-label="Send message"]',
            'button[aria-label="Send"]',
        ].join(', '),
        icon: "✨",
    },
    perplexity: {
        name: "Perplexity",
        hostPattern: /perplexity\.ai/,
        inputSelector: [
            'textarea[placeholder*="Ask"]',
            'textarea',
        ].join(', '),
        submitButton: [
            'button[aria-label="Submit"]',
            'button[aria-label="Send"]',
        ].join(', '),
        icon: "🔍",
    },
    copilot: {
        name: "Copilot",
        hostPattern: /copilot\.microsoft\.com/,
        inputSelector: [
            'textarea#userInput',
            'textarea',
        ].join(', '),
        submitButton: [
            'button[aria-label="Submit"]',
            'button[aria-label="Send"]',
        ].join(', '),
        icon: "💠",
    },
};

/**
 * Detect which AI platform the user is currently on.
 * @returns {{ key: string, name: string, hostPattern: RegExp, inputSelector: string, submitButton: string, icon: string } | null}
 */
function detectPlatform() {
    const host = window.location.host;
    for (const [key, config] of Object.entries(PLATFORM_CONFIG)) {
        if (config.hostPattern.test(host)) {
            return { key, ...config };
        }
    }
    return null;
}

/**
 * Get the text content from the active input on the current platform.
 * Handles both textarea (value) and contenteditable div (innerText).
 * Skips hidden fallback elements (e.g., ChatGPT's display:none textarea).
 * @param {object} platform — result of detectPlatform()
 * @returns {string}
 */
function getPlatformInputText(platform) {
    if (!platform) return "";

    // Iterate candidates to find the first VISIBLE match
    const candidates = document.querySelectorAll(platform.inputSelector);
    let el = null;
    for (const candidate of candidates) {
        if (candidate.offsetParent === null && candidate.tagName === 'TEXTAREA') continue;
        if (getComputedStyle(candidate).display === 'none') continue;
        el = candidate;
        break;
    }
    if (!el) return "";

    // For standard textareas / inputs
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        return (el.value || "").trim();
    }

    // For contenteditable (ProseMirror wraps lines in <p> tags)
    const paragraphs = el.querySelectorAll("p");
    if (paragraphs.length > 0) {
        return Array.from(paragraphs)
            .map(p => p.innerText || p.textContent || "")
            .join("\n")
            .trim();
    }
    return (el.innerText || el.textContent || "").trim();
}

/**
 * Get all matching AI platform host patterns for extension manifest.
 * @returns {string[]}
 */
function getAllPlatformURLPatterns() {
    return [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*",
        "https://copilot.microsoft.com/*",
    ];
}
