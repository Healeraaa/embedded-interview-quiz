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
    button,input,select,textarea { font:inherit; }
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
    .filter-toggle { display:none; width:100%; align-items:center; justify-content:space-between; border:0; background:transparent; color:var(--ink); padding:3px 2px; font-weight:800; }
    .filter-toggle span { color:var(--blue); font-size:13px; }
    .field { margin-bottom:17px; }
    .field label { display:block; font-size:12px; font-weight:800; color:#536077; margin:0 0 7px; }
    .plan-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    select,input[type="search"],textarea { width:100%; border:1px solid var(--line); border-radius:11px; padding:10px 11px; color:var(--ink); background:white; outline:none; }
    select:focus,input:focus,textarea:focus { border-color:#8ab0fb; box-shadow:0 0 0 3px #dce8ff; }
    .bank-tabs { display:grid; gap:8px; }
    .bank-tab { text-align:left; border:1px solid var(--line); border-radius:12px; background:#fff; padding:11px 12px; color:#465066; font-weight:700; }
    .bank-tab.active { color:#fff; border-color:transparent; background:var(--accent); }
    .summary { font-size:13px; line-height:1.7; color:var(--muted); border-top:1px solid var(--line); padding-top:14px; margin-top:4px; }
    .account-box { margin-bottom:18px; padding:14px; border:1px solid #cddbf4; border-radius:14px; background:#f3f7ff; }
    .account-head { display:flex; align-items:center; gap:8px; margin-bottom:9px; font-size:13px; font-weight:800; }
    .sync-dot { width:8px; height:8px; border-radius:50%; background:#98a2b3; flex:none; }
    .sync-dot.online { background:var(--green); box-shadow:0 0 0 3px rgba(22,128,90,.12); }
    .sync-dot.error { background:#c2413a; }
    .sync-detail { min-height:18px; margin-bottom:10px; color:var(--muted); font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
    .account-box button { width:100%; border:0; border-radius:10px; padding:9px 10px; color:#fff; background:var(--blue); font-weight:800; }
    .card { min-height:580px; padding:clamp(24px,5vw,56px); display:flex; flex-direction:column; }
    #quiz { min-height:470px; display:flex; flex:1; flex-direction:column; }
    .meta { display:flex; align-items:center; flex-wrap:wrap; gap:9px; color:var(--muted); font-size:13px; }
    .question-jump { display:flex; align-items:center; gap:7px; margin-left:auto; color:#536077; font-weight:700; }
    .question-jump select { width:min(260px,42vw); padding:7px 9px; font-size:13px; }
    .tag { padding:5px 9px; border-radius:99px; background:#edf2fa; color:#40516e; font-weight:700; }
    .stars { color:#e9a31b; letter-spacing:.04em; }
    .question { font-size:clamp(24px,3.3vw,38px); line-height:1.35; letter-spacing:-.025em; margin:28px 0; }
    .reveal { align-self:flex-start; border:0; border-radius:13px; padding:13px 20px; background:var(--ink); color:white; font-weight:800; box-shadow:0 7px 18px rgba(23,32,51,.18); }
    .answer { display:none; margin-top:24px; padding-top:24px; border-top:1px solid var(--line); font-size:16px; line-height:1.85; animation:fade .2s ease; }
    .answer.open { display:block; }
    .answer-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .answer-heading strong { font-size:14px; color:#40516e; }
    .answer-action { border:1px solid #b9c9e5; border-radius:10px; padding:8px 12px; background:#f3f7ff; color:#315b9d; font-weight:800; }
    .answer p:first-child { margin-top:0; }
    .answer code { font-family:Consolas,monospace; background:#eff2f5; border-radius:5px; padding:.12em .32em; font-size:.92em; }
    .answer pre { overflow:auto; padding:16px; color:#e7edf7; background:#172033; border-radius:12px; line-height:1.55; }
    .answer pre code { background:transparent; padding:0; }
    .answer blockquote { margin:1em 0; padding:10px 16px; border-left:4px solid #9db9ed; background:#f2f6fd; color:#44516a; }
    .answer li { margin:.35em 0; }
    .custom-answer { margin-top:22px; padding:18px; border:1px solid #cddbf4; border-radius:14px; background:#f5f8ff; }
    .custom-answer-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .custom-answer-title { font-size:14px; font-weight:800; color:#315b9d; }
    .custom-answer-status { color:var(--muted); font-size:12px; }
    .custom-answer-display { white-space:pre-wrap; overflow-wrap:anywhere; }
    .custom-answer textarea { display:block; min-height:180px; resize:vertical; font:inherit; line-height:1.65; }
    .custom-answer-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; }
    .custom-answer-actions button { border:1px solid var(--line); border-radius:9px; padding:8px 11px; background:#fff; color:#465066; font-weight:700; }
    .custom-answer-actions .done { border-color:var(--blue); color:#fff; background:var(--blue); }
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
    dialog { width:min(440px,calc(100% - 28px)); border:0; border-radius:20px; padding:0; color:var(--ink); box-shadow:0 28px 90px rgba(23,32,51,.28); }
    dialog::backdrop { background:rgba(15,23,42,.48); backdrop-filter:blur(3px); }
    .auth-wrap { padding:26px; }
    .auth-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:20px; }
    .auth-head h2 { margin:0 0 5px; font-size:24px; }
    .auth-head p { margin:0; color:var(--muted); font-size:13px; line-height:1.5; }
    .dialog-close { border:0; background:transparent; color:var(--muted); font-size:24px; line-height:1; }
    .auth-field { margin-bottom:13px; }
    .auth-field label { display:block; margin-bottom:6px; color:#536077; font-size:12px; font-weight:800; }
    .auth-field input { width:100%; border:1px solid var(--line); border-radius:11px; padding:11px; outline:none; }
    .auth-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:16px; }
    .auth-actions button,.signed-actions button { border:1px solid var(--line); border-radius:11px; padding:10px; font-weight:800; }
    .auth-primary { border-color:var(--blue)!important; color:#fff; background:var(--blue); }
    .auth-message { min-height:20px; margin:13px 0 0; color:var(--muted); font-size:13px; line-height:1.5; }
    .signed-user { padding:14px; border-radius:12px; background:#f3f7ff; overflow-wrap:anywhere; }
    .signed-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:14px; }
    .nav { margin-top:28px; padding-top:20px; border-top:1px solid var(--line); display:flex; gap:10px; align-items:center; }
    .nav button { border:1px solid var(--line); border-radius:11px; padding:10px 15px; background:white; color:var(--ink); font-weight:700; }
    .nav button:hover,.rate:hover { border-color:#aeb9ca; }
    .nav button:disabled { opacity:.4; cursor:not-allowed; }
    .position { margin-left:auto; color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
    .empty { margin:auto; text-align:center; color:var(--muted); }
    .kbd { border:1px solid #cfd5de; border-bottom-width:2px; border-radius:5px; padding:1px 5px; background:#fff; color:#606b7e; font-size:11px; }
    @keyframes fade { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }
    @media (max-width:780px) { .app{width:min(100% - 20px,680px);padding-top:16px} header{align-items:flex-start;flex-direction:column;margin-bottom:14px}.progress-box{width:100%;text-align:left}.layout{grid-template-columns:1fr;gap:12px}.panel{position:static;padding:12px 14px;border-radius:16px}.filter-toggle{display:flex}.panel-body{display:none;margin-top:16px}.panel.expanded .panel-body{display:block}.bank-tabs{grid-template-columns:1fr 1fr}.card{min-height:520px;padding:22px;border-radius:18px}.question{margin:21px 0}.question-jump{width:100%;margin-left:0}.question-jump select{width:auto;min-width:0;flex:1}.answer-heading,.custom-answer-head{align-items:flex-start;flex-direction:column}.answer-action{width:100%}.position{margin-left:0;width:100%;order:-1}.nav{flex-wrap:wrap}.nav button{flex:1}.nav .random{flex-basis:100%} }
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
      <aside class="panel" id="panel">
        <button class="filter-toggle" id="filterToggle" type="button" aria-expanded="false">练习设置与账号 <span id="filterToggleText">展开 ↓</span></button>
        <div class="panel-body" id="panelBody">
        <div class="account-box"><div class="account-head"><span class="sync-dot" id="syncDot"></span><span id="syncTitle">仅保存在本机</span></div><div class="sync-detail" id="syncDetail">登录后可在电脑和手机之间同步学习记录。</div><button id="accountButton" type="button">登录并同步</button></div>
        <div class="field"><label>题库</label><div class="bank-tabs" id="bankTabs"></div></div>
        <div class="field"><label for="modeSelect">学习模式</label><select id="modeSelect"><option value="all">自由练习</option><option value="plan">按天学习</option><option value="review">复习队列</option></select></div>
        <div class="field" id="planControls" hidden><label>学习计划</label><div class="plan-grid"><select id="planDays" aria-label="计划天数"><option value="7">7 天</option><option value="14">14 天</option><option value="21">21 天</option><option value="30">30 天</option></select><select id="planDay" aria-label="学习第几天"></select></div></div>
        <div class="field"><label for="sectionSelect">章节</label><select id="sectionSelect"></select></div>
        <div class="field"><label for="starSelect">重要程度</label><select id="starSelect"><option value="0">全部星级</option><option value="5">★★★★★ 五星必问</option><option value="4">★★★★ 四星高频</option><option value="3">★★★ 三星常见</option><option value="2">★★ 两星</option><option value="1">★ 一星</option></select></div>
        <div class="field"><label for="statusSelect">掌握状态</label><select id="statusSelect"><option value="all">全部状态</option><option value="unrated">尚未标记</option><option value="again">不会</option><option value="fuzzy">模糊</option><option value="know">会</option></select></div>
        <div class="field"><label for="searchInput">搜索题目和答案</label><input id="searchInput" name="question-filter" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="例如：优先级反转"></div>
        <div class="field"><label>个人数据备份</label><div class="data-actions"><button id="exportNotes" type="button">导出数据</button><button id="importNotes" type="button">导入数据</button></div><input id="notesFile" type="file" accept="application/json,.json" hidden></div>
        <div class="summary" id="filterSummary"></div>
        </div>
      </aside>
      <section class="card" id="card" aria-live="polite">
        <div id="quiz">
          <div class="meta"><span class="tag" id="sectionTag"></span><span class="tag" id="reviewTag" hidden></span><span id="bankName"></span><span class="stars" id="stars"></span><label class="question-jump" id="questionJumpWrap" hidden><span>本日题目</span><select id="questionJump" aria-label="选择本日第几题"></select></label></div>
          <h2 class="question" id="question"></h2>
          <button class="reveal" id="revealButton" type="button">查看答案 <span class="kbd">空格</span></button>
          <div class="answer" id="answerWrap"><div class="answer-heading"><strong>参考答案</strong><button class="answer-action" id="editAnswerButton" type="button">写我的答案</button></div><div id="answer"></div><section class="custom-answer" id="customAnswer" hidden><div class="custom-answer-head"><span class="custom-answer-title">我的答案</span><span class="custom-answer-status" id="customAnswerStatus"></span></div><div class="custom-answer-display" id="customAnswerDisplay"></div><div id="customAnswerEditor" hidden><textarea id="customAnswerText" placeholder="写下你自己的答案。登录后会自动同步到手机和电脑……"></textarea><div class="custom-answer-actions"><button id="clearCustomAnswer" type="button">清除我的答案</button><button class="done" id="finishCustomAnswer" type="button">完成编辑</button></div></div></section></div>
          <div class="rating" id="rating"><button class="rate" data-value="again">不会</button><button class="rate" data-value="fuzzy">模糊</button><button class="rate" data-value="know">会</button></div>
          <div class="notes"><div class="notes-head"><span class="notes-title">个人笔记</span><span class="notes-status" id="notesStatus">自动保存在此浏览器</span></div><textarea id="notesText" placeholder="写下自己的理解、易错点或需要追问的内容……"></textarea></div>
          <div class="spacer"></div>
          <nav class="nav"><button id="previousButton">← 上一题</button><button id="nextButton">下一题 →</button><button class="random" id="randomButton">随机一题</button><span class="position" id="position"></span></nav>
        </div>
        <div class="empty" id="empty" hidden><h2 id="emptyTitle">没有匹配的题目</h2><p id="emptyText">请调整章节、星级、状态或搜索词。</p></div>
      </section>
    </div>
  </main>
  <dialog id="authDialog"><div class="auth-wrap"><div class="auth-head"><div><h2>账号与云同步</h2><p>使用邮箱注册或登录，同步答题状态、复习计划、我的答案和个人笔记。</p></div><button class="dialog-close" id="authClose" type="button" aria-label="关闭">×</button></div><div id="authFields"><div class="auth-field"><label for="authEmail">邮箱</label><input id="authEmail" type="email" autocomplete="email" placeholder="name@example.com"></div><div class="auth-field"><label for="authPassword">密码</label><input id="authPassword" type="password" minlength="6" autocomplete="current-password" placeholder="至少 6 位"></div><div class="auth-actions"><button class="auth-primary" id="signInButton" type="button">登录</button><button id="signUpButton" type="button">注册</button></div></div><div id="signedFields" hidden><div class="signed-user">已登录：<strong id="signedEmail"></strong></div><div class="signed-actions"><button class="auth-primary" id="syncNowButton" type="button">立即同步</button><button id="signOutButton" type="button">退出登录</button></div></div><p class="auth-message" id="authMessage"></p></div></dialog>
  <script src="https://unpkg.com/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>
  <script>
    const SUPABASE_URL = 'https://vvixekimlcyrrfinyeep.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IqgzFNc92HIzH62vXr8X2w_k_IEWT4K';
    const SITE_URL = 'https://healeraaa.github.io/embedded-interview-quiz/';
    const BANKS = ${JSON.stringify(data)};
    const allQuestions = BANKS.flatMap(bank => bank.questions);
    const savedPlanDays = Number(localStorage.getItem('embedded-interview-plan-days-v1')) || 14;
    const savedPlanDay = Number(localStorage.getItem('embedded-interview-plan-day-v1')) || 1;
    const state = { bank:'software', mode:'all', planDays:[7,14,21,30].includes(savedPlanDays) ? savedPlanDays : 14, planDay:savedPlanDay, section:'all', stars:0, status:'all', search:'', index:0, revealed:false, editingAnswer:false };
    function storedObject(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
    const ratings = storedObject('embedded-interview-ratings-v1');
    const reviewSchedule = storedObject('embedded-interview-review-schedule-v1');
    const ratingUpdatedAt = storedObject('embedded-interview-rating-updated-at-v1');
    const reviewUpdatedAt = storedObject('embedded-interview-review-updated-at-v1');
    const notes = storedObject('embedded-interview-notes-v1');
    const customAnswers = storedObject('embedded-interview-custom-answers-v1');
    let migratedReviewSchedule = false;
    allQuestions.forEach(q => {
      if (ratings[q.id] === 'know' && reviewSchedule[q.id]) {
        const migratedAt=Date.now();
        delete reviewSchedule[q.id];
        ratingUpdatedAt[q.id]=Math.max(Number(ratingUpdatedAt[q.id])||0,migratedAt);
        reviewUpdatedAt[q.id]=Math.max(Number(reviewUpdatedAt[q.id])||0,migratedAt);
        migratedReviewSchedule = true;
      }
      if (!reviewSchedule[q.id] && (ratings[q.id] === 'again' || ratings[q.id] === 'fuzzy')) {
        reviewSchedule[q.id] = { rating:ratings[q.id], dueDay:ratings[q.id] === 'again' ? 2 : 4 };
        migratedReviewSchedule = true;
      }
    });
    if (migratedReviewSchedule) { localStorage.setItem('embedded-interview-review-schedule-v1',JSON.stringify(reviewSchedule));localStorage.setItem('embedded-interview-rating-updated-at-v1',JSON.stringify(ratingUpdatedAt));localStorage.setItem('embedded-interview-review-updated-at-v1',JSON.stringify(reviewUpdatedAt)); }
    const $ = id => document.getElementById(id);
    const elements = { panel:$('panel'), filterToggle:$('filterToggle'), filterToggleText:$('filterToggleText'), panelBody:$('panelBody'), tabs:$('bankTabs'), mode:$('modeSelect'), planControls:$('planControls'), planDays:$('planDays'), planDay:$('planDay'), section:$('sectionSelect'), stars:$('starSelect'), status:$('statusSelect'), search:$('searchInput'), summary:$('filterSummary'), tag:$('sectionTag'), reviewTag:$('reviewTag'), bank:$('bankName'), starText:$('stars'), questionJumpWrap:$('questionJumpWrap'), questionJump:$('questionJump'), question:$('question'), reveal:$('revealButton'), answerWrap:$('answerWrap'), answer:$('answer'), editAnswer:$('editAnswerButton'), customAnswer:$('customAnswer'), customAnswerDisplay:$('customAnswerDisplay'), customAnswerEditor:$('customAnswerEditor'), customAnswerText:$('customAnswerText'), customAnswerStatus:$('customAnswerStatus'), clearCustomAnswer:$('clearCustomAnswer'), finishCustomAnswer:$('finishCustomAnswer'), rating:$('rating'), notesText:$('notesText'), notesStatus:$('notesStatus'), exportNotes:$('exportNotes'), importNotes:$('importNotes'), notesFile:$('notesFile'), previous:$('previousButton'), next:$('nextButton'), random:$('randomButton'), position:$('position'), progressText:$('progressText'), progressFill:$('progressFill'), card:$('card'), quiz:$('quiz'), empty:$('empty'), emptyTitle:$('emptyTitle'), emptyText:$('emptyText'), syncDot:$('syncDot'), syncTitle:$('syncTitle'), syncDetail:$('syncDetail'), accountButton:$('accountButton'), authDialog:$('authDialog'), authClose:$('authClose'), authFields:$('authFields'), authEmail:$('authEmail'), authPassword:$('authPassword'), signIn:$('signInButton'), signUp:$('signUpButton'), signedFields:$('signedFields'), signedEmail:$('signedEmail'), syncNow:$('syncNowButton'), signOut:$('signOutButton'), authMessage:$('authMessage') };
    const cloud = window.supabase ? window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY) : null;
    let cloudUser = null;
    let loadedCloudUser = '';
    let syncTimer = 0;

    function replaceObject(target,source) { Object.keys(target).forEach(key=>delete target[key]); Object.assign(target,source&&typeof source==='object'&&!Array.isArray(source)?source:{}); }
    function localSnapshot() { return {version:3,ratings:{...ratings},reviewSchedule:{...reviewSchedule},ratingUpdatedAt:{...ratingUpdatedAt},reviewUpdatedAt:{...reviewUpdatedAt},notes:{...notes},customAnswers:{...customAnswers},planDays:state.planDays,planDay:state.planDay}; }
    function persistSnapshot(data) {
      replaceObject(ratings,data.ratings); replaceObject(reviewSchedule,data.reviewSchedule); replaceObject(ratingUpdatedAt,data.ratingUpdatedAt); replaceObject(reviewUpdatedAt,data.reviewUpdatedAt); replaceObject(notes,data.notes); replaceObject(customAnswers,data.customAnswers);
      if ([7,14,21,30].includes(Number(data.planDays))) state.planDays=Number(data.planDays);
      if (Number.isInteger(Number(data.planDay))) state.planDay=Math.max(1,Math.min(state.planDays,Number(data.planDay)));
      localStorage.setItem('embedded-interview-ratings-v1',JSON.stringify(ratings));
      localStorage.setItem('embedded-interview-review-schedule-v1',JSON.stringify(reviewSchedule));
      localStorage.setItem('embedded-interview-rating-updated-at-v1',JSON.stringify(ratingUpdatedAt));
      localStorage.setItem('embedded-interview-review-updated-at-v1',JSON.stringify(reviewUpdatedAt));
      localStorage.setItem('embedded-interview-notes-v1',JSON.stringify(notes));
      localStorage.setItem('embedded-interview-custom-answers-v1',JSON.stringify(customAnswers));
      localStorage.setItem('embedded-interview-plan-days-v1',String(state.planDays));
      localStorage.setItem('embedded-interview-plan-day-v1',String(state.planDay));
      populatePlanDays(); render();
    }
    function setSyncStatus(title,detail,kind) { elements.syncTitle.textContent=title;elements.syncDetail.textContent=detail;elements.syncDot.className='sync-dot'+(kind?' '+kind:''); }
    function isMisfilledAccountEmail(value) { return Boolean(cloudUser&&cloudUser.email&&value.trim().toLowerCase()===cloudUser.email.trim().toLowerCase()); }
    function clearMisfilledSearch() { if(!isMisfilledAccountEmail(elements.search.value))return false;elements.search.value='';state.search='';return true; }
    function updateAccountUI() {
      const signedIn=Boolean(cloudUser);
      elements.authFields.hidden=signedIn; elements.signedFields.hidden=!signedIn;
      elements.signedEmail.textContent=signedIn?cloudUser.email:'';
      elements.accountButton.textContent=signedIn?'账号与同步':'登录并同步';
      elements.accountButton.disabled=!cloud;
      if (!signedIn) setSyncStatus('仅保存在本机',cloud?'登录后可在电脑和手机之间同步学习记录。':'云同步组件加载失败，本地功能不受影响。',cloud?'':'error');
      clearMisfilledSearch();
      render();
    }
    async function pushCloud(showMessage=false) {
      if (!cloud||!cloudUser) return;
      setSyncStatus('正在同步…','本机记录正在上传到云端。','online');
      const {error}=await cloud.from('quiz_sync').upsert({user_id:cloudUser.id,data:localSnapshot(),updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if (error) { setSyncStatus('同步失败','记录仍已保存在本机：'+error.message,'error');if(showMessage)elements.authMessage.textContent='同步失败：'+error.message;return; }
      setSyncStatus('已同步',cloudUser.email+' · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),'online');
      elements.notesStatus.textContent='已保存并同步';
      if (customAnswers[filtered()[state.index]?.id]) elements.customAnswerStatus.textContent='已保存并同步';
      if(showMessage)elements.authMessage.textContent='同步完成。';
    }
    function queueCloudSync(delay=700) { if(!cloudUser)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>pushCloud(false),delay); }
    function mergeRatings(local,remote,localTimes,remoteTimes) {
      const values={},times={};
      const keys=new Set([...Object.keys(local||{}),...Object.keys(remote||{}),...Object.keys(localTimes||{}),...Object.keys(remoteTimes||{})]);
      keys.forEach(key=>{
        const localValue=local?.[key],remoteValue=remote?.[key];
        const localTime=Number(localTimes?.[key])||0,remoteTime=Number(remoteTimes?.[key])||0;
        let value;
        if(localValue===undefined)value=remoteValue;
        else if(remoteValue===undefined)value=localValue;
        else if(localTime>remoteTime)value=localValue;
        else if(remoteTime>localTime)value=remoteValue;
        else if(localValue==='know'||remoteValue==='know')value='know';
        else value=remoteValue;
        if(value!==undefined)values[key]=value;
        if(localTime||remoteTime)times[key]=Math.max(localTime,remoteTime);
      });
      return {values,times};
    }
    function mergeReviews(local,remote,localTimes,remoteTimes,mergedRatings) {
      const values={},times={};
      const keys=new Set([...Object.keys(local||{}),...Object.keys(remote||{}),...Object.keys(localTimes||{}),...Object.keys(remoteTimes||{}),...Object.keys(mergedRatings||{})]);
      keys.forEach(key=>{
        const localTime=Number(localTimes?.[key])||0,remoteTime=Number(remoteTimes?.[key])||0;
        let value;
        if(localTime>remoteTime)value=local?.[key];
        else if(remoteTime>localTime)value=remote?.[key];
        else value=remote?.[key]??local?.[key];
        if(mergedRatings[key]!=='know'&&value)values[key]=value;
        if(localTime||remoteTime)times[key]=Math.max(localTime,remoteTime);
      });
      return {values,times};
    }
    async function pullCloud() {
      if (!cloud||!cloudUser) return;
      setSyncStatus('正在同步…','正在读取云端学习记录。','online');
      const {data,error}=await cloud.from('quiz_sync').select('data').eq('user_id',cloudUser.id).maybeSingle();
      if (error) { setSyncStatus('同步失败','本机记录不受影响：'+error.message,'error');return; }
      if (!data) { await pushCloud(false);return; }
      const local=localSnapshot(),remote=data.data||{};
      const mergedRatings=mergeRatings(local.ratings,remote.ratings||{},local.ratingUpdatedAt,remote.ratingUpdatedAt||{});
      const mergedReviews=mergeReviews(local.reviewSchedule,remote.reviewSchedule||{},local.reviewUpdatedAt,remote.reviewUpdatedAt||{},mergedRatings.values);
      persistSnapshot({version:3,ratings:mergedRatings.values,reviewSchedule:mergedReviews.values,ratingUpdatedAt:mergedRatings.times,reviewUpdatedAt:mergedReviews.times,notes:{...local.notes,...(remote.notes||{})},customAnswers:{...local.customAnswers,...(remote.customAnswers||{})},planDays:remote.planDays||local.planDays,planDay:remote.planDay||local.planDay});
      await pushCloud(false);
    }
    async function handleSession(session) {
      cloudUser=session&&session.user?session.user:null;updateAccountUI();
      if(cloudUser&&loadedCloudUser!==cloudUser.id){loadedCloudUser=cloudUser.id;await pullCloud();}
      if(cloudUser)setTimeout(()=>{if(clearMisfilledSearch())resetQuestion()},600);
      if(!cloudUser)loadedCloudUser='';
    }

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
        (!term || (q.title + ' ' + q.section + ' ' + q.answerHtml.replace(/<[^>]*>/g,' ') + ' ' + (customAnswers[q.id] || '') + ' ' + (notes[q.id] || '')).toLowerCase().includes(term))
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
      elements.questionJumpWrap.hidden = state.mode !== 'plan' || !list.length;
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
      if (state.mode === 'plan') {
        elements.questionJump.replaceChildren(...list.map((item,index)=>new Option('第 '+(index+1)+' 题 · '+item.title,String(index))));
        elements.questionJump.value=String(state.index);
      }
      elements.tag.textContent = q.section;
      const review = reviewSchedule[q.id];
      elements.reviewTag.hidden = !review;
      elements.reviewTag.textContent = review ? '复习题 · 第 ' + Math.min(review.dueDay,state.planDays) + ' 天到期' : '';
      elements.bank.textContent = activeBank().name + ' · ' + q.number;
      elements.starText.textContent = '★'.repeat(q.stars);
      elements.question.textContent = q.title;
      elements.answer.innerHTML = q.answerHtml;
      const customAnswer = customAnswers[q.id] || '';
      elements.editAnswer.textContent = customAnswer ? '编辑我的答案' : '写我的答案';
      elements.customAnswer.hidden = !customAnswer && !state.editingAnswer;
      elements.customAnswerDisplay.hidden = state.editingAnswer || !customAnswer;
      elements.customAnswerEditor.hidden = !state.editingAnswer;
      elements.customAnswerDisplay.textContent = customAnswer;
      if (document.activeElement !== elements.customAnswerText) elements.customAnswerText.value = customAnswer;
      elements.clearCustomAnswer.hidden = !customAnswer;
      elements.customAnswerStatus.textContent = cloudUser ? (customAnswer ? '已保存并同步' : '云同步已开启') : (customAnswer ? '已保存到本机' : '自动保存在此浏览器');
      elements.notesText.value = notes[q.id] || '';
      elements.notesStatus.textContent = cloudUser ? (notes[q.id] ? '已保存并同步' : '云同步已开启') : (notes[q.id] ? '已保存到本机' : '自动保存在此浏览器');
      elements.answerWrap.classList.toggle('open',state.revealed);
      elements.rating.classList.toggle('open',state.revealed);
      elements.reveal.innerHTML = state.revealed ? '收起答案 <span class="kbd">空格</span>' : '查看答案 <span class="kbd">空格</span>';
      elements.previous.disabled = state.index === 0;
      elements.next.disabled = state.index === list.length - 1;
      elements.position.textContent = (state.index + 1) + ' / ' + list.length;
      document.querySelectorAll('.rate').forEach(btn => btn.classList.toggle('selected',ratings[q.id] === btn.dataset.value));
    }
    function resetQuestion() { state.index = 0; state.revealed = false; state.editingAnswer = false; render(); }
    function move(delta) { const list = filtered(); state.index = Math.max(0,Math.min(list.length - 1,state.index + delta)); state.revealed = false; state.editingAnswer = false; render(); window.scrollTo({top:0,behavior:'smooth'}); }
    elements.tabs.addEventListener('click', event => { const btn=event.target.closest('[data-bank]'); if(!btn)return; state.bank=btn.dataset.bank; state.section='all'; populateSections(); populatePlanDays(); resetQuestion(); });
    elements.mode.addEventListener('change',e=>{state.mode=e.target.value;if(state.mode==='review'){state.status='all';elements.status.value='all'}resetQuestion()});
    elements.planDays.addEventListener('change',e=>{state.planDays=Number(e.target.value);state.planDay=1;localStorage.setItem('embedded-interview-plan-days-v1',String(state.planDays));localStorage.setItem('embedded-interview-plan-day-v1','1');populatePlanDays();resetQuestion();queueCloudSync()});
    elements.planDay.addEventListener('change',e=>{state.planDay=Number(e.target.value);localStorage.setItem('embedded-interview-plan-day-v1',String(state.planDay));resetQuestion();queueCloudSync()});
    elements.section.addEventListener('change',e=>{state.section=e.target.value;resetQuestion()});
    elements.stars.addEventListener('change',e=>{state.stars=Number(e.target.value);resetQuestion()});
    elements.status.addEventListener('change',e=>{state.status=e.target.value;resetQuestion()});
    elements.search.addEventListener('input',e=>{if(isMisfilledAccountEmail(e.target.value)){e.target.value='';state.search='';resetQuestion();return}state.search=e.target.value;resetQuestion()});
    elements.reveal.addEventListener('click',()=>{state.revealed=!state.revealed;render()});
    elements.previous.addEventListener('click',()=>move(-1));
    elements.next.addEventListener('click',()=>move(1));
    elements.random.addEventListener('click',()=>{const list=filtered();if(list.length){state.index=Math.floor(Math.random()*list.length);state.revealed=false;state.editingAnswer=false;render()}});
    elements.questionJump.addEventListener('change',event=>{state.index=Number(event.target.value);state.revealed=false;state.editingAnswer=false;render();elements.card.scrollIntoView({behavior:'smooth',block:'start'})});
    elements.filterToggle.addEventListener('click',()=>{const expanded=elements.panel.classList.toggle('expanded');elements.filterToggle.setAttribute('aria-expanded',String(expanded));elements.filterToggleText.textContent=expanded?'收起 ↑':'展开 ↓'});
    elements.rating.addEventListener('click',event=>{const btn=event.target.closest('[data-value]');if(!btn)return;const q=filtered()[state.index];const value=btn.dataset.value;const updatedAt=Date.now();ratings[q.id]=value;ratingUpdatedAt[q.id]=updatedAt;reviewUpdatedAt[q.id]=updatedAt;if(value==='again'||value==='fuzzy'){const interval=value==='again'?1:3;reviewSchedule[q.id]={rating:value,dueDay:Math.min(state.planDays,state.planDay+interval)}}else{delete reviewSchedule[q.id]}localStorage.setItem('embedded-interview-ratings-v1',JSON.stringify(ratings));localStorage.setItem('embedded-interview-review-schedule-v1',JSON.stringify(reviewSchedule));localStorage.setItem('embedded-interview-rating-updated-at-v1',JSON.stringify(ratingUpdatedAt));localStorage.setItem('embedded-interview-review-updated-at-v1',JSON.stringify(reviewUpdatedAt));render();queueCloudSync(80)});
    elements.editAnswer.addEventListener('click',()=>{state.editingAnswer=true;render();requestAnimationFrame(()=>{elements.customAnswerText.focus();elements.customAnswerText.setSelectionRange(elements.customAnswerText.value.length,elements.customAnswerText.value.length)})});
    elements.customAnswerText.addEventListener('input',()=>{const q=filtered()[state.index];if(!q)return;const value=elements.customAnswerText.value;if(value.trim()){customAnswers[q.id]=value}else{delete customAnswers[q.id]}localStorage.setItem('embedded-interview-custom-answers-v1',JSON.stringify(customAnswers));elements.customAnswerStatus.textContent=cloudUser?'等待同步…':'已保存到本机';elements.clearCustomAnswer.hidden=!value.trim();queueCloudSync()});
    elements.finishCustomAnswer.addEventListener('click',()=>{state.editingAnswer=false;render()});
    elements.clearCustomAnswer.addEventListener('click',()=>{const q=filtered()[state.index];if(!q||!customAnswers[q.id])return;if(!confirm('确定清除这道题的“我的答案”吗？原参考答案不会受影响。'))return;delete customAnswers[q.id];localStorage.setItem('embedded-interview-custom-answers-v1',JSON.stringify(customAnswers));state.editingAnswer=false;render();queueCloudSync()});
    elements.notesText.addEventListener('input',()=>{const q=filtered()[state.index];if(!q)return;const value=elements.notesText.value;if(value.trim()){notes[q.id]=value}else{delete notes[q.id]}localStorage.setItem('embedded-interview-notes-v1',JSON.stringify(notes));elements.notesStatus.textContent=cloudUser?'等待同步…':'已保存到本机';queueCloudSync();});
    elements.exportNotes.addEventListener('click',()=>{const payload={version:2,exportedAt:new Date().toISOString(),notes,customAnswers};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='嵌入式面试题个人数据.json';link.click();URL.revokeObjectURL(link.href)});
    elements.importNotes.addEventListener('click',()=>elements.notesFile.click());
    elements.notesFile.addEventListener('change',async()=>{const file=elements.notesFile.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const importedNotes=parsed && parsed.notes && typeof parsed.notes==='object' ? parsed.notes : parsed;const hasImportedAnswers=Boolean(parsed && parsed.customAnswers && typeof parsed.customAnswers==='object');const importedAnswers=hasImportedAnswers?parsed.customAnswers:{};if(!importedNotes || Array.isArray(importedNotes) || typeof importedNotes!=='object')throw new Error('格式错误');replaceObject(notes,Object.fromEntries(Object.entries(importedNotes).filter(([,value])=>typeof value==='string'&&value.trim())));if(hasImportedAnswers)replaceObject(customAnswers,Object.fromEntries(Object.entries(importedAnswers).filter(([,value])=>typeof value==='string'&&value.trim())));localStorage.setItem('embedded-interview-notes-v1',JSON.stringify(notes));localStorage.setItem('embedded-interview-custom-answers-v1',JSON.stringify(customAnswers));render();queueCloudSync();alert('已导入 '+Object.keys(notes).length+' 条个人笔记和 '+Object.keys(customAnswers).length+' 条“我的答案”。')}catch(error){alert('导入失败：请选择由本网页导出的 JSON 数据文件。')}finally{elements.notesFile.value=''}});
    elements.accountButton.addEventListener('click',()=>{elements.authMessage.textContent='';elements.authDialog.showModal()});
    elements.authClose.addEventListener('click',()=>elements.authDialog.close());
    elements.authDialog.addEventListener('click',event=>{if(event.target===elements.authDialog)elements.authDialog.close()});
    elements.signIn.addEventListener('click',async()=>{const email=elements.authEmail.value.trim(),password=elements.authPassword.value;if(!email||!password){elements.authMessage.textContent='请输入邮箱和密码。';return}elements.authMessage.textContent='正在登录…';const {error}=await cloud.auth.signInWithPassword({email,password});elements.authMessage.textContent=error?'登录失败：'+error.message:'登录成功，正在同步…';if(!error)setTimeout(()=>elements.authDialog.close(),700)});
    elements.signUp.addEventListener('click',async()=>{const email=elements.authEmail.value.trim(),password=elements.authPassword.value;if(!email||password.length<6){elements.authMessage.textContent='请输入有效邮箱，密码至少 6 位。';return}elements.authMessage.textContent='正在注册…';const {data,error}=await cloud.auth.signUp({email,password,options:{emailRedirectTo:SITE_URL}});elements.authMessage.textContent=error?'注册失败：'+error.message:data.session?'注册成功，正在同步…':'注册成功，请打开邮箱中的确认邮件。'});
    elements.syncNow.addEventListener('click',()=>pushCloud(true));
    elements.signOut.addEventListener('click',async()=>{elements.authMessage.textContent='正在退出…';const {error}=await cloud.auth.signOut();elements.authMessage.textContent=error?'退出失败：'+error.message:'已退出，记录仍保留在本机。';if(!error)setTimeout(()=>elements.authDialog.close(),600)});
    document.addEventListener('keydown',event=>{if(event.target.matches('input,select,textarea'))return;if(event.code==='Space'){event.preventDefault();state.revealed=!state.revealed;render()}if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1)});
    populateSections(); populatePlanDays(); render(); updateAccountUI();
    if(cloud){cloud.auth.getSession().then(({data})=>handleSession(data.session));cloud.auth.onAuthStateChange((event,session)=>setTimeout(()=>handleSession(session),0));}
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

