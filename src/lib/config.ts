// 直连 admin-server；生产用 VITE_ADMIN_API_BASE 覆盖。
export const API_BASE =
  import.meta.env.VITE_ADMIN_API_BASE ?? "http://127.0.0.1:8522";
