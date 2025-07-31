function searchForPinZheng() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function findInTable() {
        const tableBody = document.querySelector('.ant-table-body');
        if (!tableBody) {
            console.warn('未找到表格主体');
            return;
        }

        const rows = tableBody.querySelectorAll('tr');

        for (const row of rows) {
            const firstTd = row.querySelector('td');
            if (firstTd && firstTd.textContent.includes('广州酒家')) {
                console.log('✅ 找到包含“广州酒家”的行:', row);
                // alert('找到“广州酒家”！');
                // return;
                // 找到该行内 class 为 alife-dt-card-common-table-right-column 的 td
                const actionTd = row.querySelector('td.alife-dt-card-common-table-right-column');
                if (actionTd) {
                    const link = actionTd.querySelector('a');
                    if (link) {
                        console.log('点击“商品发现”链接');
                        setTimeout(() => {
                            link.click();
                            chrome.runtime.sendMessage({ type: 'triggerProductDiscoveryDone' });
                        }, 1500)
                        // alert('已点击商品发现！');
                    } else {
                        console.warn('未找到商品发现链接');
                    }
                } else {
                    console.warn('未找到操作列td');
                }

                return;
            }
        }

        // 没找到，尝试下一页
        const nextBtn = document.querySelector('.ant-pagination-next');

        if (!nextBtn) {
            console.warn('未找到下一页按钮');
            alert('找不到分页按钮');
            return;
        }

        if (nextBtn.classList.contains('ant-pagination-disabled')) {
            alert('已到最后一页，未找到“广州酒家”');
            return;
        }

        console.log('未找到，跳转下一页...');
        nextBtn.click();

        // 等待分页加载（你可以根据页面性能调整时间）
        await delay(1500);

        // 递归调用
        findInTable();
    }

    findInTable();
}

// 自动运行
searchForPinZheng();
