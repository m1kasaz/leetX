const records = [
  {
    id: 'two-sum', platform: 'leetcode', badge: 'LC', label: 'LEETCODE · #1', title: '1. 两数之和', date: '今天 15:42', duration: '48 分钟', finalVerdict: 'accepted',
    summaryTitle: '从暴力枚举到哈希表：复杂度由 O(n²) 降至 O(n)',
    summaryText: '你在 48 分钟内进行了 4 次提交，定位并修复了重复元素和下标返回问题，最终形成稳定的一次遍历解法。',
    nodes: [
      { time:'14:54:03', verdict:'wrong_answer', language:'Python3', method:'editor-model', code:'class Solution:\n    def twoSum(self, nums, target):\n        for i in range(len(nums)):\n            for j in range(len(nums)):\n                if nums[i] + nums[j] == target:\n                    return [i, j]', score:48, heading:'存在下标重复使用的问题', summary:'双层循环从同一位置开始，可能返回相同下标。', improvements:['完成了基本枚举思路','能够正确读取目标值'], suggestions:['内层循环应从 i + 1 开始','当前时间复杂度为 O(n²)'], timeComplexity:'O(n²)', spaceComplexity:'O(1)' },
      { time:'15:07:26', verdict:'wrong_answer', language:'Python3', method:'editor-model', code:'class Solution:\n    def twoSum(self, nums, target):\n        for i in range(len(nums)):\n            for j in range(i + 1, len(nums)):\n                if nums[i] + nums[j] == target:\n                    return [i, j]', score:68, heading:'正确性已修复，但仍可优化', summary:'避免了重复下标，暴力枚举可以得到正确结果。', improvements:['修复了 i 与 j 指向同一元素的问题','循环边界更加准确'], suggestions:['使用哈希表消除内层循环','补充无解时的返回值'], timeComplexity:'O(n²)', spaceComplexity:'O(1)' },
      { time:'15:28:44', verdict:'wrong_answer', language:'Python3', method:'textarea', code:'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for value in nums:\n            if target - value in seen:\n                return [seen[target - value], value]\n            seen[value] = value', score:74, heading:'方向正确，返回值仍有偏差', summary:'已经使用哈希表优化，但缓存和返回的是元素值而非下标。', improvements:['将算法优化为一次遍历','正确识别互补值查询'], suggestions:['字典中应保存 value 对应的 index','返回结果应由两个下标组成'], timeComplexity:'O(n)', spaceComplexity:'O(n)' },
      { time:'15:42:08', verdict:'accepted', language:'Python3', method:'editor-model', code:'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for index, value in enumerate(nums):\n            need = target - value\n            if need in seen:\n                return [seen[need], index]\n            seen[value] = index', score:92, heading:'思路正确，已达到最优复杂度', summary:'使用哈希表缓存已遍历元素，可以在一次遍历中找到目标下标。', improvements:['用 enumerate 同时获取元素与下标','字典保存元素到下标的映射','先查询再写入，正确处理重复元素'], suggestions:['可以补充函数返回类型标注','变量 need 命名清晰，可继续保持'], timeComplexity:'O(n)', spaceComplexity:'O(n)' }
    ]
  },
  {
    id:'valid-parentheses', platform:'leetcode', badge:'LC', label:'LEETCODE · #20', title:'20. 有效的括号', date:'今天 14:56', duration:'31 分钟', finalVerdict:'accepted',
    summaryTitle:'从条件分支到栈结构：建立括号匹配模型', summaryText:'3 次提交逐步补齐空栈判断与结尾校验，最终覆盖嵌套、错位和未闭合场景。',
    nodes:[
      {time:'14:25:12',verdict:'wrong_answer',language:'Python3',method:'editor-model',code:'def isValid(s):\n    return "()" in s or "[]" in s or "{}" in s',score:38,heading:'局部匹配无法覆盖嵌套结构',summary:'字符串包含判断不能验证括号顺序。',improvements:['识别了三种括号类型'],suggestions:['使用栈记录左括号','遇到右括号时检查栈顶'],timeComplexity:'O(n)',spaceComplexity:'O(1)'},
      {time:'14:41:09',verdict:'wrong_answer',language:'Python3',method:'editor-model',code:'def isValid(s):\n    stack = []\n    pairs = {")":"(", "]":"[", "}":"{"}\n    for c in s:\n        if c in pairs and stack.pop() != pairs[c]:\n            return False\n        stack.append(c)\n    return True',score:63,heading:'栈模型正确，但存在空栈风险',summary:'pop 前未检查空栈，并且右括号也会被压栈。',improvements:['建立了右括号到左括号映射','开始使用栈处理顺序'],suggestions:['pop 前增加 not stack 判断','只有左括号才入栈'],timeComplexity:'O(n)',spaceComplexity:'O(n)'},
      {time:'14:56:12',verdict:'accepted',language:'Python3',method:'editor-model',code:'def isValid(s):\n    stack = []\n    pairs = {")":"(", "]":"[", "}":"{"}\n    for c in s:\n        if c in pairs:\n            if not stack or stack.pop() != pairs[c]:\n                return False\n        else:\n            stack.append(c)\n    return not stack',score:90,heading:'栈结构完整，边界处理正确',summary:'能够正确处理空栈、嵌套和未闭合括号。',improvements:['增加空栈保护','结尾检查栈是否清空','映射表让逻辑更简洁'],suggestions:['可添加类型标注提升可读性'],timeComplexity:'O(n)',spaceComplexity:'O(n)'}
    ]
  },
  {
    id:'a-plus-b', platform:'luogu', badge:'LG', label:'洛谷 · P1001', title:'P1001 A+B Problem', date:'今天 13:18', duration:'9 分钟', finalVerdict:'accepted',
    summaryTitle:'快速完成输入输出，并修正编译环境差异', summaryText:'2 次提交完成基础输入输出，第二次补充标准头文件与命名空间后通过。',
    nodes:[
      {time:'13:09:02',verdict:'wrong_answer',language:'C++14',method:'editor-model',code:'int main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b;\n}',score:52,heading:'核心逻辑正确，但无法编译',summary:'缺少 iostream 头文件和 std 命名空间。',improvements:['加法与输入输出顺序正确'],suggestions:['引入 iostream','使用 std::cin 或声明命名空间'],timeComplexity:'O(1)',spaceComplexity:'O(1)'},
      {time:'13:18:31',verdict:'accepted',language:'C++14',method:'editor-model',code:'#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b;\n    return 0;\n}',score:95,heading:'实现简洁，符合题目要求',summary:'输入、计算与输出均正确，代码可直接通过。',improvements:['补齐标准头文件','显式返回 0','实现保持简洁'],suggestions:['小项目中可使用 std:: 前缀避免全局命名空间污染'],timeComplexity:'O(1)',spaceComplexity:'O(1)'}
    ]
  }
];

let activeRecord = records[0];
let activeNodeIndex = activeRecord.nodes.length - 1;
let showingDiff = false;
const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));

function verdictLabel(verdict) { return verdict === 'accepted' ? 'Accepted' : 'Wrong Answer'; }
function verdictClass(verdict) { return verdict === 'accepted' ? 'accepted' : 'wrong'; }
function fileName(language) { return language.startsWith('Python') ? 'solution.py' : 'solution.cpp'; }
function showToast(message) { elements.toast.textContent=message; elements.toast.classList.add('show'); setTimeout(()=>elements.toast.classList.remove('show'),1800); }

function renderRecords(filter='all') {
  elements['record-list'].innerHTML='';
  records.forEach((record) => {
    const card=document.createElement('button');
    card.className=`record-card${record.id===activeRecord.id?' active':''}${filter!=='all'&&record.platform!==filter?' hidden':''}`;
    card.innerHTML=`<div class="record-top"><span class="record-platform ${record.platform==='luogu'?'luogu':''}">${record.platform==='luogu'?'洛谷':'LEETCODE'}</span><time class="record-date">${record.date}</time></div><h3>${record.title}</h3><div class="record-bottom"><span>${record.nodes.length} 次提交 · ${record.duration}</span><b>${verdictLabel(record.finalVerdict)}</b><i class="record-verdict ${record.finalVerdict==='accepted'?'':'warning'}"></i></div>`;
    card.addEventListener('click',()=>selectRecord(record));
    elements['record-list'].append(card);
  });
}

function renderTimeline() {
  elements.timeline.innerHTML='';
  activeRecord.nodes.forEach((node,index)=>{
    const button=document.createElement('button');
    button.className=`node${index===activeNodeIndex?' active':''}`;
    button.innerHTML=`<span class="node-index">${String(index+1).padStart(2,'0')}</span><span class="node-main"><span class="node-row"><strong>第 ${index+1} 次提交</strong><time>${node.time}</time></span><span class="node-meta">${node.language}<i></i>${node.method}<em class="node-result ${verdictClass(node.verdict)}">${verdictLabel(node.verdict)}</em></span></span>`;
    button.addEventListener('click',()=>{activeNodeIndex=index;showingDiff=false;renderTimeline();renderDetail();});
    elements.timeline.append(button);
  });
}

function renderList(element,items) { element.innerHTML=''; items.forEach(text=>{const item=document.createElement('li');item.textContent=text;element.append(item);}); }
function diffText(previous,current) {
  if (!previous) return current;
  const oldLines=new Set(previous.split('\n'));
  return current.split('\n').map(line=>`${oldLines.has(line)?'  ':'+ '}${line}`).join('\n');
}

function renderDetail() {
  const node=activeRecord.nodes[activeNodeIndex];
  elements['detail-record-title'].textContent=activeRecord.title;
  elements['detail-node-label'].textContent=`第 ${activeNodeIndex+1} 次提交`;
  elements['detail-time'].textContent=node.time;
  elements['detail-language'].textContent=node.language;
  elements['detail-verdict'].textContent=verdictLabel(node.verdict);
  elements['detail-verdict'].className=verdictClass(node.verdict);
  elements['summary-title'].textContent=activeRecord.summaryTitle;
  elements['summary-text'].textContent=activeRecord.summaryText;
  elements['file-name'].textContent=fileName(node.language);
  const previous=activeRecord.nodes[activeNodeIndex-1]?.code;
  elements['code-view'].textContent=showingDiff?diffText(previous,node.code):node.code;
  elements['code-lines'].textContent=`${node.code.split('\n').length} lines`;
  elements['capture-method'].textContent=`${node.method} · 完整快照`;
  elements.score.textContent=node.score;
  elements['analysis-heading'].textContent=node.heading;
  elements['analysis-summary'].textContent=node.summary;
  elements['time-complexity'].textContent=node.timeComplexity;
  elements['space-complexity'].textContent=node.spaceComplexity;
  renderList(elements.improvements,node.improvements); renderList(elements.suggestions,node.suggestions);
  elements['diff-button'].classList.toggle('active',!showingDiff);
  elements['previous-button'].classList.toggle('active',showingDiff);
}

function selectRecord(record) {
  activeRecord=record; activeNodeIndex=record.nodes.length-1; showingDiff=false;
  elements['platform-badge'].textContent=record.badge;
  elements['platform-badge'].className=`platform-badge${record.platform==='luogu'?' luogu':''}`;
  elements['record-id'].textContent=record.label;
  elements['record-title'].textContent=record.title;
  elements['session-duration'].textContent=record.duration;
  const activeFilter=document.querySelector('.record-filter.active')?.dataset.platform||'all';
  renderRecords(activeFilter); renderTimeline(); renderDetail();
}

document.querySelectorAll('.record-filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.record-filter').forEach(item=>item.classList.remove('active'));button.classList.add('active');renderRecords(button.dataset.platform);}));
elements['diff-button'].addEventListener('click',()=>{showingDiff=false;renderDetail();});
elements['previous-button'].addEventListener('click',()=>{showingDiff=true;renderDetail();});
elements['final-analysis-button'].addEventListener('click',()=>{elements['final-insight'].classList.remove('collapsed');elements['final-insight'].scrollIntoView({behavior:'smooth',block:'nearest'});showToast('已展示本记录最终分析');});
elements['collapse-summary'].addEventListener('click',()=>elements['final-insight'].classList.toggle('collapsed'));
elements['reanalyze-button'].addEventListener('click',()=>{elements['analysis-status'].textContent='AI · 分析中…';showToast('正在重新分析当前节点');setTimeout(()=>elements['analysis-status'].textContent='AI · 已完成',1500);});
elements['settings-button'].addEventListener('click',()=>showToast('API 配置入口将在下一版接入'));
elements['search-button'].addEventListener('click',()=>showToast('可按题目、平台和日期搜索记录'));
document.querySelector('.add-button').addEventListener('click',()=>showToast('提交后将自动生成新的刷题记录'));

renderRecords(); renderTimeline(); renderDetail();
