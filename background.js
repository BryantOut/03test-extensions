const DELAY_TIME = 3000;

// ==========================
// 系统通知封装
// ==========================
function notifyUser(message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png", // 请确保插件目录有此图标
        title: "登录状态提示",
        message: message
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error("通知失败:", chrome.runtime.lastError.message);
        }
    });
}

// ==========================
// 登录成功后的操作逻辑
// ==========================
function onLoginSuccess(tabId) {
    console.log("✅ 登录成功，执行后续业务逻辑");

    setTimeout(() => {
        chrome.tabs.update(tabId, {
            url: `https://sycm.taobao.com/mc/free/class_analysis?activeKey=attribute&dateRange=2025-07-23%7C2025-07-29&dateType=recent7&parentCateId=201898103&cateId=50025684&sellerType=-1&indType=pay_ord_amt`
        }, function (tab) {
            console.log("已更新当前标签页");
            setupNavigationListener(tab.id);
        });
    }, DELAY_TIME)
}

// ==========================
// 首次校验登录导航跳转
// ==========================
function setupNavigationListener(tabId) {
    const navigationListener = (details) => {
        if (details.tabId === tabId) {
            const finalUrl = details.url;
            console.log(finalUrl)
            let message;
            if (finalUrl.startsWith("https://loginmyseller.taobao.com")) {
                message = '你尚未登录淘宝商家中心，请登录后重试'
            } else if (finalUrl.startsWith("https://myseller.taobao.com")) {
                message = '你已成功登录淘宝商家中心'
                onLoginSuccess(tabId);
            } else if (finalUrl.startsWith("https://sycm.taobao.com/")) {
                console.log('进来了')
                // 注入“第一步”内容脚本
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_sycm_step1.js']
                    });
                }, DELAY_TIME)
            }

            if (message) notifyUser(message);

            chrome.webNavigation.onCompleted.removeListener(navigationListener);
        }
    };

    chrome.webNavigation.onCompleted.addListener(navigationListener, {
        url: [
            { hostContains: "myseller.taobao.com" },
            { hostContains: "loginmyseller.taobao.com" },
            { hostContains: "sycm.taobao.com" }
        ]
    });
}

// ==========================
// 扩展图标点击逻辑
// ==========================
chrome.action.onClicked.addListener(() => {
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


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'attributeSelectionDone') {
        const tabId = sender.tab.id;

        console.log('🧩 收到属性选择完成通知，执行 step2');

        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_sycm_step2.js']
            });
        }, DELAY_TIME)
    }

    if (message.type === 'triggerProductDiscoveryDone') {
        const tabId = sender.tab.id;

        console.log('🧩 收到属性选择完成通知，执行 step2');

        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_sycm_step3.js']
            });
        }, DELAY_TIME)
    }

    if (message.type === 'drawerData') {
        console.log('📥 收到弹窗数据:', message.payload);
        // 你可以在这里保存数据、下载 JSON、处理逻辑等
    }
});