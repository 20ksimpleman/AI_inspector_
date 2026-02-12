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
                const icon = isBlock ? "🚫" : isWarn ? "⚠️" : "ℹ️";
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
