chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "playSound") {
        triggerOffscreenAudio("play");
    }
    if (message.action === "stopSound") {
        triggerOffscreenAudio("stop");
    }
});

async function triggerOffscreenAudio(command) {
    const offscreenUrl = chrome.runtime.getURL("offscreen.html");

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length === 0) {
        await chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: ["AUDIO_PLAYBACK"],
            justification: "Play siren when watched DOM element changes"
        });
    }

    chrome.runtime.sendMessage({ action: command + "Audio" });
}