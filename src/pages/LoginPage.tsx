import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login as requestLogin } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { UnioMark } from "@/components/brand/UnioMark";
import { HintLabel } from "@/components/common/field-hint";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 后端校验通过才签发 token；拿到后再写入本地，避免失败时留下半登录状态。
      const token = await requestLogin(username, password);
      login(token);
      navigate("/", { replace: true });
    } catch {
      // 不区分用户名错、口令错与服务不可用，与后端同一句文案保持一致，不泄露哪一项有效。
      setError("用户名或密码错误，或服务暂不可用");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <UnioMark className="mb-1 size-10 rounded-lg" />
          <CardTitle>Unio 控制台</CardTitle>
          <CardDescription>输入管理员账号登录</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!error}>
                <HintLabel htmlFor="username" hint="管理员用户名。">
                  用户名
                </HintLabel>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={!!error}
                  autoFocus
                />
              </Field>
              <Field data-invalid={!!error}>
                <HintLabel htmlFor="password" hint="管理员密码，校验通过后登录控制台。">
                  密码
                </HintLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !username || !password}
            >
              {loading && <Spinner data-icon="inline-start" />}
              {loading ? "登录中..." : "登录"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
