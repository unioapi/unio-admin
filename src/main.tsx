import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/lib/auth/AuthContext.tsx";
import { ThemeProvider } from "@/components/theme/ThemeProvider.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { installScrollVisibility } from "@/lib/scroll-visibility";

installScrollVisibility();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 切到其他浏览器标签页再回来时不自动重取：窗口重新聚焦触发的后台 refetch 会重渲染列表，
      // 把正在打开的弹窗/下拉/输入挤掉（也造成无谓抖动与丢失滚动位置）。
      // 数据新鲜度改由「写操作后 invalidateQueries」+ 手动刷新保证，不依赖窗口聚焦。
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <NuqsAdapter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </NuqsAdapter>
          </BrowserRouter>
        </TooltipProvider>
        <Toaster richColors position="top-center" />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
