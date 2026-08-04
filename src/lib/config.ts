// Admin API 基址。生产由 .env.production 的 VITE_ADMIN_API_BASE 提供，
// 并在构建期经 vite.config.ts 校验必须是 https 且非本机地址（空串表示同源相对路径）。
//
// 兜底值只在 `vite dev` 下生效：构建产物不再隐式回落到 localhost，
// 否则一旦漏配就会得到一个能打开、但所有请求都打向使用者本机的页面。
export const API_BASE =
  import.meta.env.VITE_ADMIN_API_BASE ??
  (import.meta.env.DEV ? "http://127.0.0.1:8522" : "");
