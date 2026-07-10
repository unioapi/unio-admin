import axios from "axios";
import { API_BASE } from "@/lib/config";
import { getToken, clearToken } from "@/lib/auth/token";

const authHeader = (token: string) => `Bearer ${token}`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器：每个请求自动带上 Bearer token，省掉每次手写 header。
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = authHeader(token);
  }
  return config;
});

// 响应拦截器：任何接口返回 401 → 清 token 并踢回登录页。
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

// 后端错误信封：{ error: { code, message } }。
interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

// 把 axios 错误翻成可展示文案：优先后端 error.message，退回 axios message。
export function apiErrorMessage(
  err: unknown,
  fallback = "请求失败，请重试",
): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.error?.message ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

// 取 axios 错误里的 HTTP 状态码（非 axios 错误返回 undefined），便于按状态分流文案，
// 例如删除被拒（409）时给出「请改用停用」的中文提示，而非直接透出后端英文 message。
export function apiErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

// 取后端错误码（error.code），便于按业务码分流文案，
// 例如价格窗口重叠（admin_pricing_window_overlap）时给出中文引导而非透出英文 message。
export function apiErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.error?.code;
  }
  return undefined;
}
