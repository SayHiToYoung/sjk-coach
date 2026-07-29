const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let current = null;

/* ── 状态条 ─────────────────────────── */
(async () => {
  try {
    const c = await (await fetch('/api/config')).json();
    $('meta-src').textContent = c.mock ? '离线演示数据' : new URL(c.domain).hostname;
    $('meta-src').className = c.mock ? '' : 'ok';
    $('meta-llm').textContent = c.hasLLM ? '大模型' : '规则版';
    $('meta-llm').className = c.hasLLM ? 'ok' : '';
    if (c.openid) $('role').dataset.openid = c.openid;
  } catch {
    $('meta-src').textContent = '服务未启动';
  }
})();

/* ── 表单 ──────────────────────────── */
const syncTotal = () => {
  $('total').textContent = (Number($('mpd').value) || 0) * (Number($('days').value) || 0);
};
['mpd', 'days'].forEach(id => $(id).addEventListener('input', syncTotal));
$('task').addEventListener('input', e => { $('count').textContent = e.target.value.length; });

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const task = $('task').value.trim();
  if (task.length < 4) return say('把这件事写具体一点，至少 4 个字。');

  $('go').disabled = true;
  say('正在检索课程库、拆到节，再按你的时间排…');

  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task,
        role: $('role').value.trim(),
        minutesPerDay: Number($('mpd').value),
        days: Number($('days').value),
      }),
    });
    const data = await res.json();
    if (!res.ok) return say(data.error || '排不出来，换个说法再试一次。');
    current = data;
    render(data);
    say(null);
  } catch {
    say('连不上服务，确认一下终端里的服务还在跑。');
  } finally {
    $('go').disabled = false;
  }
});

function say(msg) {
  const el = $('status');
  el.hidden = !msg;
  el.textContent = msg || '';
}

/* ── 渲染 ──────────────────────────── */
function render(plan) {
  $('goal').textContent = plan.goal || plan.task;
  $('chips').innerHTML = (plan.keywords || []).map(k => `<li>${esc(k)}</li>`).join('');

  $('days-wrap').innerHTML = plan.days.map((d, di) => `
    <section class="day reveal" style="animation-delay:${di * 70}ms">
      <div class="day__head">
        <span class="day__no">第 ${String(d.day).padStart(2, '0')} 天</span>
        <span class="day__min">${d.minutes} / ${plan.minutesPerDay} 分钟</span>
      </div>
      <div class="ledger" data-day="${di}">${ledger(d, plan.minutesPerDay)}</div>
      ${d.steps.map((s, si) => step(s, di, si)).join('')}
    </section>`).join('');

  $('deliv-title').textContent = plan.deliverable?.title || '任务准备清单';
  $('deliv-outline').innerHTML = (plan.deliverable?.outline || [])
    .map(o => `<li>${esc(o)}</li>`).join('');

  $('sources').textContent =
    `检索 ${plan.courses.length} 门课 / 拆出 ${plan.poolSize} 节可选素材 / 选中 ${plan.days.reduce((a, d) => a + d.steps.length, 0)} 节 · ` +
    `course/list · course/catalog · study_data/student_section_finish · oauth/custom`;

  $('plan').hidden = false;
  hoverLink();
  $('plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** 分钟账条：一格一分钟，相邻步骤深浅交替 */
function ledger(day, budget) {
  const cells = [];
  day.steps.forEach((s, i) => {
    for (let m = 0; m < (s.minutes || 0); m++) {
      const over = cells.length >= budget;
      cells.push(`<i class="on ${i % 2 ? 'alt' : ''} ${over ? 'over' : ''}" data-step="${i}"></i>`);
    }
  });
  while (cells.length < budget) cells.push('<i></i>');
  return cells.join('');
}

function step(s, di, si) {
  return `
  <article class="step" data-key="${s.courseId}:${s.nodeId}" data-day="${di}" data-step="${si}">
    <div class="step__top">
      <h4 class="step__name">${esc(s.name)}</h4>
      <span class="step__min">${s.minutes} 分钟</span>
    </div>
    <p class="step__from">${esc(s.courseTitle)}${s.chapter ? ' · ' + esc(s.chapter) : ''}</p>
    ${s.why ? `<p class="step__why">${esc(s.why)}</p>` : ''}
    ${s.action ? `<p class="step__do"><b>学完立刻做</b>${esc(s.action)}</p>` : ''}
    <a class="step__go" href="${esc(s.openUrl)}" target="_blank" rel="noopener">直接打开这一节 →</a>
  </article>`;
}

/** 悬停某一步，账条上对应的分钟格跳出来 */
function hoverLink() {
  document.querySelectorAll('.step').forEach(el => {
    const on = flag => {
      const sel = `.ledger[data-day="${el.dataset.day}"] i[data-step="${el.dataset.step}"]`;
      document.querySelectorAll(sel).forEach(c => c.classList.toggle('hot', flag));
    };
    el.addEventListener('mouseenter', () => on(true));
    el.addEventListener('mouseleave', () => on(false));
  });
}

/* ── 进度回流 ───────────────────────── */
$('refresh').addEventListener('click', async () => {
  if (!current) return;
  const ids = [...new Set(current.days.flatMap(d => d.steps.map(s => s.courseId)))].join(',');
  say('正在读取你的节级完成状态…');
  try {
    const r = await (await fetch(`/api/progress?openid=${encodeURIComponent(current.openid)}&courseIds=${ids}`)).json();
    const done = new Set(r.finished || []);
    let n = 0;
    document.querySelectorAll('.step').forEach(el => {
      const hit = done.has(el.dataset.key);
      el.classList.toggle('done', hit);
      if (hit) n++;
    });
    const all = document.querySelectorAll('.step').length;
    say(n === 0 ? '这条路径还一节没动，先从第 01 天的第一节开始。'
      : n === all ? '整条路径都学完了 —— 现在把上面那份产出物写出来。'
      : `已学 ${n} / ${all} 节，接着往下走。`);
  } catch {
    say('进度读不出来，稍后再试。');
  }
});

syncTotal();
