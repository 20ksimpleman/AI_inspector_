/**
 * AI Inspector — Background Service Worker (Manifest V3)
 * Manages badge count, event storage, and message handling.
 */

// ── Badge management ────────────────────────────────────────────
let sessionBlockCount = 0;

function updateBadge(count) {
    const text = count > 0 ? String(count) : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({
        color: count > 0 ? "#ff4b4b" : "#4caf50",
    });
}

// Initialize badge on install
chrome.runtime.onInstalled.addListener(() => {
    console.log("[AI Inspector] Extension installed — v2.0.0");
    updateBadge(0);

    // Initialize storage
    chrome.storage.local.set({
        enabled: true,
        totalBlocked: 0,
        totalWarned: 0,
        events: [],
    });
});

// ── Message handler from content scripts ────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "pii_event") {
        handlePIIEvent(message.event, sender.tab);
        sendResponse({ status: "received" });
    }

    if (message.action === "get_stats") {
        chrome.storage.local.get(
            ["totalBlocked", "totalWarned", "events", "enabled"],
            (data) => {
                sendResponse({
                    totalBlocked: data.totalBlocked || 0,
                    totalWarned: data.totalWarned || 0,
                    events: data.events || [],
                    enabled: data.enabled !== false,
                });
            }
        );
        return true; // async sendResponse
    }

    if (message.action === "toggle_enabled") {
        chrome.storage.local.set({ enabled: message.enabled });
        sendResponse({ status: "ok" });
    }

    if (message.action === "clear_events") {
        chrome.storage.local.set({
            totalBlocked: 0,
            totalWarned: 0,
            events: [],
        });
        sessionBlockCount = 0;
        updateBadge(0);
        sendResponse({ status: "cleared" });
    }
});

// ── Event processing ────────────────────────────────────────────
function handlePIIEvent(event, tab) {
    chrome.storage.local.get(
        ["totalBlocked", "totalWarned", "events"],
        (data) => {
            let totalBlocked = data.totalBlocked || 0;
            let totalWarned = data.totalWarned || 0;
            let events = data.events || [];

            // Classify event
            const isBlock = event.type.includes("blocked");
            const isWarn = event.type.includes("warned") || event.type.includes("detected");

            if (isBlock) {
                totalBlocked++;
                sessionBlockCount++;
            }
            if (isWarn) {
                totalWarned++;
            }

            // Add to events (keep last 100)
            events.push({
                ...event,
                tabTitle: tab ? tab.title : "Unknown",
                tabUrl: tab ? tab.url : "",
            });
            if (events.length > 100) events = events.slice(-100);

            // Persist
            chrome.storage.local.set({ totalBlocked, totalWarned, events });

            // Update badge
            updateBadge(sessionBlockCount);
        }
    );
}
