(() => {
  const targetLink = document.querySelector('a[href^="https://sycm.taobao.com"]');
  if (targetLink) {
    targetLink.click();
    chrome.runtime.sendMessage({ type: "navigate-success" });
  } else {
    chrome.runtime.sendMessage({ type: "navigate-failed" });
  }
})();
