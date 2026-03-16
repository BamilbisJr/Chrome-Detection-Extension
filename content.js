let gStartX = 0, gStartY = 0, gWidth = 0, gHeight = 0;
let gObserver = null;

// On page load, check if we were already watching something
chrome.storage.local.get(["watchedSelector", "watchedTabId"], ({ watchedSelector, watchedTabId }) => {
    if (!watchedSelector || !watchedTabId) return;

    chrome.runtime.sendMessage({ action: "getTabId" }, (response) => {
        if (!response || response.tabId !== watchedTabId) return;

        showHUD();
        function tryReattach() {
            const el = document.querySelector(watchedSelector);
            if (el) {
                highlightElement(el);
                gObserver = watchElement(el);
            } else {
                setTimeout(tryReattach, 500);
            }
        }
        tryReattach();
    });
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "startDrawing") {
        drawBox();
    }
});

function showHUD() {
    if (document.getElementById("domWatcherHUD")) return;

    const hud = document.createElement("div");
    hud.id = "domWatcherHUD";
    hud.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 9999999;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    const label = document.createElement("span");
    label.textContent = "DOM Watcher";
    label.style.cssText = "color: #666; font-weight: 500;";

    const divider = document.createElement("div");
    divider.style.cssText = "width: 1px; height: 16px; background: #ccc;";

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "Stop siren";
    stopBtn.style.cssText = `
        font-size: 12px; padding: 4px 10px; border-radius: 6px;
        border: 1px solid #ccc; background: transparent;
        color: #cc3333; cursor: pointer;
    `;
    stopBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "stopSound" });
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear watcher";
    clearBtn.style.cssText = `
        font-size: 12px; padding: 4px 10px; border-radius: 6px;
        border: 1px solid #ccc; background: transparent;
        color: #444; cursor: pointer;
    `;
    clearBtn.addEventListener("click", () => {
        if (gObserver) {
            gObserver.disconnect();
            gObserver = null;
        }
        chrome.storage.local.remove("watchedSelector");
        chrome.storage.local.remove("watchedTabId");
        chrome.runtime.sendMessage({ action: "stopSound" });
        document.querySelectorAll("*").forEach(el => {
            if (el.style.outline === "3px solid red") {
                el.style.outline = "";
            }
        });
        hud.remove();
    });

    hud.appendChild(label);
    hud.appendChild(divider);
    hud.appendChild(stopBtn);
    hud.appendChild(clearBtn);
    document.body.appendChild(hud);
}

function drawBox() {
    const overlay = document.createElement("div");
    overlay.id = "selectionOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "999999";
    overlay.style.cursor = "crosshair";
    overlay.style.background = "rgba(0,0,0,0.01)";
    document.body.appendChild(overlay);

    const box = document.createElement("div");
    box.style.position = "absolute";
    box.style.border = "2px dashed black";
    box.style.background = "rgba(0,0,255,0.2)";
    overlay.appendChild(box);

    let startX, startY;

    overlay.addEventListener("mousedown", (e) => {
        startX = e.clientX;
        startY = e.clientY;

        function mouseMove(e) {
            const currentX = e.clientX;
            const currentY = e.clientY;
            box.style.left = Math.min(startX, currentX) + "px";
            box.style.top = Math.min(startY, currentY) + "px";
            box.style.width = Math.abs(currentX - startX) + "px";
            box.style.height = Math.abs(currentY - startY) + "px";
        }

        function mouseUp() {
            gStartX = parseInt(box.style.left);
            gStartY = parseInt(box.style.top);
            gWidth = parseInt(box.style.width);
            gHeight = parseInt(box.style.height);

            document.removeEventListener("mousemove", mouseMove);
            document.removeEventListener("mouseup", mouseUp);
            overlay.remove();

            detectElement();
        }

        document.addEventListener("mousemove", mouseMove);
        document.addEventListener("mouseup", mouseUp);
    });
}

function getSelectorPath(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;

    const parts = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();

        if (el.id) {
            selector = `#${CSS.escape(el.id)}`;
            parts.unshift(selector);
            break;
        }

        const parent = el.parentNode;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                s => s.nodeName === el.nodeName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(el) + 1;
                selector += `:nth-of-type(${index})`;
            }
        }

        parts.unshift(selector);
        el = el.parentNode;
    }

    return parts.join(" > ");
}

function detectElement() {
    const target = findLargestElementInBox(gStartX, gStartY, gWidth, gHeight);
    if (!target) {
        alert("No element detected!");
        return;
    }

    const selector = getSelectorPath(target);

    chrome.runtime.sendMessage({ action: "getTabId" }, (response) => {
        chrome.storage.local.set({
            watchedSelector: selector,
            watchedTabId: response.tabId
        });
    });

    highlightElement(target);
    gObserver = watchElement(target);
    showHUD();
}

function findLargestElementInBox(x, y, width, height) {
    const elements = document.querySelectorAll("*");
    let bestElement = null, bestOverlap = 0;
    const boxRight = x + width, boxBottom = y + height;
    elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(boxRight, rect.right) - Math.max(x, rect.left));
        const overlapY = Math.max(0, Math.min(boxBottom, rect.bottom) - Math.max(y, rect.top));
        const overlapArea = overlapX * overlapY;
        if (overlapArea > bestOverlap) {
            bestOverlap = overlapArea;
            bestElement = el;
        }
    });
    return bestElement;
}

function highlightElement(el) {
    el.style.outline = "3px solid red";
}

function watchElement(el) {
    const observer = new MutationObserver(() => {
        chrome.runtime.sendMessage({ action: "playSound" });
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: "stopSound" });
        }, 15000);
    });

    setTimeout(() => {
        observer.observe(el, { childList: true, subtree: true, characterData: true });
    }, 500);

    return observer;
}