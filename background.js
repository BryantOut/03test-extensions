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
// 后续步骤监听
// ==========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender?.tab?.id; // ✅ 安全获取 tabId，仅 content-script 可用

    // 🧩 Step 1: 属性选择完成后执行 Step2
    if (message.action === 'attributeSelectionDone') {
        if (!tabId) {
            console.warn("⚠️ 无法执行 Step2，tabId 不存在");
            return;
        }
        console.log('📌 Step1 完成，执行 Step2');
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_sycm_step2.js']
            });
        }, DELAY_TIME);
    }

    // 🧩 Step 2: 商品发现完成后执行 Step3
    if (message.action === 'triggerProductDiscoveryDone') {
        if (!tabId) {
            console.warn("⚠️ 无法执行 Step3，tabId 不存在");
            return;
        }
        console.log('📌 Step2 完成，执行 Step3');
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_sycm_step3.js']
            });
        }, DELAY_TIME);
    }

    // 📦 Step 3: 接收数据结果
    if (message.action === 'drawerData') {
        console.log('📥 收到弹窗数据:', message.payload);

        if (taskQueue.length > 0) {
            const currentTask = taskQueue.shift();
            console.log('📊 当前任务参数:', currentTask.params);
        } else {
            console.warn("⚠️ 当前没有待执行任务");
        }

        runNextTask(); // ▶️ 执行下一任务
    }

    // 🚀 启动任务（来自 popup.js）
    if (message.action === "startTask") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            const targetHost = "myseller.taobao.com";
            const loginHost = "loginmyseller.taobao.com";

            if (!activeTab || !activeTab.url) {
                console.warn("❌ 当前标签页不可用");
                return;
            }

            if (activeTab.url.includes(targetHost) || activeTab.url.includes(loginHost)) {
                chrome.tabs.reload(activeTab.id, () => {
                    console.log("🔁 刷新当前标签页");
                    setupNavigationListener(activeTab.id);
                });
            } else {
                chrome.tabs.create({ url: `https://${targetHost}/` }, (tab) => {
                    if (tab && tab.id) {
                        console.log("🆕 新开标签页");
                        setupNavigationListener(tab.id);
                    } else {
                        console.warn("❌ 创建新标签页失败");
                    }
                });
            }
        });
    }

    // ❌ 用户手动取消
    if (message.action === "cancelScraping") {
        console.log("🚫 用户点击了取消爬取");
        // TODO: 清理监听器/任务等
    }

    // 处理过程中的报错
    if (message.action === 'error') {
        console.error('❌ 插件报错:', message.message);
    }
});

