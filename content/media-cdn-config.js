/**
 * 祝福图/音/视频与生日页 BGM 的远程根地址（index.html、cake.html 共用）。
 * 与部署页（如 GitHub Pages）不同：在 file://、localhost 或私网 IP 下打开时，主页面会**忽略**
 * 下方 COS，改为使用与当前页同源的 content/ 路径，便于本机/局域网直接读仓库里的大图与音频。
 *
 * 当前策略：线上**一律直连腾讯云 COS 桶**（MEDIA_CDN_FALLBACK_COS_BASE），不经过 Worker/加速域名，
 * 避免经 CDN 拉图/音视频过慢。若需改回走自有 CDN，可填写 MEDIA_CDN_ACCELERATION_BASE并在 index 的
 * BLESSINGS_MEDIA_CDN_BASE 中恢复“加速优先”顺序（见 index.html 内注释）。
 *
 * 计费：浏览器访问 `*.cos.*.myqcloud.com` 桶域名时，流量计 COS 外网下行。
 * CORS：须允许页面来源（如 https://chloe717222.github.io）。
 *
 * 勿以 /content/ 结尾；strip 规则与原先一致（去掉路径里的 content/ 前缀），见
 * window.MEDIA_CDN_STRIP_LEADING_CONTENT。
 */
(function () {
  "use strict";
  /**
   * 置空 = 不经过加速域名。线上媒体从 MEDIA_CDN_FALLBACK_COS_BASE 走。
   * 若将来恢复：填 https 根，勿以 /content/ 结尾。
   */
  window.MEDIA_CDN_ACCELERATION_BASE = "";

  /**
   * 腾讯云 COS 桶默认域名（直链，图/音/视频统一走此根）。
   */
  window.MEDIA_CDN_FALLBACK_COS_BASE =
    "https://liulian20260426true-1409956502.cos.ap-guangzhou.myqcloud.com/";

  /**
   * 须保留 content 前缀，避免媒体 URL 变成 /xxx.png 导致 404。
   */
  window.MEDIA_CDN_STRIP_LEADING_CONTENT = false;
})();
