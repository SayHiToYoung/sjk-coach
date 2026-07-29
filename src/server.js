import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SjkClient } from './sjk.js';
import { makePlan } from './planner.js';
import { ssoUrl, studyUrl } from './sign.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* 轻量 .env 解析，避免引入 dotenv */
function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) {
      process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const cfg = {
  domain: process.env.SJK_DOMAIN || 'https://haoxue.b.sanjieke.cn',
  appId: process.env.SJK_APP_ID || '',
  appSecret: process.env.SJK_APP_SECRET || '',
  signType: Number(process.env.SJK_SIGN_TYPE || 3),
  mock: process.env.MOCK === '1',
  demoOpenid: process.env.DEMO_OPENID || 'haoxue24362792',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'deepseek-chat',
};

const client = new SjkClient(cfg);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const readBody = req => new Promise((resolve, reject) => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 1e6) reject(new Error('请求体过大')); });
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
});

/** 给每一步生成免密直达链接；缺少密钥时退回普通上课页地址 */
function attachLinks(plan, openid) {
  for (const d of plan.days) {
    for (const s of d.steps) {
      const target = studyUrl(cfg.domain, s.courseId, s.nodeId);
      s.studyUrl = target;
      s.openUrl = (cfg.appId && cfg.appSecret)
        ? ssoUrl({
            domain: cfg.domain, appId: cfg.appId, appSecret: cfg.appSecret,
            signType: cfg.signType, openid,
            fromUri: encodeURIComponent(target),
            expires: 7 * 24 * 3600 * 1000,
          })
        : target;
    }
  }
  return plan;
}

const routes = {
  'GET /api/config': async (_req, res) => send(res, 200, {
    mock: client.mock,
    hasLLM: Boolean(cfg.llmApiKey),
    ssoEnabled: Boolean(cfg.appId && cfg.appSecret),
    domain: cfg.domain,
    openid: cfg.demoOpenid,
  }),

  'POST /api/plan': async (req, res) => {
    const b = await readBody(req);
    const task = String(b.task || '').trim();
    if (task.length < 4) return send(res, 400, { error: '把这件事写具体一点，至少 4 个字' });

    const minutesPerDay = Math.min(120, Math.max(5, Number(b.minutesPerDay) || 20));
    const days = Math.min(10, Math.max(1, Number(b.days) || 3));
    const openid = String(b.openid || cfg.demoOpenid);

    try {
      const plan = await makePlan({ client, cfg, task, minutesPerDay, days, role: b.role });
      // 注意：不要往结果里塞名为 days 的数字，会覆盖 plan.days 这个数组
      send(res, 200, attachLinks({ ...plan, task, minutesPerDay, dayBudget: days, openid }, openid));
    } catch (e) {
      send(res, e.code === 'EMPTY_POOL' ? 404 : 502, { error: e.message });
    }
  },

  'GET /api/progress': async (req, res, url) => {
    const openid = url.searchParams.get('openid') || cfg.demoOpenid;
    const ids = (url.searchParams.get('courseIds') || '').split(',').filter(Boolean);
    const finished = [];
    for (const id of ids) {
      try {
        const content = await client.sectionFinish({ openid, courseId: id });
        const walk = ns => ns.forEach(n => {
          if (n.status === 'finished' && n.type === 'section') finished.push(`${id}:${n.nodeId}`);
          if (n.children?.length) walk(n.children);
        });
        walk(content);
      } catch { /* 单门课查不到不影响其余 */ }
    }
    send(res, 200, { finished });
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handler = routes[`${req.method} ${url.pathname}`];

  if (handler) {
    try { await handler(req, res, url); }
    catch (e) { send(res, 500, { error: e.message }); }
    return;
  }

  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(ROOT, 'public', path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (file.startsWith(path.join(ROOT, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  }
  send(res, 404, { error: '页面不存在' });
});

const port = Number(process.env.PORT || 5173);
server.listen(port, () => {
  console.log(`\n  明天要用 · 学习教练  http://localhost:${port}`);
  console.log(`  数据源：${client.mock ? '离线演示数据（未配置 App ID/Secret 或 MOCK=1）' : cfg.domain}`);
  console.log(`  规划器：${cfg.llmApiKey ? cfg.llmModel : '内置规则版（未配置 LLM_API_KEY）'}\n`);
});
