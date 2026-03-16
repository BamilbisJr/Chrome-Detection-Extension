const audio = new Audio(chrome.runtime.getURL("aviation-alarm.mp3"));
audio.loop = true;

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "playAudio") {
        audio.play().catch(console.error);
    }
    if (message.action === "stopAudio") {
        audio.pause();
        audio.currentTime = 0;
    }
});