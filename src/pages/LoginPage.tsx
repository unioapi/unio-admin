import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
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
  const [tokenInput, setTokenInput] = useState(
    "aaea03ff7be2ed70849f058fa9f22400382139fafe264c663e8fdef92d664afb",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    login(tokenInput);
    try {
      await api.get("/admin/v1/ping");
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      logout();
      setError("Token 无效或服务不可用，请检查后重试");
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
          <CardDescription>输入管理端访问 Token 登录</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!error}>
                <HintLabel htmlFor="token" hint="管理端访问 Token，校验通过后登录控制台。">
                  访问 Token
                </HintLabel>
                <Input
                  id="token"
                  type="password"
                  placeholder="粘贴 Token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  aria-invalid={!!error}
                  autoFocus
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !tokenInput}
            >
              {loading && <Spinner data-icon="inline-start" />}
              {loading ? "校验中..." : "登录"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
