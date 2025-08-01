// ========== 配置 ==========
const HOURLY_INTERVAL = 60 * 60 * 1000; // 1 hour

// 新增状态变量 isScrapingActive 控制是否继续执行任务
let isScrapingActive = false;

// ========== 定时器辅助函数 ==========
function updateBadgeText(text) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: text === 'on' ? '#4CAF50' : '#f44336' }); // 绿色/红色
}

function isWithinActiveHours() {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 24;
}

function createHourlyAlarm() {
    chrome.alarms.create('hourlyTask', {
        periodInMinutes: 60,
        when: Date.now() + HOURLY_INTERVAL
    });
    console.log('[Alarm] ⏰ 创建 hourlyTask');
}

function createNextDayAlarm() {
    const now = new Date();
    const next8am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0);
    const delay = next8am.getTime() - now.getTime();

    chrome.alarms.create('nextDayStart', {
        when: Date.now() + delay
    });
    console.log(`[Alarm] ⏱️ 安排明天8点任务启动，等待 ${Math.floor(delay / 60000)} 分钟`);
}

function clearAllAlarms() {
    chrome.alarms.clearAll(() => {
        console.log('[Alarm] 🧹 所有 alarms 已清除');
        // updateBadgeText('off');
    });
}

// ========== 报警事件监听器 ==========
chrome.alarms.onAlarm.addListener((alarm) => {
    const now = new Date();
    const hour = now.getHours();

    if (alarm.name === 'hourlyTask') {
        if (isWithinActiveHours()) {
            console.log('[Alarm] ✅ hourlyTask 触发');
            triggerScraping();
        } else {
            console.log('[Alarm] 🌙 超过活跃时间，停止 hourlyTask');
            chrome.alarms.clear('hourlyTask');
            createNextDayAlarm();
        }
    }

    if (alarm.name === 'nextDayStart') {
        if (isWithinActiveHours()) {
            console.log('[Alarm] 🌅 新一天任务开始，执行任务并重启 hourlyTask');
            triggerScraping();
            createHourlyAlarm();
            updateBadgeText('on'); // ✅ 重新启动时设置徽章
        } else {
            console.log('[Alarm] 😴 还未到活跃时间，延迟启动');
            createNextDayAlarm();
        }
    }
});

// ========== 系统通知 ==========
function notifyUser(message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png",
        title: "任务提示",
        message: message
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("通知失败:", chrome.runtime.lastError.message);
        }
    });
}

// ========== 任务调度逻辑 ==========

let taskQueue = [];
let currentTabId = null;

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

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function buildAnalysisUrl({ startDate, endDate, cateId, dateType }) {
    return `https://sycm.taobao.com/mc/free/class_analysis?activeKey=attribute&dateRange=${startDate}%7C${endDate}&dateType=${dateType}&parentCateId=201898103&cateId=${cateId}&sellerType=-1&indType=pay_ord_amt`;
}

function startTasks(tabId) {
    taskQueue = getDateParams().map(params => ({
        url: buildAnalysisUrl(params),
        params
    }));
    currentTabId = tabId;
    runNextTask();
}

function runNextTask() {

    if (!isScrapingActive) {
        console.log('[Task] ⏹️ 已被取消，不执行任务');
        return;
    }

    if (taskQueue.length === 0) {
        console.log("✅ 所有任务已完成");
        return;
    }

    const { url } = taskQueue[0];

    setTimeout(() => {
        chrome.tabs.update(currentTabId, { url }, (tab) => {
            console.log("➡️ 跳转至分析链接:", url);
            setupNavigationListener(tab.id);
        });
    }, 3000);
}

function setupNavigationListener(tabId) {
    const navigationListener = (details) => {
        if (details.tabId === tabId) {
            const finalUrl = details.url;
            let message = null;

            if (finalUrl.startsWith("https://loginmyseller.taobao.com")) {
                message = '你尚未登录淘宝商家中心，请登录后重试';
            } else if (finalUrl.startsWith("https://myseller.taobao.com")) {
                message = '你已成功登录淘宝商家中心';
                startTasks(tabId);
            } else if (finalUrl.startsWith("https://sycm.taobao.com/")) {
                console.log("✅ SYCM 页面加载成功，注入 Step1");
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_sycm_step1.js']
                    });
                }, 3000);
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

function triggerScraping() {
    if (!isScrapingActive) {
        console.log('[Task] ⏹️ 已被取消，不执行任务');
        return;
    }

    if (!isWithinActiveHours()) {
        console.log('[Task] ⏸ 非活跃时间段，不执行任务');
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const targetHost = "myseller.taobao.com";
        const loginHost = "loginmyseller.taobao.com";

        if (!activeTab || !activeTab.url) {
            console.warn("[Task] ❌ 当前标签页不可用");
            return;
        }

        if (activeTab.url.includes(targetHost) || activeTab.url.includes(loginHost)) {
            chrome.tabs.reload(activeTab.id, () => {
                console.log("[Task] 🔁 刷新当前标签页");
                setupNavigationListener(activeTab.id);
            });
        } else {
            chrome.tabs.create({ url: `https://${targetHost}/` }, (tab) => {
                if (tab && tab.id) {
                    console.log("[Task] 🆕 新建标签页采集");
                    setupNavigationListener(tab.id);
                } else {
                    console.warn("[Task] ❌ 创建标签失败");
                }
            });
        }
    });
}

// ========== 插件消息响应 ==========
chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender?.tab?.id;

    switch (message.action) {
        case 'startTask': {
            clearAllAlarms();

            isScrapingActive = true;

            triggerScraping();

            if (isWithinActiveHours()) {
                createHourlyAlarm();
            } else {
                createNextDayAlarm();
            }

            updateBadgeText('on');
            break;
        }

        case 'attributeSelectionDone': {
            if (!tabId) return;
            setTimeout(() => {
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content_sycm_step2.js']
                });
            }, 3000);
            break;
        }

        case 'triggerProductDiscoveryDone': {
            if (!tabId) return;
            setTimeout(() => {
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content_sycm_step3.js']
                });
            }, 3000);
            break;
        }

        case 'drawerData': {
            console.log('[Step3] 收到数据:', message.payload);
            if (taskQueue.length > 0) {
                const currentTask = taskQueue.shift();
                console.log('[Step3] 当前任务参数:', currentTask.params);
            }
            runNextTask();
            break;
        }

        case 'cancelScraping': {
            console.log('[Task] 用户取消采集任务');
            clearAllAlarms();
            taskQueue = [];
            isScrapingActive = false;
            updateBadgeText('off');
            break;
        }

        case 'error': {
            console.error('[Error] 插件错误：', message.message);
            notifyUser(message.message);
            clearAllAlarms();
            break;
        }

        default:
            console.warn('[Message] 未知类型:', message.action);
    }
});
