import axios from "axios";
import { api } from "@/lib/api/client";
import { API_BASE } from "@/lib/config";

// 与后端 adminapi login / logout handler 的 DTO 对齐。
// 单管理员极简版：账号口令是唯一登录凭证，登录后由服务端签发随机会话 token 存于 Redis。

export interface LoginResponse {
  token: string;
  expires_in: number;
}

// 登录用独立实例，不挂 client.ts 的拦截器：
//   - 请求侧：登录是唯一不需要 token 的接口，不应附带上一次残留的失效 token；
//   - 响应侧：口令错误的 401 要留在登录页内联提示，不能触发「清 token 并跳转登录页」。
const loginClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// login 用用户名口令换取会话 token。
export async function login(
  username: string,
  password: string,
): Promise<string> {
  const res = await loginClient.post<LoginResponse>("/admin/v1/login", {
    username,
    password,
  });

  return res.data.token;
}

// logout 通知服务端吊销当前会话。
//
// 走带拦截器的 api 实例，因为它需要携带当前 token 才能定位要吊销哪个会话。
// 调用方不应因失败而阻塞本地登出：服务端不可达时本地仍要清 token，
// 否则用户会卡在一个「点了登出却退不掉」的状态。
export async function logout(): Promise<void> {
  await api.post("/admin/v1/logout");
}
