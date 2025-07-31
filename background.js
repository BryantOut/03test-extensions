const DELAY_TIME = 3000;

// ==========================
// 系统通知封装
// ==========================
function notifyUser(message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png",
        title: "登录状态提示",
        message: message
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error("通知失败:", chrome.runtime.lastError.message);
        }
    });
}

// ==========================
// 构建分析链接
// ==========================
function buildAnalysisUrl({ startDate, endDate, cateId, dateType }) {
    return `https://sycm.taobao.com/mc/free/class_analysis?activeKey=attribute&dateRange=${startDate}%7C${endDate}&dateType=${dateType}&parentCateId=201898103&cateId=${cateId}&sellerType=-1&indType=pay_ord_amt`;
}

// ==========================
// 获取最近日期
// ==========================
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function getDateParams() {
    const today = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const yesterday = new Date(today.getTime() - oneDay);
    const sevenDaysAgo = new Date(today.getTime() - 7 * oneDay);

    const s1 = formatDate(sevenDaysAgo);
    const e1 = formatDate(yesterday);

    return [
        { startDate: s1, endDate: e1, cateId: "50025684", dateType: 'recent7' },
        { startDate: e1, endDate: e1, cateId: "50025684", dateType: 'day' },
        { startDate: s1, endDate: e1, cateId: "50008062", dateType: 'recent7' },
        { startDate: e1, endDate: e1, cateId: "50008062", dateType: 'day' }
    ];
}

// ==========================
// 操作调度器
// ==========================
let taskQueue = [];
let currentTabId = null;

function startTasks(tabId) {
    taskQueue = getDateParams().map(params => ({
        url: buildAnalysisUrl(params),
        params
    }));
    currentTabId = tabId;
    runNextTask();
}

function runNextTask() {
    if (taskQueue.length === 0) {
        console.log("✅ 所有任务执行完毕");
        return;
    }

    const { url } = taskQueue[0]; // 等待 drawerData 时再 shift

    setTimeout(() => {
        chrome.tabs.update(currentTabId, { url }, (tab) => {
            console.log("➡️ 跳转到任务链接:", url);
            setupNavigationListener(tab.id);
        });
    }, DELAY_TIME);
}

// ==========================
// 登录校验监听
// ==========================
function setupNavigationListener(tabId) {
    const navigationListener = (details) => {
        if (details.tabId === tabId) {
            const finalUrl = details.url;
            let message = null;

            if (finalUrl.startsWith("https://loginmyseller.taobao.com")) {
                message = '你尚未登录淘宝商家中心，请登录后重试';
            } else if (finalUrl.startsWith("https://myseller.taobao.com")) {
                message = '你已成功登录淘宝商家中心';
                startTasks(tabId); // 登录成功后启动任务
            } else if (finalUrl.startsWith("https://sycm.taobao.com/")) {
                console.log("✅ SYCM 页面加载成功，注入 Step1");
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_sycm_step1.js']
                    });
                }, DELAY_TIME);
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
// 插件图标点击
// ==========================
chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const targetHost = "myseller.taobao.com";
        const loginHost = "loginmyseller.taobao.com";

        if (activeTab && (activeTab.url.includes(targetHost) || activeTab.url.includes(loginHost))) {
            chrome.tabs.reload(activeTab.id, () => {
                console.log("🔁 刷新当前标签页");
                setupNavigationListener(activeTab.id);
            });
        } else {
            chrome.tabs.create({ url: `https://${targetHost}/` }, (tab) => {
                console.log("🆕 新开标签页");
                setupNavigationListener(tab.id);
            });
        }
    });
});

// ==========================
// 后续步骤监听
// ==========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab.id;

    if (message.type === 'attributeSelectionDone') {
        console.log('📌 Step1 完成，执行 Step2');
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_sycm_step2.js']
            });
        }, DELAY_TIME);
    }

    if (message.type === 'triggerProductDiscoveryDone') {
        console.log('📌 Step2 完成，执行 Step3');
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_sycm_step3.js']
            });
        }, DELAY_TIME);
    }

    if (message.type === 'drawerData') {
        console.log('📥 收到弹窗数据:', message.payload);

        if (taskQueue.length > 0) {
            const currentTask = taskQueue.shift(); // 移除当前任务
            console.log('📊 当前任务参数:', currentTask.params);
        } else {
            console.warn("⚠️ 当前没有待执行任务");
        }

        runNextTask(); // 执行下一个任务
    }
});
