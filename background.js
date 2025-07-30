// ==========================
// 封装通知函数
// ==========================
function notifyUser(message) {
  // 使用 Chrome 的系统通知 API 创建提示框
  chrome.notifications.create({
    type: "basic",               // 通知类型：基础样式
    iconUrl: "icon128.png",      // 通知图标，需在插件目录中提供
    title: "登录状态提示",         // 通知标题
    message: message             // 通知正文
  }, (notificationId) => {
    // 如果创建通知失败，打印错误
    if (chrome.runtime.lastError) {
      console.error("通知失败:", chrome.runtime.lastError.message);
    }
  });
}

// ✅ 登录成功后执行的操作预留点
function onLoginSuccess(tabId) {
  console.log("✅ 登录成功，准备执行后续逻辑...");

  // 示例1：跳转到某子页面
  // chrome.tabs.update(tabId, { url: "https://myseller.taobao.com/dashboard" });

  // 示例2：注入脚本操作 DOM
  // chrome.scripting.executeScript({
  //   target: { tabId },
  //   func: () => {
  //     document.body.style.backgroundColor = "#e6ffed";
  //   }
  // });

  // 示例3：发送状态到后端
  // fetch("https://your-server.com/track-login", { ... })
}

// ==========================
// 点击扩展图标时执行的主逻辑
// ==========================
chrome.action.onClicked.addListener(() => {
  // 创建一个新标签页并跳转到淘宝商家中心主页
  chrome.tabs.create({ url: "https://myseller.taobao.com/" }, (tab) => {
    const tabId = tab.id; // 获取新打开标签页的 ID

    // 定义一个监听器：监听页面加载完成
    const navigationListener = (details) => {
      if (details.tabId === tabId) {
        const finalUrl = details.url; // 获取实际跳转完成后的 URL

        // 判断是否跳转到了登录页（表示未登录）
        const isLoggedOut = finalUrl.startsWith("https://loginmyseller.taobao.com");

        // 根据登录状态设置消息文本
        const message = isLoggedOut
          ? "你尚未登录淘宝商家中心，请登录后重试！"
          : "你已成功登录淘宝商家中心。";

        // 使用封装的函数发出通知
        notifyUser(message);

        // 🔧 只有登录成功才执行后续逻辑
        if (!isLoggedOut) {
          onLoginSuccess(tabId);
        }

        // 移除监听器，避免重复触发
        chrome.webNavigation.onCompleted.removeListener(navigationListener);
      }
    };

    // 添加监听器：监听页面在相关域名下加载完成
    chrome.webNavigation.onCompleted.addListener(navigationListener, {
      url: [
        { hostContains: "myseller.taobao.com" },          // 登录后页面
        { hostContains: "loginmyseller.taobao.com" }      // 登录页
      ]
    });
  });
});
