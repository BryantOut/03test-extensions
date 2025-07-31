document.getElementById("start").addEventListener("click", async () => {
    chrome.runtime.sendMessage({ action: "startTask" });
});

document.getElementById("cancel").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "cancelScraping" });
});
