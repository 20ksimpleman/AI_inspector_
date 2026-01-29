// ==UserScript==
// @name         ChatGPT Prompt Logger
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==


function detectPII(text) {
    let findings = [];

    for (const rule of piiPatterns) {
        if (rule.regex.test(text)) {
            findings.push(rule.name);
        }
    }

    return findings;
}

document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.shiftKey) return;

    const input = document.querySelector("textarea, [contenteditable='true']");
    if (!input) return;

    const text = input.value || input.innerText;
    if (!text || !text.trim()) return;

    const findings = detectPII(text);

    if (findings.length > 0) {
        blockSubmission(e, findings);
    }
}, true);


(function () {
    console.log("[ChatGPT Logger] Loaded");

    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            const input = document.querySelector("textarea, [contenteditable='true']");
            if (!input) return;

            const text = input.innerText || input.value;
            if (!text.trim()) return;

            const log = {
                time: new Date().toISOString(),
                prompt: text
            };

            console.log("[ChatGPT Prompt]", log);

            // Store locally
            let logs = JSON.parse(localStorage.getItem("chatgpt_logs") || "[]");
            logs.push(log);
            localStorage.setItem("chatgpt_logs", JSON.stringify(logs));
        }
    });
})();
