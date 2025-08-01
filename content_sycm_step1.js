(function selectAttributes() {
    try {
        const container = document.querySelector('.checkbox-container');
        if (!container) {
            chrome.runtime.sendMessage({
                action: 'error',
                message: 'content_sycm_step1：未找到 .checkbox-container 元素'
            });
            return;
        }

        const items = container.querySelectorAll('.checkbox-item.checked');
        items.forEach(item => {
            const text = item.textContent?.trim();
            if (text && text !== '品牌') {
                item.click();
            }
        });

        chrome.runtime.sendMessage({ action: 'attributeSelectionDone' });

    } catch (error) {
        chrome.runtime.sendMessage({
            action: 'error',
            message: `content_sycm_step1：${error.message}`
        });
    }
})();