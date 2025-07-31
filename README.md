# 生意参谋页面数据爬取插件

## 千牛登录，若登录失效，需要通过飞书机器人发送【登录失效】通知

### 相关地址

千牛首页地址：https://myseller.taobao.com

千牛登录地址：https://loginmyseller.taobao.com

### 点击拓展程序开始校验

```js
// background.js

......

// 登录成功后的操作逻辑
function onLoginSuccess(tabId) {
    console.log("✅ 登录成功，执行后续业务逻辑");
}

// 设置导航监听器
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

// 扩展图标点击逻辑
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

......
```

## 进入类目洞察页面

### 相关地址

类目洞察地址：https://sycm.taobao.com/mc/free/class_analysis?activeKey=attribute&dateRange=2025-07-23%7C2025-07-29&dateType=recent7&parentCateId=201898103&cateId=50008062&sellerType=-1&indType=pay_ord_amt

### 修改cateId的参数的值，进行类目筛选

50008062--零食/坚果/特产 > 月饼
50025684--粮油调味/速食/干货/烘焙 > 面点/西式速食 > 面点类速食 > 包点

```js
// background.js

......

// 登录成功后的操作逻辑
function onLoginSuccess(tabId) {
    console.log("✅ 登录成功，执行后续业务逻辑");

    chrome.tabs.update(tabId, {
        url: `https://sycm.taobao.com/mc/free/class_analysis?activeKey=attribute&dateRange=2025-07-23%7C2025-07-29&dateType=recent7&parentCateId=201898103&cateId=50025684&sellerType=-1&indType=pay_ord_amt`
    }, function (tab) {
        console.log("已更新当前标签页");
        setupNavigationListener(tab.id);
    });
}

......
```

