import crypto from 'node:crypto';

const HMAC = { 2: 'sha1', 3: 'sha256', 4: 'sha384', 5: 'sha512' };

/**
 * 三节课通用签名。
 * signType=1 走 MD5(stringA + "&appSecret=xxx")，2~5 走 HmacSha(stringA, appSecret)。
 * 两者都取 16 进制大写。
 */
export function sign(stringA, signType, appSecret) {
  const t = Number(signType);
  if (t === 1) {
    return crypto.createHash('md5')
      .update(`${stringA}&appSecret=${appSecret}`, 'utf8')
      .digest('hex').toUpperCase();
  }
  const algo = HMAC[t];
  if (!algo) throw new Error(`不支持的 signType: ${signType}`);
  return crypto.createHmac(algo, appSecret)
    .update(stringA, 'utf8')
    .digest('hex').toUpperCase();
}

/**
 * 开放 API 鉴权头。
 * 关键点：只有 appId / signType / timestamp 三个字段参与签名，
 * 任何 query 参数和请求体都不参与。
 */
export function apiHeaders({ appId, appSecret, signType = 3 }) {
  const timestamp = Date.now();
  const stringA = `appId=${appId}&signType=${signType}&timestamp=${timestamp}`;
  return {
    'X-APP-ID': String(appId),
    'X-SIGN-TYPE': String(signType),
    'X-TIMESTAMP': String(timestamp),
    'X-DATA-SIGN': sign(stringA, signType, appSecret),
  };
}

/**
 * 上课页地址：/study/0/{courseId}/{nodeId}，节 ID 可实现直达指定节。
 * 本产品挂在平台首页内，用户浏览器已有登录态，跳这个地址即可，
 * 不需要再走 /oauth/custom 换免密票据。
 */
export function studyUrl(domain, courseId, nodeId) {
  const base = `${domain.replace(/\/$/, '')}/study/0/${courseId}`;
  return nodeId ? `${base}/${nodeId}` : base;
}
