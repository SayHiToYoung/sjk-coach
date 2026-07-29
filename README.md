# 明天要用 · 学习教练

基于三节课企业版开放 API 的即时学习产品。把一件马上要做的工作任务，拆成一条能塞进碎片时间的节级学习路径。

产品说明见 [`docs/一页纸产品说明.md`](docs/一页纸产品说明.md)。

## 跑起来

需要 Node 18+，无第三方依赖。

```bash
cp .env.example .env      # 填入 SJK_APP_ID / SJK_APP_SECRET
npm start                 # http://localhost:5173
```

不配密钥也能跑，会自动用内置演示数据：

```bash
npm run demo
```

配置项都在 `.env.example` 里，两个可选开关：

- `LLM_API_KEY` — 任意 OpenAI 兼容端点。不填则走内置规则版规划器，功能完整。
- `MOCK=1` — 强制离线演示数据，不访问三节课接口。

## 用到的接口

| 用途 | 接口 |
| --- | --- |
| 按关键词检索课程 | `GET /coop-api/v3/course/list` |
| 拆出节级学习单元 | `GET /coop-api/v3/course/catalog` |
| 节级完成状态回流 | `GET /coop-api/v3/study_data/student_section_finish` |
| 免密直达指定节 | `/oauth/custom`（简化版认证 V2） |
| 显式加入课程（备用） | `POST /coop-api/v3/course/student` |

## 代码结构

```
src/sign.js      签名：MD5 与 HMAC-SHA1/256/384/512
src/sjk.js       API 客户端、大纲拍平、时长估算
src/planner.js   关键词抽取 → 素材池 → 排序 → 装箱
src/server.js    HTTP 服务与三个端点
src/mock.js      离线演示数据（字段结构与接口文档一致）
public/          前端
```

## 实现时踩到的几个点

**签名字段范围。** 开放 API 只有 `appId`、`signType`、`timestamp` 三个字段参与签名，任何 query 参数和请求体都不参与。SSO 链接则是另一套字段，按 ASCII 升序拼接，`fromUri` 用原值参与签名、URL encode 后拼进地址。两处容易混。

**图文和测试题没有时长。** `videoDuration` 只对视频有值，图文与测试题为 0。直接拿来做时间预算会严重失真，`estimateMinutes()` 按内容类型给了经验值。

**每日预算必须是硬约束。** 顺序装箱会把放不下的内容全推给最后一天。改成定容装箱，放不下就丢弃；大模型排出的路径也做同样校验——排出一个会超时的计划，等于没有计划。

**排序权重。** 节标题最能说明这一节讲什么，权重必须高于课程名，否则一门课的大标题会把它下面每一节都拽到前面。另设相关度下限：低于最高分 35% 的节一律不排，宁可留白也不凑满预算。

## 安全

`appSecret` 只从环境变量读取，不出现在任何源文件、前端产物和文档中；`.env` 已在 `.gitignore` 内。签名一律在服务端完成，前端拿到的只有已签好的直达链接。

**若 appSecret 曾以明文形式出现在文档、聊天记录或截图中，应联系三节课轮换。** 该密钥可用于调用空间的全部接口，包括创建用户与修改部门。
