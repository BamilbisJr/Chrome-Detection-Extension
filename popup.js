const activateBtn = document.getElementById("activateBtn");
const stopBtn = document.getElementById("stopSiren");

stopBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ action: "stopSound" });
});

activateBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "startDrawing" });
});