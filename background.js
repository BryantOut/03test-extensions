// ==========================
// 通知封装，发送系统通知
// ==========================
function notifyUser(message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",  // 请确保插件目录有此图标
    title: "登录状态提示",
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("通知失败:", chrome.runtime.lastError.message);
    }
  });
}

// ==========================
// 计算下一个6:30时间戳，用于定时任务
// ==========================
function getNext630AM() {
  const now = new Date();
  const next = new Date();
  next.setHours(6, 30, 0, 0);
  if (now > next) next.setDate(next.getDate() + 1);
  return next.getTime();
}

// ==========================
// 登录成功后执行操作（首次点击或定时触发）
// 包括执行任务和注册每日定时任务
// ==========================
function onLoginSuccess(tabId) {
  console.log("✅ 登录成功，执行后续业务逻辑");

  // TODO: 这里放你登录后需要执行的业务代码
  // 例如刷新页面、注入脚本或向服务器发送状态等

  // 注册每日6:30定时任务，避免重复创建
  chrome.alarms.get("dailyCrawl", (alarm) => {
    if (!alarm) {
      chrome.alarms.create("dailyCrawl", {
        when: getNext630AM(),
        periodInMinutes: 1440
      });
      console.log("✅ 注册每日6:30定时任务");
    } else {
      console.log("ℹ️ 定时任务已存在，无需重复创建");
    }
  });
}

// ==========================
// 抽离导航完成监听逻辑，统一调用
// ==========================
function setupNavigationListener(tabId) {
  const navigationListener = (details) => {
    if (details.tabId === tabId) {
      const finalUrl = details.url;
      const isLoggedOut = finalUrl.startsWith("https://loginmyseller.taobao.com");

      const message = isLoggedOut
        ? "你尚未登录淘宝商家中心，请登录后重试！"
        : "你已成功登录淘宝商家中心。";

      notifyUser(message);

      if (!isLoggedOut) {
        onLoginSuccess(tabId);
      }

      chrome.webNavigation.onCompleted.removeListener(navigationListener);
    }
  };

  chrome.webNavigation.onCompleted.addListener(navigationListener, {
    url: [
      { hostContains: "myseller.taobao.com" },
      { hostContains: "loginmyseller.taobao.com" }
    ]
  });
}

// ==========================
// 点击扩展图标时，判断当前标签是否目标页
// 是则刷新并监听，否则新开标签并监听
// ==========================
chrome.action.onClicked.addListener(() => {
  // 先清除定时器
  chrome.alarms.clear("dailyCrawl", (wasCleared) => {
    console.log("清除旧定时器:", wasCleared);

    // 清除完后继续现有逻辑
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const targetHost = "myseller.taobao.com";
      const loginHost = "loginmyseller.taobao.com";

      if (activeTab && (activeTab.url.includes(targetHost) || activeTab.url.includes(loginHost))) {
        chrome.tabs.reload(activeTab.id, () => {
          console.log("刷新当前标签页");
          setupNavigationListener(activeTab.id);
        });
      } else {
        chrome.tabs.create({ url: `https://${targetHost}/` }, (tab) => {
          console.log("新开标签页");
          setupNavigationListener(tab.id);
        });
      }
    });
  });
});

// ==========================
// 定时任务触发事件监听
// 每天6:30自动打开页面判断登录状态，登录则执行任务，未登录则清除定时任务并通知
// ==========================
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyCrawl") {
    console.log("⏰ 触发每日定时任务");

    chrome.tabs.create({ url: "https://myseller.taobao.com/" }, (tab) => {
      const tabId = tab.id;

      const navigationListener = (details) => {
        if (details.tabId === tabId) {
          const finalUrl = details.url;
          const isLoggedOut = finalUrl.startsWith("https://loginmyseller.taobao.com");

          if (isLoggedOut) {
            notifyUser("检测到你已退出登录，已停止每日任务，请重新登录");
            chrome.alarms.clear("dailyCrawl");
          } else {
            notifyUser("自动任务启动，准备执行爬取操作...");
            onLoginSuccess(tabId);
          }

          chrome.webNavigation.onCompleted.removeListener(navigationListener);
        }
      };

      chrome.webNavigation.onCompleted.addListener(navigationListener, {
        url: [
          { hostContains: "myseller.taobao.com" },
          { hostContains: "loginmyseller.taobao.com" }
        ]
      });
    });
  }
});
