/**
 * AI Inspector — Shared DOM Helpers
 * Canonical functions for finding, reading, and writing to platform input elements.
 * Used by content.js, realtimeMonitor.js, and clipboardMonitor.js.
 */

/**
 * Find the first VISIBLE input element matching the platform's selector.
 * Skips hidden textareas (e.g., ChatGPT's fallback <textarea style="display:none">).
 *
 * @param {object} platform — from detectPlatform()
 * @returns {HTMLElement|null}
 */
function findInputElement(platform) {
    if (!platform) return null;
    const candidates = document.querySelectorAll(platform.inputSelector);
    for (const el of candidates) {
        if (el.offsetParent === null && el.tagName === "TEXTAREA") continue;
        try { if (getComputedStyle(el).display === "none") continue; } catch (e) { continue; }
        return el;
    }
    return null;
}

/**
 * Walk up from a DOM node to find the nearest contenteditable root or
 * editable form element. Useful when event.target is a <p> child inside
 * a ProseMirror editor.
 *
 * @param {HTMLElement} target — the event target to start from
 * @param {object} [platform] — optional, used as fallback via selector lookup
 * @returns {HTMLElement}
 */
function findEditableRoot(target, platform) {
    let el = target;
    while (el && el !== document.body) {
        if (el.getAttribute("contenteditable") === "true") return el;
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el;
        el = el.parentElement;
    }
    // Fallback: use the platform selector
    if (platform) return findInputElement(platform);
    const detected = typeof detectPlatform === "function" ? detectPlatform() : null;
    return detected ? findInputElement(detected) : target;
}

/**
 * Read text from an input element.
 * Handles ProseMirror contenteditable (paragraphs) and standard textarea/input.
 *
 * @param {HTMLElement} el — the input element
 * @returns {string}
 */
function getElementText(el) {
    if (!el) return "";

    if (el.hasAttribute("contenteditable")) {
        const paragraphs = el.querySelectorAll("p");
        if (paragraphs.length > 0) {
            return Array.from(paragraphs)
                .map(p => p.innerText || p.textContent || "")
                .join("\n")
                .trim();
        }
        return (el.innerText || el.textContent || "").trim();
    }

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        return (el.value || "").trim();
    }

    return (el.innerText || el.textContent || el.value || "").trim();
}

/**
 * Convenience: find element + read text in one call.
 *
 * @param {object} platform
 * @returns {string}
 */
function getInputText(platform) {
    return getElementText(findInputElement(platform));
}

/**
 * Write text into an element using ProseMirror-compatible approach.
 * For contenteditable: selects all → execCommand('insertText').
 * For textarea/input: sets .value directly.
 *
 * @param {HTMLElement} el
 * @param {string} text
 * @param {'replace'|'append'} [mode='replace'] — 'replace' selects all first,
 *   'append' positions cursor at end
 */
function writeToInput(el, text, mode = "replace") {
    if (!el) return;

    if (el.getAttribute("contenteditable") === "true") {
        el.focus();

        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);

        if (mode === "append") {
            range.collapse(false); // cursor at end
        }

        sel.removeAllRanges();
        sel.addRange(range);

        const success = document.execCommand("insertText", false, text);

        if (!success) {
            // Fallback for editors that don't support execCommand
            el.dispatchEvent(new InputEvent("beforeinput", {
                inputType: mode === "append" ? "insertFromPaste" : "insertReplacementText",
                data: text,
                bubbles: true,
                cancelable: true,
            }));
        }
    } else if (el.value !== undefined) {
        if (mode === "replace") {
            el.value = text;
        } else {
            const pos = el.selectionStart || el.value.length;
            el.value = el.value.slice(0, pos) + text + el.value.slice(pos);
            el.selectionStart = el.selectionEnd = pos + text.length;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

/**
 * Strip matched PII values from text and write the cleaned version back.
 *
 * @param {HTMLElement} el — the input element
 * @param {string} originalText — the text at scan time
 * @param {Array<{match: string}>} findings — detected PII matches
 */
function redactPII(el, originalText, findings) {
    let cleaned = originalText;
    for (const f of findings) {
        if (f.match) cleaned = cleaned.split(f.match).join("");
    }
    cleaned = cleaned.replace(/  +/g, " ").trim();
    writeToInput(el, cleaned, "replace");
}
