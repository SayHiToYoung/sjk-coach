/**
 * 离线演示数据。
 * 字段结构严格对齐 /course/list、/course/catalog、/study_data/student_section_finish
 * 的响应体，因此从 MOCK 切到真实接口时上层代码零改动。
 * 内容为便于演示而编写的示例，非三节课真实课程目录。
 */

const DOMAIN = 'https://haoxue.b.sanjieke.cn';
let seq = 34400000;
const nid = () => ++seq;

// [章名, [[节名, 分钟, 类型], ...]]
const COURSES = [
  {
    courseId: 416,
    title: '优秀管理者的四项必修课',
    subTitle: '打造人人都需要的职场领导力',
    tags: ['管理', '带团队', '反馈', '授权', '目标'],
    teachers: ['汤君健'],
    chapters: [
      ['第一章 定目标', [
        ['为什么你的目标团队记不住', 6, 'video'],
        ['把目标翻译成动作：OKR 拆解三步', 11, 'video'],
        ['目标对齐会怎么开', 9, 'video'],
        ['小测：你的目标合格吗', 4, 'exam'],
      ]],
      ['第二章 做反馈', [
        ['正面反馈为什么会失效', 7, 'video'],
        ['BIC 负反馈模型', 12, 'video'],
        ['一对一沟通的开场与收尾', 8, 'video'],
        ['反馈话术模板', 3, 'text'],
      ]],
      ['第三章 抓执行', [
        ['进度失控的三个早期信号', 8, 'video'],
        ['复盘会：从追责到归因', 13, 'video'],
      ]],
      ['第四章 带梯队', [
        ['授权的边界怎么划', 10, 'video'],
        ['识别高潜的四个观察点', 9, 'video'],
      ]],
    ],
  },
  {
    courseId: 5121,
    title: '结构化表达与高效汇报',
    subTitle: '让老板三分钟听懂你的结论',
    tags: ['汇报', '表达', '沟通', '演讲', '写作', 'PPT', '结论'],
    teachers: ['李忠秋'],
    chapters: [
      ['第一章 先想清楚', [
        ['汇报的本质是帮对方做决策', 5, 'video'],
        ['结论先行：一句话说清你的主张', 9, 'video'],
        ['受众分析：老板到底在意什么', 7, 'video'],
      ]],
      ['第二章 搭结构', [
        ['金字塔结构的四条铁律', 12, 'video'],
        ['三种常用汇报框架：SCQA / 时间轴 / 问题树', 14, 'video'],
        ['汇报提纲模板', 4, 'text'],
      ]],
      ['第三章 讲出去', [
        ['开场 30 秒抓住注意力', 8, 'video'],
        ['被临时打断怎么接回来', 9, 'video'],
        ['数据怎么讲才有说服力', 11, 'video'],
        ['小测：这段汇报问题在哪', 5, 'exam'],
      ]],
    ],
  },
  {
    courseId: 5233,
    title: '产品经理的数据分析实战',
    subTitle: '从看板到结论，做出能落地的判断',
    tags: ['数据', '分析', '指标', '复盘', '增长', 'AB 测试', '留存'],
    teachers: ['王刚Santiago'],
    chapters: [
      ['第一章 指标体系', [
        ['北极星指标怎么选', 10, 'video'],
        ['过程指标与结果指标的区别', 8, 'video'],
        ['搭一张指标地图', 12, 'video'],
      ]],
      ['第二章 看数据', [
        ['留存曲线的三种形状', 11, 'video'],
        ['漏斗分析：定位流失环节', 13, 'video'],
        ['同期群分析入门', 10, 'video'],
      ]],
      ['第三章 出结论', [
        ['相关不等于因果：常见归因陷阱', 9, 'video'],
        ['数据复盘报告怎么写', 12, 'video'],
        ['AB 测试结果如何判读', 14, 'video'],
      ]],
    ],
  },
  {
    courseId: 5310,
    title: '跨部门协作与向上沟通',
    subTitle: '没有授权，也能推动事情发生',
    tags: ['协作', '沟通', '推动', '上级', '冲突', '会议'],
    teachers: ['张丽俊'],
    chapters: [
      ['第一章 摸清立场', [
        ['干系人地图：谁能帮你，谁会挡你', 10, 'video'],
        ['对方的 KPI 决定对方的态度', 7, 'video'],
      ]],
      ['第二章 谈出结果', [
        ['提需求的正确姿势', 9, 'video'],
        ['分歧当场谈不拢怎么办', 11, 'video'],
        ['会议纪要如何变成承诺', 6, 'text'],
      ]],
      ['第三章 向上管理', [
        ['同步节奏：什么该报，什么不必报', 8, 'video'],
        ['坏消息怎么汇报', 10, 'video'],
      ]],
    ],
  },
  {
    courseId: 5402,
    title: '项目管理：从计划到交付',
    subTitle: '把不确定的事排进确定的日程',
    tags: ['项目', '计划', '排期', '风险', '交付', '需求'],
    teachers: ['陈勇'],
    chapters: [
      ['第一章 立项', [
        ['项目章程：先把边界说清楚', 9, 'video'],
        ['需求澄清的五个问题', 8, 'video'],
      ]],
      ['第二章 排期', [
        ['WBS 工作分解怎么做', 12, 'video'],
        ['关键路径与缓冲区', 11, 'video'],
        ['排期评审checklist', 4, 'text'],
      ]],
      ['第三章 控风险', [
        ['风险登记表的用法', 9, 'video'],
        ['延期已经发生，如何止损', 10, 'video'],
      ]],
    ],
  },
  {
    courseId: 5508,
    title: 'AI 提效：把大模型用进日常工作',
    subTitle: '不写代码也能把活干快一倍',
    tags: ['AI', '大模型', '提效', '提示词', '自动化', '工具'],
    teachers: ['刘飞'],
    chapters: [
      ['第一章 用起来', [
        ['哪些工作适合交给 AI', 7, 'video'],
        ['提示词的四要素', 10, 'video'],
        ['常用提示词模板', 4, 'text'],
      ]],
      ['第二章 用得准', [
        ['给 AI 喂上下文的三种方式', 11, 'video'],
        ['幻觉识别与结果校验', 9, 'video'],
      ]],
      ['第三章 用得深', [
        ['把重复流程做成工作流', 13, 'video'],
        ['团队级 AI 使用规范', 8, 'video'],
      ]],
    ],
  },
];

const build = () => COURSES.map(c => {
  const catalog = c.chapters.map(([chName, secs]) => ({
    nodeId: nid(),
    name: chName,
    type: 'chapter',
    finalContentType: null,
    examCount: secs.filter(s => s[2] === 'exam').length,
    videoDuration: secs.reduce((a, s) => a + (s[2] === 'video' ? s[1] * 60 : 0), 0),
    children: secs.map(([name, min, type]) => ({
      nodeId: nid(),
      name,
      type: 'section',
      finalContentType: type,
      examCount: type === 'exam' ? 5 : 0,
      videoDuration: type === 'video' ? min * 60 : 0,
      // 图文/测试题没有视频时长，用预计阅读/作答时长兜底
      children: [],
    })),
  }));
  const total = catalog.reduce((a, ch) => a + ch.videoDuration, 0);
  const sectionCount = catalog.reduce((a, ch) => a + ch.children.length, 0);
  return {
    courseId: c.courseId,
    title: c.title,
    subTitle: c.subTitle,
    cover: '',
    sectionCount,
    videoDuration: `${Math.floor(total / 3600)}小时${Math.round((total % 3600) / 60)}分钟`,
    videoDurationSec: total,
    updatedAtUnix: Date.now(),
    categoryList: [],
    teachers: c.teachers.map(name => ({ name, avatar: '' })),
    detailUrl: `${DOMAIN}/course/${c.courseId}`,
    studyUrl: `${DOMAIN}/study/0/${c.courseId}`,
    _tags: c.tags,
    _catalog: catalog,
  };
});

const DB = build();

export function courseList({ keyword, courseIds } = {}) {
  let list = DB;
  if (courseIds) {
    const ids = String(courseIds).split(',').map(s => Number(s.trim()));
    list = list.filter(c => ids.includes(c.courseId));
  } else if (keyword) {
    const k = String(keyword);
    list = list.filter(c =>
      c.title.includes(k) || c.subTitle.includes(k) || c._tags.some(t => t.includes(k) || k.includes(t))
    );
  }
  return list.map(({ _catalog, ...rest }) => rest);
}

export function courseCatalog(courseId) {
  const c = DB.find(x => x.courseId === Number(courseId));
  if (!c) throw new Error(`课程 ${courseId} 不存在`);
  return { catalog: c._catalog, videoDuration: c.videoDurationSec };
}

/** 演示用：把每门课前 30% 的节标记为已完成 */
export function sectionFinish({ courseId }) {
  const c = DB.find(x => x.courseId === Number(courseId));
  if (!c) return [];
  const all = c._catalog.flatMap(ch => ch.children);
  const done = new Set(all.slice(0, Math.ceil(all.length * 0.3)).map(s => s.nodeId));
  return c._catalog.map(ch => ({
    nodeId: ch.nodeId,
    type: 'chapter',
    name: ch.name,
    status: ch.children.every(s => done.has(s.nodeId)) ? 'finished' : 'unfinished',
    children: ch.children.map(s => ({
      nodeId: s.nodeId, type: 'section', name: s.name,
      status: done.has(s.nodeId) ? 'finished' : 'unfinished',
    })),
  }));
}
