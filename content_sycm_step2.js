(function searchForPinZheng() {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function findInTable() {
        try {
            const tableBody = document.querySelector('.ant-table-body');
            if (!tableBody) {
                chrome.runtime.sendMessage({
                    action: 'error',
                    message: 'content_sycm_step2：未找到表格主体 .ant-table-body'
                });
                return;
            }

            const rows = tableBody.querySelectorAll('tr');

            for (const row of rows) {
                const firstTd = row.querySelector('td');
                if (firstTd && firstTd.textContent.includes('广州酒家')) {

                    const actionTd = row.querySelector('td.alife-dt-card-common-table-right-column');
                    if (!actionTd) {
                        chrome.runtime.sendMessage({
                            action: 'error',
                            message: 'content_sycm_step2：未找到操作列 td.alife-dt-card-common-table-right-column'
                        });
                        return;
                    }

                    const link = actionTd.querySelector('a');
                    if (!link) {
                        chrome.runtime.sendMessage({
                            action: 'error',
                            message: 'content_sycm_step2：未找到商品发现链接 <a>'
                        });
                        return;
                    }

                    setTimeout(() => {
                        link.click();
                        chrome.runtime.sendMessage({ action: 'triggerProductDiscoveryDone' });
                    }, 1500);

                    return; // 找到并处理完毕，退出函数
                }
            }

            // 没找到匹配项，尝试翻页
            const nextBtn = document.querySelector('.ant-pagination-next');
            if (!nextBtn) {
                chrome.runtime.sendMessage({
                    action: 'error',
                    message: 'content_sycm_step2：未找到分页按钮 .ant-pagination-next'
                });
                return;
            }

            if (nextBtn.classList.contains('ant-pagination-disabled')) {
                chrome.runtime.sendMessage({
                    action: 'error',
                    message: 'content_sycm_step2：已到最后一页，未找到“广州酒家”'
                });
                return;
            }

            nextBtn.click();
            await delay(1500); // 等待分页内容加载
            await findInTable(); // 递归调用下一页

        } catch (error) {
            chrome.runtime.sendMessage({
                action: 'error',
                message: `content_sycm_step2：${error.message}`
            });
        }
    }

    findInTable();
})();
