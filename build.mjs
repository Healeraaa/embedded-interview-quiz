import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(here, 'content');
const outputDir = path.join(here, 'dist');

const banks = [
  { id: 'software', name: '嵌入式软件', file: '嵌入式软件工程师秋招完整问答版_FreeRTOS.md', accent: '#2563eb' },
  { id: 'hardware', name: '嵌入式硬件', file: '硬件工程师秋招面试题库.md', accent: '#e76f51' },
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(value) {
  const codeSpans = [];
  const protectedValue = value.replace(/`([^`]+)`/g, (_, code) => {
    const index = codeSpans.push(code) - 1;
    return `\uE000${index}\uE001`;
  });

  return escapeHtml(protectedValue)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\uE000(\d+)\uE001/g, (_, index) => '<code>' + escapeHtml(codeSpans[Number(index)]) + '</code>');
}

function renderMarkdown(markdown) {
  const lines = markdown.trim().split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let listType = null;
  let quote = [];
  let code = [];
  let inCode = false;
  let codeLanguage = '';

  const flushParagraph = () => {
    if (paragraph.length) out.push('<p>' + inlineMarkdown(paragraph.join(' ')) + '</p>');
    paragraph = [];
  };
  const closeList = () => {
    if (listType) out.push('</' + listType + '>');
    listType = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push('<blockquote>' + inlineMarkdown(quote.join(' ')) + '</blockquote>');
    quote = [];
  };

  for (const line of lines) {
    const fence = line.match(/^```\s*([^\s]*)/);
    if (fence) {
      flushParagraph(); closeList(); flushQuote();
      if (!inCode) {
        inCode = true;
        codeLanguage = fence[1] || '';
      } else {
        const cls = codeLanguage ? ' class="language-' + escapeHtml(codeLanguage) + '"' : '';
        out.push('<pre><code' + cls + '>' + escapeHtml(code.join('\n')) + '</code></pre>');
        code = [];
        inCode = false;
        codeLanguage = '';
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph(); closeList(); flushQuote();
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (bullet || ordered) {
      flushParagraph(); flushQuote();
      const wanted = bullet ? 'ul' : 'ol';
      if (listType !== wanted) {
        closeList();
        listType = wanted;
        out.push('<' + wanted + '>');
      }
      out.push('<li>' + inlineMarkdown((bullet || ordered)[1]) + '</li>');
      continue;
    }
    const q = line.match(/^>\s?(.*)/);
    if (q) {
      flushParagraph(); closeList();
      quote.push(q[1]);
      continue;
    }
    closeList(); flushQuote();
    paragraph.push(line.trim());
  }
  flushParagraph(); closeList(); flushQuote();
  if (inCode) out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
  return out.join('\n');
}

function parseBank(bank) {
  const fullPath = path.join(sourceDir, bank.file);
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  const questions = [];
  let section = '未分类';
  let current = null;

  const finish = () => {
    if (!current) return;
    current.answerHtml = renderMarkdown(current.answer.join('\n'));
    delete current.answer;
    questions.push(current);
    current = null;
  };

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(?!#)(.+)$/);
    if (sectionMatch) {
      finish();
      section = sectionMatch[1].trim();
      continue;
    }
    const questionMatch = line.match(/^###\s+([\d.]+)\s+(.+?)(?:【(★+)】)?\s*$/);
    if (questionMatch) {
      finish();
      let title = questionMatch[2].trim();
      let stars = questionMatch[3]?.length || 0;
      const inlineStars = title.match(/\s*【(★+)】\s*$/);
      if (inlineStars) {
        stars = inlineStars[1].length;
        title = title.slice(0, inlineStars.index).trim();
      }
      current = {
        id: bank.id + '-' + questionMatch[1],
        bankId: bank.id,
        number: questionMatch[1],
        title,
        stars,
        section,
        answer: [],
      };
      continue;
    }
    if (current) current.answer.push(line);
  }
  finish();
  return { ...bank, questions };
}

const data = banks.map(parseBank);
const total = data.reduce((sum, bank) => sum + bank.questions.length, 0);

const pointerRegression = inlineMarkdown('`int *a[10]` 与 `int (*p)[10]`，解引用为 `*p`');
if (!pointerRegression.includes('<code>int *a[10]</code>') ||
    !pointerRegression.includes('<code>int (*p)[10]</code>') ||
    !pointerRegression.includes('<code>*p</code>')) {
  throw new Error('Inline-code regression: pointer asterisks were not preserved.');
}

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="嵌入式软件与硬件秋招面试题练习工具">
  <title>嵌入式面试题练习</title>
  <style>
    :root { --bg:#f4f6f8; --paper:#fffdfa; --ink:#172033; --muted:#667085; --line:#e3e7ed; --blue:#2563eb; --orange:#e76f51; --green:#16805a; --shadow:0 18px 55px rgba(30,42,70,.11); }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:radial-gradient(circle at 15% 0%,#e7efff 0,transparent 28rem),radial-gradient(circle at 100% 100%,#fff0e8 0,transparent 25rem),var(--bg); font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif; min-height:100vh; }
    button,input,select { font:inherit; }
    button { cursor:pointer; }
    .app { width:min(1180px,calc(100% - 32px)); margin:0 auto; padding:34px 0 56px; }
    header { display:flex; gap:22px; align-items:flex-end; justify-content:space-between; margin-bottom:24px; }
    .eyebrow { color:var(--blue); font-weight:800; letter-spacing:.14em; font-size:12px; }
    h1 { margin:6px 0 5px; font-size:clamp(28px,5vw,46px); letter-spacing:-.04em; }
    .subtitle { margin:0; color:var(--muted); }
    .progress-box { min-width:220px; text-align:right; }
    .progress-label { display:flex; justify-content:space-between; color:var(--muted); font-size:13px; margin-bottom:8px; }
    .progress-track { height:9px; border-radius:99px; background:#dfe4eb; overflow:hidden; }
    .progress-fill { height:100%; width:0; background:linear-gradient(90deg,var(--blue),#65a2ff); transition:width .25s; }
    .layout { display:grid; grid-template-columns:280px minmax(0,1fr); gap:22px; align-items:start; }
    [hidden] { display:none!important; }
    .panel,.card { background:rgba(255,253,250,.94); border:1px solid rgba(255,255,255,.8); border-radius:22px; box-shadow:var(--shadow); }
    .panel { padding:20px; position:sticky; top:18px; }
    .field { margin-bottom:17px; }
    .field label { display:block; font-size:12px; font-weight:800; color:#536077; margin:0 0 7px; }
    .plan-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    select,input[type="search"],textarea { width:100%; border:1px solid var(--line); border-radius:11px; padding:10px 11px; color:var(--ink); background:white; outline:none; }
    select:focus,input:focus,textarea:focus { border-color:#8ab0fb; box-shadow:0 0 0 3px #dce8ff; }
    .bank-tabs { display:grid; gap:8px; }
    .bank-tab { text-align:left; border:1px solid var(--line); border-radius:12px; background:#fff; padding:11px 12px; color:#465066; font-weight:700; }
    .bank-tab.active { color:#fff; border-color:transparent; background:var(--accent); }
    .summary { font-size:13px; line-height:1.7; color:var(--muted); border-top:1px solid var(--line); padding-top:14px; margin-top:4px; }
    .card { min-height:580px; padding:clamp(24px,5vw,56px); display:flex; flex-direction:column; }
    #quiz { min-height:470px; display:flex; flex:1; flex-direction:column; }
    .meta { display:flex; align-items:center; flex-wrap:wrap; gap:9px; color:var(--muted); font-size:13px; }
    .tag { padding:5px 9px; border-radius:99px; background:#edf2fa; color:#40516e; font-weight:700; }
    .stars { color:#e9a31b; letter-spacing:.04em; }
    .question { font-size:clamp(24px,3.3vw,38px); line-height:1.35; letter-spacing:-.025em; margin:28px 0; }
    .reveal { align-self:flex-start; border:0; border-radius:13px; padding:13px 20px; background:var(--ink); color:white; font-weight:800; box-shadow:0 7px 18px rgba(23,32,51,.18); }
    .answer { display:none; margin-top:24px; padding-top:24px; border-top:1px solid var(--line); font-size:16px; line-height:1.85; animation:fade .2s ease; }
    .answer.open { display:block; }
    .answer p:first-child { margin-top:0; }
    .answer code { font-family:Consolas,monospace; background:#eff2f5; border-radius:5px; padding:.12em .32em; font-size:.92em; }
    .answer pre { overflow:auto; padding:16px; color:#e7edf7; background:#172033; border-radius:12px; line-height:1.55; }
    .answer pre code { background:transparent; padding:0; }
    .answer blockquote { margin:1em 0; padding:10px 16px; border-left:4px solid #9db9ed; background:#f2f6fd; color:#44516a; }
    .answer li { margin:.35em 0; }
    .spacer { flex:1; min-height:28px; }
    .rating { display:none; margin-top:22px; gap:9px; flex-wrap:wrap; }
    .rating.open { display:flex; }
    .rate { border:1px solid var(--line); border-radius:10px; padding:9px 14px; background:white; color:#465066; }
    .rate.selected { color:white; border-color:transparent; }
    .rate[data-value="again"].selected { background:#c2413a; }
    .rate[data-value="fuzzy"].selected { background:#c48413; }
    .rate[data-value="know"].selected { background:var(--green); }
    .notes { margin-top:24px; padding:18px; border:1px solid var(--line); border-radius:14px; background:#f8fafc; }
    .notes-head { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px; }
    .notes-title { font-size:14px; font-weight:800; color:#40516e; }
    .notes-status { color:var(--muted); font-size:12px; }
    .notes textarea { display:block; min-height:112px; resize:vertical; font:inherit; line-height:1.65; }
    .data-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
    .data-actions button { border:1px solid var(--line); border-radius:10px; padding:9px 8px; background:#fff; color:#465066; font-weight:700; }
    .nav { margin-top:28px; padding-top:20px; border-top:1px solid var(--line); display:flex; gap:10px; align-items:center; }
    .nav button { border:1px solid var(--line); border-radius:11px; padding:10px 15px; background:white; color:var(--ink); font-weight:700; }
    .nav button:hover,.rate:hover { border-color:#aeb9ca; }
    .nav button:disabled { opacity:.4; cursor:not-allowed; }
    .position { margin-left:auto; color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
    .empty { margin:auto; text-align:center; color:var(--muted); }
    .kbd { border:1px solid #cfd5de; border-bottom-width:2px; border-radius:5px; padding:1px 5px; background:#fff; color:#606b7e; font-size:11px; }
    @keyframes fade { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }
    @media (max-width:780px) { .app{width:min(100% - 20px,680px);padding-top:20px} header{align-items:flex-start;flex-direction:column}.progress-box{width:100%;text-align:left}.layout{grid-template-columns:1fr}.panel{position:static}.bank-tabs{grid-template-columns:1fr 1fr}.card{min-height:520px;padding:24px;border-radius:18px}.question{margin:23px 0}.position{margin-left:0;width:100%;order:-1}.nav{flex-wrap:wrap}.nav button{flex:1}.nav .random{flex-basis:100%} }
    @media print { body{background:white}.panel,header,.nav,.reveal,.rating,.notes{display:none!important}.layout{display:block}.card{box-shadow:none;border:0;padding:0}.answer{display:block}.question{font-size:24px} }
  </style>
</head>
<body>
  <main class="app">
    <header>
      <div><div class="eyebrow">INTERVIEW DRILL</div><h1>嵌入式面试题练习</h1><p class="subtitle">先在心里作答，再点击查看参考答案。</p></div>
      <div class="progress-box"><div class="progress-label"><span>已掌握进度</span><strong id="progressText">0 / ${total}</strong></div><div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></div>
    </header>
    <div class="layout">
      <aside class="panel">
        <div class="field"><label>题库</label><div class="bank-tabs" id="bankTabs"></div></div>
        <div class="field"><label for="modeSelect">学习模式</label><select id="modeSelect"><option value="all">自由练习</option><option value="plan">按天学习</option><option value="review">复习队列</option></select></div>
        <div class="field" id="planControls" hidden><label>学习计划</label><div class="plan-grid"><select id="planDays" aria-label="计划天数"><option value="7">7 天</option><option value="14">14 天</option><option value="21">21 天</option><option value="30">30 天</option></select><select id="planDay" aria-label="学习第几天"></select></div></div>
        <div class="field"><label for="sectionSelect">章节</label><select id="sectionSelect"></select></div>
        <div class="field"><label for="starSelect">重要程度</label><select id="starSelect"><option value="0">全部星级</option><option value="5">★★★★★ 五星必问</option><option value="4">★★★★ 四星高频</option><option value="3">★★★ 三星常见</option><option value="2">★★ 两星</option><option value="1">★ 一星</option></select></div>
        <div class="field"><label for="statusSelect">掌握状态</label><select id="statusSelect"><option value="all">全部状态</option><option value="unrated">尚未标记</option><option value="again">不会</option><option value="fuzzy">模糊</option><option value="know">会</option></select></div>
        <div class="field"><label for="searchInput">搜索题目和答案</label><input id="searchInput" type="search" placeholder="例如：优先级反转"></div>
        <div class="field"><label>个人笔记备份</label><div class="data-actions"><button id="exportNotes" type="button">导出笔记</button><button id="importNotes" type="button">导入笔记</button></div><input id="notesFile" type="file" accept="application/json,.json" hidden></div>
        <div class="summary" id="filterSummary"></div>
      </aside>
      <section class="card" id="card" aria-live="polite">
        <div id="quiz">
          <div class="meta"><span class="tag" id="sectionTag"></span><span class="tag" id="reviewTag" hidden></span><span id="bankName"></span><span class="stars" id="stars"></span></div>
          <h2 class="question" id="question"></h2>
          <button class="reveal" id="revealButton" type="button">查看答案 <span class="kbd">空格</span></button>
          <div class="answer" id="answer"></div>
          <div class="rating" id="rating"><button class="rate" data-value="again">不会</button><button class="rate" data-value="fuzzy">模糊</button><button class="rate" data-value="know">会</button></div>
          <div class="notes"><div class="notes-head"><span class="notes-title">个人笔记</span><span class="notes-status" id="notesStatus">自动保存在此浏览器</span></div><textarea id="notesText" placeholder="写下自己的理解、易错点或需要追问的内容……"></textarea></div>
          <div class="spacer"></div>
          <nav class="nav"><button id="previousButton">← 上一题</button><button id="nextButton">下一题 →</button><button class="random" id="randomButton">随机一题</button><span class="position" id="position"></span></nav>
        </div>
        <div class="empty" id="empty" hidden><h2 id="emptyTitle">没有匹配的题目</h2><p id="emptyText">请调整章节、星级、状态或搜索词。</p></div>
      </section>
    </div>
  </main>
  <script>
    const BANKS = ${JSON.stringify(data)};
    const allQuestions = BANKS.flatMap(bank => bank.questions);
    const savedPlanDays = Number(localStorage.getItem('embedded-interview-plan-days-v1')) || 14;
    const savedPlanDay = Number(localStorage.getItem('embedded-interview-plan-day-v1')) || 1;
    const state = { bank:'software', mode:'all', planDays:[7,14,21,30].includes(savedPlanDays) ? savedPlanDays : 14, planDay:savedPlanDay, section:'all', stars:0, status:'all', search:'', index:0, revealed:false };
    function storedObject(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
    const ratings = storedObject('embedded-interview-ratings-v1');
    const reviewSchedule = storedObject('embedded-interview-review-schedule-v1');
    const notes = storedObject('embedded-interview-notes-v1');
    let migratedReviewSchedule = false;
    allQuestions.forEach(q => {
      if (!reviewSchedule[q.id] && (ratings[q.id] === 'again' || ratings[q.id] === 'fuzzy')) {
        reviewSchedule[q.id] = { rating:ratings[q.id], dueDay:ratings[q.id] === 'again' ? 2 : 4 };
        migratedReviewSchedule = true;
      }
    });
    if (migratedReviewSchedule) localStorage.setItem('embedded-interview-review-schedule-v1',JSON.stringify(reviewSchedule));
    const $ = id => document.getElementById(id);
    const elements = { tabs:$('bankTabs'), mode:$('modeSelect'), planControls:$('planControls'), planDays:$('planDays'), planDay:$('planDay'), section:$('sectionSelect'), stars:$('starSelect'), status:$('statusSelect'), search:$('searchInput'), summary:$('filterSummary'), tag:$('sectionTag'), reviewTag:$('reviewTag'), bank:$('bankName'), starText:$('stars'), question:$('question'), reveal:$('revealButton'), answer:$('answer'), rating:$('rating'), notesText:$('notesText'), notesStatus:$('notesStatus'), exportNotes:$('exportNotes'), importNotes:$('importNotes'), notesFile:$('notesFile'), previous:$('previousButton'), next:$('nextButton'), random:$('randomButton'), position:$('position'), progressText:$('progressText'), progressFill:$('progressFill'), card:$('card'), quiz:$('quiz'), empty:$('empty'), emptyTitle:$('emptyTitle'), emptyText:$('emptyText') };

    function activeBank() { return BANKS.find(bank => bank.id === state.bank); }
    function hashText(value) {
      let hash = 2166136261;
      for (let i=0;i<value.length;i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash,16777619); }
      return hash >>> 0;
    }
    function shuffled(items,seed) {
      const result = [...items];
      let value = seed || 1;
      for (let i=result.length-1;i>0;i--) {
        value = (Math.imul(value,1664525) + 1013904223) >>> 0;
        const j = value % (i+1);
        [result[i],result[j]] = [result[j],result[i]];
      }
      return result;
    }
    function assignedQuestionsForDay(questions) {
      const grouped = new Map();
      questions.forEach(q => { if (!grouped.has(q.section)) grouped.set(q.section,[]); grouped.get(q.section).push(q); });
      const assigned = [];
      grouped.forEach((chapter,section) => {
        const seedBase = activeBank().id + '|' + section + '|' + state.planDays;
        const chapterQuestions = shuffled(chapter,hashText(seedBase));
        const dayOffset = hashText(seedBase + '|offset') % state.planDays;
        chapterQuestions.forEach((q,index) => {
          if ((index + dayOffset) % state.planDays + 1 === state.planDay) assigned.push(q);
        });
      });
      return shuffled(assigned,hashText(activeBank().id + '|day|' + state.planDays + '|' + state.planDay));
    }
    function modeQuestions() {
      const questions = activeBank().questions;
      if (state.mode === 'review') return questions.filter(q => reviewSchedule[q.id]).sort((a,b) => reviewSchedule[a.id].dueDay - reviewSchedule[b.id].dueDay);
      if (state.mode === 'plan') {
        const assigned = assignedQuestionsForDay(questions);
        const due = questions.filter(q => reviewSchedule[q.id] && Math.min(reviewSchedule[q.id].dueDay,state.planDays) <= state.planDay);
        const dueIds = new Set(due.map(q => q.id));
        return [...due,...assigned.filter(q => !dueIds.has(q.id))];
      }
      return questions;
    }
    function filtered() {
      const term = state.search.trim().toLowerCase();
      return modeQuestions().filter(q =>
        (state.section === 'all' || q.section === state.section) &&
        (!state.stars || q.stars === state.stars) &&
        (state.status === 'all' || (state.status === 'unrated' ? !ratings[q.id] : ratings[q.id] === state.status)) &&
        (!term || (q.title + ' ' + q.section + ' ' + q.answerHtml.replace(/<[^>]*>/g,' ') + ' ' + (notes[q.id] || '')).toLowerCase().includes(term))
      );
    }
    function populateSections() {
      const sections = [...new Set(activeBank().questions.map(q => q.section))];
      elements.section.innerHTML = '<option value="all">全部章节</option>' + sections.map(s => '<option value="' + s.replaceAll('"','&quot;') + '">' + s + '</option>').join('');
      elements.section.value = state.section;
    }
    function populatePlanDays() {
      state.planDay = Math.max(1,Math.min(state.planDays,state.planDay));
      elements.planDays.value = String(state.planDays);
      elements.planDay.innerHTML = Array.from({length:state.planDays},(_,i) => '<option value="' + (i+1) + '">第 ' + (i+1) + ' 天</option>').join('');
      elements.planDay.value = String(state.planDay);
    }
    function renderTabs() {
      elements.tabs.innerHTML = BANKS.map(bank => '<button class="bank-tab ' + (bank.id === state.bank ? 'active' : '') + '" style="--accent:' + bank.accent + '" data-bank="' + bank.id + '">' + bank.name + '<br><small>' + bank.questions.length + ' 道题</small></button>').join('');
    }
    function updateProgress() {
      const known = allQuestions.filter(q => ratings[q.id] === 'know').length;
      elements.progressText.textContent = known + ' / ' + allQuestions.length;
      elements.progressFill.style.width = (known / allQuestions.length * 100) + '%';
    }
    function render() {
      renderTabs(); updateProgress();
      const list = filtered();
      const reviewCount = activeBank().questions.filter(q => reviewSchedule[q.id]).length;
      if (state.index >= list.length) state.index = Math.max(0,list.length - 1);
      elements.planControls.hidden = state.mode !== 'plan';
      elements.status.disabled = state.mode === 'review';
      const modeLabel = state.mode === 'plan' ? state.planDays + ' 天分层计划 · 第 ' + state.planDay + ' 天' : state.mode === 'review' ? '复习队列' : '自由练习';
      elements.summary.textContent = modeLabel + '：当前 ' + list.length + ' 道；本题库待复习 ' + reviewCount + ' 道。';
      if (!list.length) {
        elements.quiz.hidden = true;
        elements.empty.hidden = false;
        elements.emptyTitle.textContent = state.mode === 'review' ? '复习池已经清空' : '没有匹配的题目';
        elements.emptyText.textContent = state.mode === 'review' ? '标记为“不会”或“模糊”的题会自动出现在这里。' : '请调整学习天数、章节、星级、状态或搜索词。';
        return;
      }
      elements.quiz.hidden = false;
      elements.empty.hidden = true;
      const q = list[state.index];
      elements.tag.textContent = q.section;
      const review = reviewSchedule[q.id];
      elements.reviewTag.hidden = !review;
      elements.reviewTag.textContent = review ? '复习题 · 第 ' + Math.min(review.dueDay,state.planDays) + ' 天到期' : '';
      elements.bank.textContent = activeBank().name + ' · ' + q.number;
      elements.starText.textContent = '★'.repeat(q.stars);
      elements.question.textContent = q.title;
      elements.answer.innerHTML = q.answerHtml;
      elements.notesText.value = notes[q.id] || '';
      elements.notesStatus.textContent = notes[q.id] ? '已保存' : '自动保存在此浏览器';
      elements.answer.classList.toggle('open',state.revealed);
      elements.rating.classList.toggle('open',state.revealed);
      elements.reveal.innerHTML = state.revealed ? '收起答案 <span class="kbd">空格</span>' : '查看答案 <span class="kbd">空格</span>';
      elements.previous.disabled = state.index === 0;
      elements.next.disabled = state.index === list.length - 1;
      elements.position.textContent = (state.index + 1) + ' / ' + list.length;
      document.querySelectorAll('.rate').forEach(btn => btn.classList.toggle('selected',ratings[q.id] === btn.dataset.value));
    }
    function resetQuestion() { state.index = 0; state.revealed = false; render(); }
    function move(delta) { const list = filtered(); state.index = Math.max(0,Math.min(list.length - 1,state.index + delta)); state.revealed = false; render(); window.scrollTo({top:0,behavior:'smooth'}); }
    elements.tabs.addEventListener('click', event => { const btn=event.target.closest('[data-bank]'); if(!btn)return; state.bank=btn.dataset.bank; state.section='all'; populateSections(); populatePlanDays(); resetQuestion(); });
    elements.mode.addEventListener('change',e=>{state.mode=e.target.value;if(state.mode==='review'){state.status='all';elements.status.value='all'}resetQuestion()});
    elements.planDays.addEventListener('change',e=>{state.planDays=Number(e.target.value);state.planDay=1;localStorage.setItem('embedded-interview-plan-days-v1',String(state.planDays));localStorage.setItem('embedded-interview-plan-day-v1','1');populatePlanDays();resetQuestion()});
    elements.planDay.addEventListener('change',e=>{state.planDay=Number(e.target.value);localStorage.setItem('embedded-interview-plan-day-v1',String(state.planDay));resetQuestion()});
    elements.section.addEventListener('change',e=>{state.section=e.target.value;resetQuestion()});
    elements.stars.addEventListener('change',e=>{state.stars=Number(e.target.value);resetQuestion()});
    elements.status.addEventListener('change',e=>{state.status=e.target.value;resetQuestion()});
    elements.search.addEventListener('input',e=>{state.search=e.target.value;resetQuestion()});
    elements.reveal.addEventListener('click',()=>{state.revealed=!state.revealed;render()});
    elements.previous.addEventListener('click',()=>move(-1));
    elements.next.addEventListener('click',()=>move(1));
    elements.random.addEventListener('click',()=>{const list=filtered();if(list.length){state.index=Math.floor(Math.random()*list.length);state.revealed=false;render()}});
    elements.rating.addEventListener('click',event=>{const btn=event.target.closest('[data-value]');if(!btn)return;const q=filtered()[state.index];const value=btn.dataset.value;ratings[q.id]=value;if(value==='again'||value==='fuzzy'){const interval=value==='again'?1:3;reviewSchedule[q.id]={rating:value,dueDay:Math.min(state.planDays,state.planDay+interval)}}else{delete reviewSchedule[q.id]}localStorage.setItem('embedded-interview-ratings-v1',JSON.stringify(ratings));localStorage.setItem('embedded-interview-review-schedule-v1',JSON.stringify(reviewSchedule));render()});
    elements.notesText.addEventListener('input',()=>{const q=filtered()[state.index];if(!q)return;const value=elements.notesText.value;if(value.trim()){notes[q.id]=value}else{delete notes[q.id]}localStorage.setItem('embedded-interview-notes-v1',JSON.stringify(notes));elements.notesStatus.textContent='已保存';});
    elements.exportNotes.addEventListener('click',()=>{const payload={version:1,exportedAt:new Date().toISOString(),notes};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='嵌入式面试题个人笔记.json';link.click();URL.revokeObjectURL(link.href)});
    elements.importNotes.addEventListener('click',()=>elements.notesFile.click());
    elements.notesFile.addEventListener('change',async()=>{const file=elements.notesFile.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const imported=parsed && parsed.notes && typeof parsed.notes==='object' ? parsed.notes : parsed;if(!imported || Array.isArray(imported) || typeof imported!=='object')throw new Error('格式错误');Object.keys(notes).forEach(key=>delete notes[key]);Object.entries(imported).forEach(([key,value])=>{if(typeof value==='string'&&value.trim())notes[key]=value});localStorage.setItem('embedded-interview-notes-v1',JSON.stringify(notes));render();alert('已导入 '+Object.keys(notes).length+' 条个人笔记。')}catch(error){alert('导入失败：请选择由本网页导出的 JSON 笔记文件。')}finally{elements.notesFile.value=''}});
    document.addEventListener('keydown',event=>{if(event.target.matches('input,select,textarea'))return;if(event.code==='Space'){event.preventDefault();state.revealed=!state.revealed;render()}if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1)});
    populateSections(); populatePlanDays(); render();
  </script>
</body>
</html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '', 'utf8');
const scriptSource = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
if (!scriptSource) throw new Error('Generated page is missing its application script.');
new Function(scriptSource);
console.log(`Built and syntax-checked ${total} questions (${data.map(bank => bank.name + ': ' + bank.questions.length).join(', ')}) to ${path.join(outputDir, 'index.html')}`);

