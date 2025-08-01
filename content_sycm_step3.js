(function collectDrawerCurrentPageData() {
  try {
    const tableBody = document.querySelector('.ant-drawer-content-wrapper .ant-table-body tbody');
    if (!tableBody) {
      chrome.runtime.sendMessage({
        action: 'error',
        message: 'content_sycm_step3：未找到表格内容 tbody'
      });
      return;
    }

    const rows = tableBody.querySelectorAll('tr');
    const result = [];

    rows.forEach((row, index) => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 4) return;

      const firstTd = tds[0];
      const linkId = firstTd.querySelector('.goods-subIndex-text')?.textContent.trim() || '';

      const imgEl = firstTd.querySelector('.goodsImg img');
      const imgSrc = imgEl?.getAttribute('src')?.trim() || '';
      const fullImgSrc = imgSrc.startsWith('http') ? imgSrc : `https:${imgSrc}`;

      const linkName = firstTd.querySelector('.singleGoodsName a')?.textContent.trim() || '';

      const payAmt = tds[1].querySelector('.alife-dt-card-common-table-sortable-value span')?.textContent.trim() || '';
      const payVol = tds[2].querySelector('.alife-dt-card-common-table-sortable-value span')?.textContent.trim() || '';
      const unitPrice = tds[3].querySelector('.alife-dt-card-common-table-sortable-value span')?.textContent.trim() || '';

      result.push({
        排名: index + 1,
        链接ID: linkId,
        链接图片: fullImgSrc,
        链接名称: linkName,
        支付金额: payAmt,
        支付单量: payVol,
        件单价: unitPrice
      });
    });

    chrome.runtime.sendMessage({
      action: 'drawerData',
      payload: result
    });

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'error',
      message: `content_sycm_step3：${error.message}`
    });
  }
})();
