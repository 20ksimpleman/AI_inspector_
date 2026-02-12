/**
 * AI Inspector — Popup Script
 * Loads stats from chrome.storage and renders the event feed.
 */

document.addEventListener("DOMContentLoaded", () => {
    const blockedEl = document.getElementById("blockedCount");
    const warnedEl = document.getElementById("warnedCount");
    const eventsListEl = document.getElementById("eventsList");
    const enableToggle = document.getElementById("enableToggle");
    const clearBtn = document.getElementById("clearBtn");

    // Icons (SVG)
    const ICONS = {
        block: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`,
        warn: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    // ── Load stats ──────────────────────────────────────────────
    loadStats();

    function loadStats() {
        chrome.runtime.sendMessage({ action: "get_stats" }, (response) => {
            if (!response) return;

            blockedEl.textContent = response.totalBlocked || 0;
            warnedEl.textContent = response.totalWarned || 0;
            enableToggle.checked = response.enabled !== false;

            renderEvents(response.events || []);
        });
    }

    // ── Render events ───────────────────────────────────────────
    function renderEvents(events) {
        if (events.length === 0) {
            eventsListEl.innerHTML = `
                <div class="empty-state">No events yet. Start browsing AI platforms.</div>
            `;
            return;
        }

        // Show most recent first
        const recent = events.slice(-20).reverse();

        eventsListEl.innerHTML = recent
            .map((evt) => {
                const isBlock = evt.type.includes("blocked");
                const isWarn = evt.type.includes("warned") || evt.type.includes("detected");

                const cssClass = isBlock ? "blocked" : isWarn ? "warned" : "";
                const icon = isBlock ? ICONS.block : isWarn ? ICONS.warn : ICONS.info;

                const piiNames = (evt.findings || []).map(f => f.name).join(", ");
                const time = formatTime(evt.timestamp);
                const source = evt.source || "unknown";

                return `
                    <div class="event-item ${cssClass}">
                        <span class="event-icon">${icon}</span>
                        <div class="event-details">
                            <div class="event-type">${piiNames || evt.type}</div>
                            <div class="event-meta">${source} · ${time}</div>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    // ── Toggle handler ──────────────────────────────────────────
    enableToggle.addEventListener("change", () => {
        chrome.runtime.sendMessage({
            action: "toggle_enabled",
            enabled: enableToggle.checked,
        });
    });

    // ── Clear handler ───────────────────────────────────────────
    clearBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "clear_events" }, () => {
            blockedEl.textContent = "0";
            warnedEl.textContent = "0";
            eventsListEl.innerHTML = `
                <div class="empty-state">No events yet. Start browsing AI platforms.</div>
            `;
        });
    });

    // ── Helpers ─────────────────────────────────────────────────
    function formatTime(iso) {
        if (!iso) return "";
        try {
            const d = new Date(iso);
            const now = new Date();
            const diffMin = Math.floor((now - d) / 60000);

            if (diffMin < 1) return "just now";
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
            return d.toLocaleDateString();
        } catch {
            return "";
        }
    }
});
