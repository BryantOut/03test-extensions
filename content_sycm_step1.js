(function selectAttributes() {
    const container = document.querySelector('.checkbox-container');
    if (!container) return;

    const items = container.querySelectorAll('.checkbox-item.checked');
    items.forEach(item => {
        const text = item.textContent.trim();
        if (text !== '品牌') {
            item.click();
        }
    });

    console.log('属性筛选已处理');

    // ✅ 如果需要，调用下一步操作
    // step2Start();
})();
