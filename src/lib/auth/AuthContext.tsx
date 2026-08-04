import { createContext, useContext, useState, type ReactNode } from "react";
import { logout as revokeSession } from "@/lib/api/auth";
import { getToken, setToken, clearToken } from "@/lib/auth/token";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());

  function login(token: string) {
    setToken(token);
    setTokenState(token);
  }

  // 先通知服务端吊销会话，再清本地 token。
  //
  // 服务端不可达时仍然清本地：登出必须永远成功，否则用户会卡在「点了登出却退不掉」的状态。
  // 代价是那个会话要等 TTL 自然过期，可接受——本地已无 token，攻击面不因此扩大。
  async function logout() {
    try {
      await revokeSession();
    } catch {
      // 吞掉：本地登出不依赖服务端结果。
    }
    clearToken();
    setTokenState(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");

  return ctx;
}
