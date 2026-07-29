import { apiHeaders } from './sign.js';
import * as mock from './mock.js';

const cache = new Map();
const TTL = 10 * 60 * 1000;

export class SjkClient {
  constructor(cfg) {
    this.cfg = cfg;
    this.mock = cfg.mock || !cfg.appId || !cfg.appSecret;
  }

  async #call(method, path, { query, body } = {}) {
    const url = new URL(`${this.cfg.domain.replace(/\/$/, '')}/coop-api/v3${path}`);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
    const key = `${method} ${url}${body ? JSON.stringify(body) : ''}`;
    const hit = cache.get(key);
    if (method === 'GET' && hit && Date.now() - hit.at < TTL) return hit.data;

    const headers = apiHeaders(this.cfg);
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({ code: -1, msg: '响应不是合法 JSON' }));
    if (json.code !== 200) {
      throw new Error(`三节课接口 ${path} 返回 ${json.code}：${json.msg || '未知错误'}`);
    }
    if (method === 'GET') cache.set(key, { at: Date.now(), data: json.data });
    return json.data;
  }

  /** GET /course/list —— 课程检索 */
  async courseList({ keyword, categoryId, courseIds, page = 1, pageSize = 20 } = {}) {
    if (this.mock) return mock.courseList({ keyword, courseIds });
    const data = await this.#call('GET', '/course/list', {
      query: { keyword, categoryId, courseIds, page, pageSize },
    });
    return data.list || [];
  }

  /** GET /course/catalog —— 课程大纲，拿到节级 nodeId 与时长 */
  async courseCatalog(courseId) {
    if (this.mock) return mock.courseCatalog(courseId);
    const data = await this.#call('GET', '/course/catalog', { query: { courseId } });
    return { catalog: data.catalog || [], videoDuration: data.videoDuration || 0 };
  }

  /** GET /study_data/student_section_finish —— 节级完成状态 */
  async sectionFinish({ openid, courseId }) {
    if (this.mock) return mock.sectionFinish({ openid, courseId });
    const data = await this.#call('GET', '/study_data/student_section_finish', {
      query: { openid, courseId },
    });
    return data.content || [];
  }

  /** POST /course/student —— 幂等地把学员加入课程 */
  async joinCourse({ courseId, openidList }) {
    if (this.mock) return { successUserList: openidList.map(o => ({ openid: o })), failUserList: [] };
    return this.#call('POST', '/course/student', { body: { courseId, openidList } });
  }
}

/**
 * 估算一节的耗时（分钟）。
 * 接口只对视频给出 videoDuration，图文和测试题时长为 0，
 * 直接用会让时间预算严重失真，所以按内容类型给经验值。
 */
function estimateMinutes(node) {
  if (node.videoDuration > 0) return Math.max(1, Math.round(node.videoDuration / 60));
  switch (node.finalContentType) {
    case 'exam': return Math.max(3, Math.round((node.examCount || 5) * 1.5));
    case 'question': return 15;
    case 'text': return 4;
    default: return 5;
  }
}

/**
 * 把两级大纲拍平成"可安排的最小学习单元"。
 * 只保留叶子节（type=section），章仅作为上下文标题保留。
 */
export function flattenSections(catalog, course) {
  const out = [];
  const walk = (nodes, chapter) => {
    for (const n of nodes || []) {
      if (n.type === 'chapter') {
        walk(n.children, n.name);
      } else {
        out.push({
          courseId: course.courseId,
          courseTitle: course.title,
          nodeId: n.nodeId,
          chapter: chapter || '',
          name: n.name,
          contentType: n.finalContentType || 'video',
          examCount: n.examCount || 0,
          seconds: n.videoDuration || 0,
          minutes: estimateMinutes(n),
        });
        if (n.children?.length) walk(n.children, chapter);
      }
    }
  };
  walk(catalog, '');
  return out;
}
