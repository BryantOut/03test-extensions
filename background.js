// ========== 配置 ==========
const HOURLY_INTERVAL = 60 * 60 * 1000; // 每小时执行一次
const DELAY_TIME = 3000;

// 状态变量：是否激活任务
let isScrapingActive = false;
let taskQueue = [];
let currentTabId = null;

// ========== 辅助函数 ==========

function updateBadgeText(text) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: text === 'on' ? '#4CAF50' : '#f44336' });
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

    chrome.alarms.create('nextDayStart', { when: Date.now() + delay });
    console.log(`[Alarm] ⏱️ 安排明天8点任务启动，等待 ${Math.floor(delay / 60000)} 分钟`);
}

function clearAllAlarms() {
    chrome.alarms.clearAll(() => {
        console.log('[Alarm] 🧹 所有 alarms 已清除');
    });
}

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

// ========== 持久化状态 ==========

function setScrapingActiveState(state) {
    isScrapingActive = state;
    chrome.storage.local.set({ isScrapingActive: state });
}

function persistTaskQueue() {
    chrome.storage.local.set({ taskQueue: JSON.stringify(taskQueue) });
}

function restoreScrapingState() {
    chrome.storage.local.get(['isScrapingActive', 'taskQueue'], (result) => {
        if (result.isScrapingActive) {
            isScrapingActive = true;
            console.log('[Restore] 任务状态恢复');

            if (result.taskQueue) {
                try {
                    taskQueue = JSON.parse(result.taskQueue);
                    console.log('[Restore] 恢复任务队列:', taskQueue.length, '项');
                } catch (err) {
                    console.warn('[Restore] 任务队列解析失败:', err);
                }
            }

            triggerScraping();
            if (isWithinActiveHours()) {
                createHourlyAlarm();
            } else {
                createNextDayAlarm();
            }
            updateBadgeText('on');
        } else {
            updateBadgeText('off');
        }
    });
}

// ========== 时间参数工具 ==========

function getDateParams() {
    const today = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const yesterday = new Date(today.getTime() - oneDay);
    const sevenDaysAgo = new Date(today.getTime() - 7 * oneDay);

    const s1 = formatDate(sevenDaysAgo);
    const e1 = formatDate(yesterday);

    return [
        { statisticsStartTime: s1, statisticsEndTime: e1, cateId: "50025684", cate: '包点', dateType: 'recent7', statisticsTimeType: 0 },
        { statisticsStartTime: e1, statisticsEndTime: e1, cateId: "50025684", cate: '包点', dateType: 'day', statisticsTimeType: 1 },
        { statisticsStartTime: s1, statisticsEndTime: e1, cateId: "50008062", cate: '月饼', dateType: 'recent7', statisticsTimeType: 0 },
        { statisticsStartTime: e1, statisticsEndTime: e1, cateId: "50008062", cate: '月饼', dateType: 'day', statisticsTimeType: 1 }
    ];
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function buildAnalysisUrl({ statisticsStartTime, statisticsEndTime, cateId, dateType }) {
    return `https://sycm.taobao.com/mc/free/class_analysis?activeKey=attribute&dateRange=${statisticsStartTime}%7C${statisticsEndTime}&dateType=${dateType}&parentCateId=201898103&cateId=${cateId}&sellerType=-1&indType=pay_ord_amt`;
}

// ========== 任务调度逻辑 ==========

function startTasks(tabId) {
    taskQueue = getDateParams().map(params => ({
        url: buildAnalysisUrl(params),
        params
    }));
    currentTabId = tabId;
    persistTaskQueue();
    runNextTask();
}

function runNextTask() {
    if (!isScrapingActive) {
        console.log('[Task] ⏹️ 已被取消');
        return;
    }

    if (taskQueue.length === 0) {
        console.log("✅ 所有任务已完成");
        return;
    }

    const { url } = taskQueue[0];

    setTimeout(() => {
        chrome.tabs.update(currentTabId, { url }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('[Tabs] 更新失败:', chrome.runtime.lastError.message);
                return;
            }
            console.log("➡️ 跳转至分析链接:", url);
            setupNavigationListener(tab.id);
        });
    }, 3000);
}

function setupNavigationListener(tabId) {
    // 清理之前的监听，防止重复监听导致多次触发
    chrome.webNavigation.onCompleted.removeListener(onNavigationCompleted);

    function onNavigationCompleted(details) {
        if (details.tabId !== tabId) return;

        const finalUrl = details.url;

        if (finalUrl.startsWith("https://loginmyseller.taobao.com")) {
            notifyUser('你尚未登录淘宝商家中心，请登录后重试');
        } else if (finalUrl.startsWith("https://myseller.taobao.com")) {
            notifyUser('你已成功登录淘宝商家中心');
            // 登录成功，立即启动任务（和 startTask 一致的逻辑）
            if (!isScrapingActive) {
                setScrapingActiveState(true);
                if (isWithinActiveHours()) {
                    createHourlyAlarm();
                } else {
                    createNextDayAlarm();
                }
                updateBadgeText('on');
            }
            startTasks(tabId);
        } else if (finalUrl.startsWith("https://sycm.taobao.com/")) {
            console.log("✅ SYCM 页面加载成功，注入 Step1 脚本");
            setTimeout(() => {
                // 检查 tab 是否存在
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError || !tab) {
                        console.error(`标签页不存在或已关闭，无法注入脚本: ${chrome.runtime.lastError?.message}`);
                        return;
                    }

                    // 注入脚本
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_sycm_step1.js']
                    }).catch(err => console.error('注入 Step1 脚本失败:', err));
                });
            }, 3000);
        }

        // 监听一次，完成后移除
        chrome.webNavigation.onCompleted.removeListener(onNavigationCompleted);
    }

    chrome.webNavigation.onCompleted.addListener(onNavigationCompleted, {
        url: [
            { hostContains: "myseller.taobao.com" },
            { hostContains: "loginmyseller.taobao.com" },
            { hostContains: "sycm.taobao.com" }
        ]
    });
}

function triggerScraping() {
    if (!isScrapingActive || !isWithinActiveHours()) {
        console.log('[Task] ⏸ 非活跃时间段或已取消');
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const targetHost = "myseller.taobao.com";

        if (!activeTab || !activeTab.url) {
            console.warn("[Task] ❌ 当前标签页不可用");
            return;
        }

        if (activeTab.url.includes(targetHost) || activeTab.url.includes("loginmyseller.taobao.com")) {
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

// ========== 发送结果给后端 ==========
async function saveCateLinkRankHandler(data) {
    try {
        const { isError, errMsg, msg } = await fetch('http://localhost:5050/api/Compe/SaveCateLinkRank', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8'
            },
            body: JSON.stringify(data)
        });

        if (isError) {
            notifyUser(errMsg);
        } else {
            console.log('[Step3] ✅ 数据保存成功:', msg);
        }
        return !isError; // 标识成功
    } catch (err) {
        notifyUser('发送数据失败，请检查后端服务是否启动');
        return false; // 标识失败
    }
}

// ========== 消息监听 ==========

chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender?.tab?.id;

    switch (message.action) {
        case 'startTask':
            clearAllAlarms();
            setScrapingActiveState(true);
            triggerScraping();
            if (isWithinActiveHours()) {
                createHourlyAlarm();
            } else {
                createNextDayAlarm();
            }
            updateBadgeText('on');
            break;

        case 'attributeSelectionDone':
            if (tabId) {
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_sycm_step2.js']
                    }).catch(err => console.error('注入 Step2 脚本失败:', err));
                }, 3000);
            }
            break;

        case 'triggerProductDiscoveryDone':
            if (tabId) {
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_sycm_step3.js']
                    }).catch(err => console.error('注入 Step3 脚本失败:', err));
                }, 3000);
            }
            break;

        case 'drawerData':
            console.log('[Step3] 收到数据:', message.payload);

            (async () => {
                if (taskQueue.length > 0) {
                    const currentTask = taskQueue.shift();
                    console.log('[Step3] 当前任务参数:', currentTask.params);

                    const { cate, statisticsTimeType, statisticsStartTime, statisticsEndTime } = currentTask.params;

                    // 等待保存结果
                    const success = await saveCateLinkRankHandler({
                        cate,
                        statisticsTimeType,
                        statisticsStartTime,
                        statisticsEndTime,
                        linkRankList: message.payload
                    });

                    if (success) {
                        persistTaskQueue();
                        runNextTask();
                    } else {
                        console.warn('[Step3] 停止任务队列，等待人工干预或重试');
                        // 可选：taskQueue.unshift(currentTask); // 放回队列末尾等待重试
                    }
                }
            })();
            break;

        case 'cancelScraping':
            console.log('[Task] 用户取消采集任务');
            clearAllAlarms();
            taskQueue = [];
            setScrapingActiveState(false);
            chrome.storage.local.remove('taskQueue');
            updateBadgeText('off');
            break;

        case 'error':
            console.error('[Error] 插件错误：', message.message);
            notifyUser(message.message);
            clearAllAlarms();
            break;

        default:
            console.warn('[Message] 未知类型:', message.action);
    }
});

// ========== 监听 Alarm 触发 ==========
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'hourlyTask') {
        console.log('[Alarm] ⏰ hourlyTask 触发');
        if (isWithinActiveHours() && isScrapingActive) {
            triggerScraping();
        } else {
            createNextDayAlarm();
        }
    } else if (alarm.name === 'nextDayStart') {
        console.log('[Alarm] ⏱️ nextDayStart 触发');
        if (isWithinActiveHours()) {
            if (isScrapingActive) {
                triggerScraping();
                createHourlyAlarm();
            }
        } else {
            createNextDayAlarm();
        }
    }
});

// ========== 监听标签关闭事件，关闭任务 ==========
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabId === currentTabId) {
        console.log('[Tabs] 目标采集标签页关闭，停止任务');
        clearAllAlarms();
        taskQueue = [];
        setScrapingActiveState(false);
        chrome.storage.local.remove('taskQueue');
        updateBadgeText('off');
        currentTabId = null;
    }
});

// ========== 启动时自动恢复 ==========
chrome.runtime.onStartup.addListener(() => {
    console.log('[Startup] Chrome 启动，恢复状态');
    restoreScrapingState();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Install] 插件已安装，初始化状态');
    restoreScrapingState();
});
