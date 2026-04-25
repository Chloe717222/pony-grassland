/**
 * 祝福图/音/视频与生日页 BGM 的远程根地址（index.html、cake.html 共用）。
 * 与部署页（如 GitHub Pages）不同：在 file://、localhost 或私网 IP 下打开时，主页面会**忽略**
 * 下方 COS 回退，改为使用与当前页同源的 content/ 路径，便于本机/局域网直接读仓库里的大图与音频。
 *
 * 计费说明：浏览器访问 `*.cos.*.myqcloud.com` 默认桶域名时，流量一般计「COS 外网下行」；
 * 在腾讯云「内容分发网络 CDN」里把源站设为该 COS 桶并绑定加速域名后，把下面
 * MEDIA_CDN_ACCELERATION_BASE 设为该域名的 https 根（末尾可带 /），请求会走 CDN 出网计费，
 * 通常比 COS 直链便宜。
 *
 * 控制台概览：CDN → 域名管理 → 新增域名 → 源站类型选 COS → 选对桶；HTTPS/回源协议按控制台说明。
 * CORS：须允许页面来源（如 https://chloe717222.github.io）。
 *
 * 勿以 /content/ 结尾；strip 规则与原先一致（去掉路径里的 content/ 前缀）。
 */
(function () {
  "use strict";
  /** Cloudflare Worker 自定义域名（线上走 CDN 代理与缓存）。 */
  window.MEDIA_CDN_ACCELERATION_BASE = "https://static.lianbirthday.top/";

  /**
   * 未配置 CDN 时回退：COS 默认域名（直连桶，COS 外网下行计费）。
   * 配置好 CDN 并填写 MEDIA_CDN_ACCELERATION_BASE 后，运行时优先用 CDN，此项仅作兜底。
   */
  window.MEDIA_CDN_FALLBACK_COS_BASE =
    "https://liulian20260426true-1409956502.cos.ap-guangzhou.myqcloud.com/";

  /**
   * Worker 仅代理 /content/*，这里必须保留 content 前缀，避免媒体 URL 变成 /xxx.png 导致 404。
   */
  window.MEDIA_CDN_STRIP_LEADING_CONTENT = false;
})();
