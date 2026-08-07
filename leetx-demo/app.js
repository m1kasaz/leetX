const filterButtons = document.querySelectorAll('.filter');
const captureCards = document.querySelectorAll('.capture-card');
const detailPanel = document.querySelector('#detail-panel');
const codePreview = document.querySelector('#code-preview');
const closeDetail = document.querySelector('#close-detail');
const simulateButton = document.querySelector('#simulate-button');
const captureList = document.querySelector('#capture-list');
const captureCount = document.querySelector('#capture-count');
const refreshButton = document.querySelector('#refresh-button');
const toast = document.querySelector('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function bindCaptureCard(card) {
  card.addEventListener('click', () => {
    document.querySelectorAll('.capture-card').forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    codePreview.textContent = card.dataset.code || '// 暂无代码快照';
    detailPanel.classList.add('open');
  });
}

captureCards.forEach(bindCaptureCard);

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const filter = button.dataset.filter;
    document.querySelectorAll('.capture-card').forEach((card) => {
      card.classList.toggle('hidden', filter !== 'all' && card.dataset.platform !== filter);
    });
  });
});

closeDetail.addEventListener('click', () => detailPanel.classList.remove('open'));

refreshButton.addEventListener('click', () => {
  refreshButton.classList.remove('rotating');
  void refreshButton.offsetWidth;
  refreshButton.classList.add('rotating');
  showToast('采集状态已刷新');
});

simulateButton.addEventListener('click', () => {
  const card = document.createElement('button');
  card.className = 'capture-card new-card';
  card.dataset.platform = 'leetcode';
  card.dataset.code = 'class Solution:\n    def maxProfit(self, prices):\n        best = 0\n        lowest = prices[0]\n        for price in prices[1:]:\n            best = max(best, price - lowest)\n            lowest = min(lowest, price)\n        return best';
  card.innerHTML = `
    <span class="platform-logo lc">LC</span>
    <span class="card-content">
      <span class="card-row"><strong>121. 买卖股票的最佳时机</strong><em class="verdict pending">判题中</em></span>
      <span class="meta">Python3 <i></i> 刚刚 <i></i> editor-model</span>
    </span>
    <span class="spinner"></span>
  `;
  captureList.prepend(card);
  bindCaptureCard(card);
  captureCount.textContent = String(Number(captureCount.textContent) + 1);
  showToast('已捕获新的代码快照');

  window.setTimeout(() => {
    const verdict = card.querySelector('.verdict');
    const spinner = card.querySelector('.spinner');
    verdict.textContent = 'Accepted';
    verdict.className = 'verdict accepted';
    spinner.outerHTML = '<span class="chevron">›</span>';
    showToast('判题结果已更新：Accepted');
  }, 2200);
});
