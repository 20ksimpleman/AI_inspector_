/**
 * AI Inspector — Page-Level Fetch Interceptor
 * 
 * This script runs in the PAGE context (not the extension's isolated world)
 * to intercept window.fetch() calls and detect PII in outgoing API requests.
 * 
 * It dispatches a CustomEvent back to the content script with the text payload.
 * Extracted from content.js to comply with Manifest V3 CSP (no inline scripts).
 */
(function () {
    if (window.__aiInspectorFetchHooked) return;
    window.__aiInspectorFetchHooked = true;

    const _originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const [resource, config] = args;
        const url = typeof resource === 'string' ? resource : resource.url;

        // Only intercept API calls that send messages
        if (config && config.body && typeof config.body === 'string') {
            try {
                const body = JSON.parse(config.body);
                // ChatGPT sends messages via conversation endpoint
                if (body.messages || body.prompt || body.content) {
                    const textParts = [];
                    if (body.messages && Array.isArray(body.messages)) {
                        body.messages.forEach(m => {
                            if (m.content && typeof m.content === 'string') textParts.push(m.content);
                            if (m.content && m.content.parts) textParts.push(...m.content.parts);
                        });
                    }
                    if (body.prompt) textParts.push(body.prompt);
                    if (body.content) textParts.push(body.content);

                    const fullText = textParts.join(' ');
                    if (fullText.trim()) {
                        // Dispatch custom event to content script
                        window.dispatchEvent(new CustomEvent('__aiInspectorFetchIntercept', {
                            detail: { text: fullText, url }
                        }));
                    }
                }
            } catch (e) { /* not JSON body — ignore */ }
        }

        return _originalFetch.apply(this, args);
    };
})();
