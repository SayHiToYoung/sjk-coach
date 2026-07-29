import { flattenSections } from './sjk.js';

/* ────────────────────────────────────────────────────────────
   1. 从"一句话工作任务"里抽检索词
   有 LLM 用 LLM，没有就走同义词词典，保证产品在无密钥时也完整可用。
   ──────────────────────────────────────────────────────────── */

const LEXICON = [
  [['汇报', '述职', '演讲', '讲清', '说清', '讲不清', '答辩', '路演', '评审会'], ['汇报', '表达', '沟通']],
  [['复盘', '总结', '回顾', 'review'], ['复盘', '数据', '汇报']],
  [['数据', '指标', '留存', '转化', '增长', '漏斗', 'ab', '实验'], ['数据', '指标', '增长']],
  [['带团队', '下属', '新人', '管理', '晋升', '绩效', '反馈', '面谈', '一对一'], ['管理', '反馈', '沟通']],
  [['跨部门', '推动', '协调', '扯皮', '对齐', '拉不动', '资源'], ['协作', '沟通', '推动']],
  [['老板', '上级', '领导', '向上'], ['沟通', '汇报', '协作']],
  [['排期', '延期', '项目', '交付', '上线', '风险', '进度'], ['项目', '计划', '风险']],
  [['需求', 'prd', '方案', '设计', '产品'], ['需求', '项目', '产品']],
  [['ai', '大模型', 'gpt', '提示词', '自动化', '提效'], ['AI', '提效', '提示词']],
  [['目标', 'okr', 'kpi', '拆解'], ['目标', '管理']],
  [['冲突', '分歧', '谈判', '说服'], ['沟通', '协作']],
  [['会议', '开会', '纪要'], ['会议', '沟通']],
];

function keywordsByRule(task) {
  const t = task.toLowerCase();
  const hits = new Set();
  for (const [triggers, kws] of LEXICON) {
    if (triggers.some(x => t.includes(x))) kws.forEach(k => hits.add(k));
  }
  if (!hits.size) ['沟通', '管理', '项目'].forEach(k => hits.add(k));
  return [...hits].slice(0, 5);
}

/* ────────────────────────────────────────────────────────────
   2. LLM 调用（任意 OpenAI 兼容端点），失败即静默降级
   ──────────────────────────────────────────────────────────── */

async function llm(cfg, system, user, { json = true } = {}) {
  if (!cfg.llmApiKey) return null;
  try {
    const res = await fetch(`${cfg.llmBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.llmApiKey}`,
      },
      body: JSON.stringify({
        model: cfg.llmModel,
        temperature: 0.3,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    return json ? JSON.parse(text.replace(/^```(?:json)?|```$/gm, '').trim()) : text;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────
   3. 组素材池：检索课程 → 拉大纲 → 拍平成节
   ──────────────────────────────────────────────────────────── */

export async function buildPool(client, keywords, { maxCourses = 6 } = {}) {
  const seen = new Map();
  for (const kw of keywords) {
    let list = [];
    try { list = await client.courseList({ keyword: kw, pageSize: 10 }); } catch { /* 单个词失败不影响整体 */ }
    for (const c of list) {
      const cur = seen.get(c.courseId);
      if (cur) cur._hits++;
      else seen.set(c.courseId, { ...c, _hits: 1 });
    }
  }
  const courses = [...seen.values()]
    .sort((a, b) => b._hits - a._hits)
    .slice(0, maxCourses);

  const pool = [];
  for (const c of courses) {
    try {
      const { catalog } = await client.courseCatalog(c.courseId);
      pool.push(...flattenSections(catalog, c));
    } catch { /* 某门课大纲取不到就跳过 */ }
  }
  return { courses, pool };
}

/* ────────────────────────────────────────────────────────────
   4. 规则版打分：中文按 2-gram 做重叠匹配
   ──────────────────────────────────────────────────────────── */

function bigrams(s) {
  const clean = s.toLowerCase().replace(/[\s，。、；：？！""''（）()【】,.;:?!/-]/g, '');
  const out = new Set();
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
  return out;
}

function scorePool(task, keywords, pool) {
  const taskGrams = bigrams(task + ' ' + keywords.join(''));
  const overlap = (text, weight) => {
    let n = 0;
    for (const g of bigrams(text)) if (taskGrams.has(g)) n++;
    return n * weight;
  };
  return pool.map(s => {
    // 节标题最能说明这一节到底讲什么，权重必须高于课程名，
    // 否则"结构化表达"这种大课名会把每一节都拽到前面。
    const text = overlap(s.name, 3) + overlap(s.chapter, 1.5) + overlap(s.courseTitle, 1);
    const kwBonus =
      keywords.filter(k => s.name.includes(k)).length * 3 +
      keywords.filter(k => s.courseTitle.includes(k)).length * 1.5;
    const lengthPenalty = s.minutes > 15 ? 0.85 : 1;   // 长节在碎片时间里不友好
    return { ...s, _score: (text + kwBonus) * lengthPenalty };
  }).sort((a, b) => b._score - a._score);
}

/** 行动项按内容类型给，别让每一步都写着同一句话 */
function actionFor(s) {
  switch (s.contentType) {
    case 'text': return '把这份模板复制进你的文档，当场填一遍';
    case 'exam': return '做完对一下，错的那题就是你这次最容易翻车的地方';
    case 'question': return '直接用这次任务的真实素材来交作业';
    default: return s.minutes <= 6
      ? '看完写一句话：这一节改变了我原来打算怎么做'
      : '看完挑一个方法，写进你这次任务的准备稿里';
  }
}

function greedyPlan(task, keywords, pool, budget) {
  const ranked = scorePool(task, keywords, pool);
  const perDay = budget.minutesPerDay;
  const picked = [];
  const usedCourse = new Map();

  // 相关度下限：低于最高分 35% 的节一律不要。
  // 产品承诺的是"少而准"，把预算凑满不是目标——排进弱相关内容会直接毁掉信任。
  const floor = Math.max(2, (ranked[0]?._score || 0) * 0.35);

  for (const s of ranked) {
    if (picked.length >= budget.days * 3) break;
    if (s._score < floor) break;
    // 同一门课最多取 4 节，避免路径退化成"看完一门课"
    const n = usedCourse.get(s.courseId) || 0;
    if (n >= 4) continue;
    if (s.minutes > perDay) continue;
    picked.push(s);
    usedCourse.set(s.courseId, n + 1);
    const total = picked.reduce((a, x) => a + x.minutes, 0);
    if (total >= perDay * budget.days * 0.9) break;
  }

  // 按课程内原始顺序回排，尽量不破坏讲解的前后依赖
  picked.sort((a, b) => a.courseId - b.courseId || a.nodeId - b.nodeId);

  // 定容装箱：每天一个箱子，容量就是当天预算，放不下的直接丢掉。
  // 宁可少排，也不能让某一天悄悄超时——超时的计划等于没有计划。
  const bins = Array.from({ length: budget.days }, (_, i) => ({ day: i + 1, steps: [], minutes: 0 }));
  for (const s of picked) {
    const bin = bins.find(b => b.minutes + s.minutes <= perDay);
    if (!bin) continue;
    const hit = keywords.find(k => `${s.courseTitle}${s.chapter}${s.name}`.includes(k));
    bin.steps.push({
      courseId: s.courseId, nodeId: s.nodeId,
      why: hit ? `直接对着「${hit}」这一环` : '和你要做的这件事最接近的一节',
      action: actionFor(s),
    });
    bin.minutes += s.minutes;
  }
  const days = bins.filter(b => b.steps.length);

  return {
    // 目标句用能力词描述"学完能做到什么"，不要把用户刚写的任务原样念一遍
    goal: `用 ${budget.days * perDay} 分钟补齐${keywords.slice(0, 2).map(k => `「${k}」`).join('和')}，把这件事做到心里有底`,
    days,
    deliverable: {
      title: '任务准备清单',
      outline: ['我要达成的结果是什么', '对方最关心的三件事', '我的核心结论（一句话）', '支撑结论的证据', '需要对方做的决定'],
    },
    engine: 'rule',
  };
}

/* ────────────────────────────────────────────────────────────
   5. 对外主函数
   ──────────────────────────────────────────────────────────── */

export async function makePlan({ client, cfg, task, minutesPerDay, days, role }) {
  const budget = { minutesPerDay, days };

  // 5.1 关键词
  const kwResp = await llm(cfg,
    '你是企业学习顾问。把用户的工作任务转成用于课程库检索的中文关键词。只返回 JSON。',
    `任务：${task}\n角色：${role || '未提供'}\n返回 {"keywords":["…"],"goal":"一句话说明学完要能做到什么"}，keywords 3~5 个，都是 2~4 字的通用能力词（如 汇报、复盘、反馈、排期），不要出现公司名或产品名。`
  );
  const keywords = (kwResp?.keywords?.length ? kwResp.keywords : keywordsByRule(task)).slice(0, 5);

  // 5.2 素材池
  const { courses, pool } = await buildPool(client, keywords);
  if (!pool.length) {
    const err = new Error('没有检索到可用课程，请换一种说法描述任务');
    err.code = 'EMPTY_POOL';
    throw err;
  }

  // 5.3 规划
  const ranked = scorePool(task, keywords, pool).slice(0, 60);
  const menu = ranked.map((s, i) =>
    `${i}｜${s.courseTitle}｜${s.chapter}｜${s.name}｜${s.minutes}分钟｜${s.contentType}`
  ).join('\n');

  const llmPlan = await llm(cfg,
    [
      '你是企业学习教练。用户有一件马上要做的工作任务和很有限的时间。',
      '你只能从给定的"节清单"里挑内容，不能自己编课程或章节。',
      '排路径的原则：先解决任务里最卡人的那一步；每天总时长不超过预算；宁可少而准，不要多而全。',
      '只返回 JSON。',
    ].join('\n'),
    [
      `任务：${task}`,
      `角色：${role || '未提供'}`,
      `预算：每天 ${minutesPerDay} 分钟，共 ${days} 天`,
      '',
      '可选节清单（编号｜课程｜章｜节｜时长｜类型）：',
      menu,
      '',
      '返回格式：',
      '{"goal":"一句话，学完要能做到什么",',
      ' "days":[{"day":1,"steps":[{"index":0,"why":"为什么这一节对这件事有用，20字内","action":"看完立刻做的一个具体动作，25字内"}]}],',
      ' "deliverable":{"title":"产出物名称","outline":["提纲条目"]}}',
      '',
      `约束：每天 steps 的时长之和不得超过 ${minutesPerDay} 分钟；总步数 ${days * 2} 到 ${days * 3} 之间；index 必须来自上面的清单。`,
      'deliverable 是用户完成学习后要交出去的东西（如汇报提纲、复盘框架、沟通脚本），outline 给 4~6 条可直接填写的提纲。',
    ].join('\n')
  );

  let plan;
  if (llmPlan?.days?.length) {
    plan = {
      goal: llmPlan.goal || kwResp?.goal || '',
      deliverable: llmPlan.deliverable || { title: '任务准备清单', outline: [] },
      engine: 'llm',
      days: llmPlan.days.map((d, i) => ({
        day: d.day || i + 1,
        steps: (d.steps || [])
          .map(st => {
            const s = ranked[Number(st.index)];
            if (!s) return null;                       // 模型编了不存在的编号，直接丢弃
            return { courseId: s.courseId, nodeId: s.nodeId, why: st.why, action: st.action };
          })
          .filter(Boolean),
      })).filter(d => d.steps.length),
    };
    if (!plan.days.length) plan = greedyPlan(task, keywords, pool, budget);
  } else {
    plan = greedyPlan(task, keywords, pool, budget);
  }

  // 5.4 回填节的完整信息
  const byNode = new Map(pool.map(s => [`${s.courseId}:${s.nodeId}`, s]));
  for (const d of plan.days) {
    d.steps = d.steps.map(st => ({ ...st, ...byNode.get(`${st.courseId}:${st.nodeId}`) }));
    d.minutes = d.steps.reduce((a, s) => a + (s.minutes || 0), 0);
    // 大模型常把一天排爆，超出预算就从末尾裁；至少保留一节。
    while (d.minutes > minutesPerDay && d.steps.length > 1) {
      d.minutes -= d.steps.pop().minutes || 0;
    }
  }
  plan.days = plan.days.filter(d => d.steps.length).map((d, i) => ({ ...d, day: i + 1 }));
  plan.keywords = keywords;
  plan.totalMinutes = plan.days.reduce((a, d) => a + d.minutes, 0);
  plan.courses = courses.map(c => ({ courseId: c.courseId, title: c.title }));
  plan.poolSize = pool.length;
  return plan;
}
