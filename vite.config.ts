import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// 生产构建禁止落到 localhost 或明文 http 的 API 基址。
//
// API 基址在构建期被静态烘进产物，一旦烘错就只能重新构建，而错误本身在运行前不可见——
// 页面能打开、请求全部打向使用者本机。这里在构建期直接失败，把只能靠人工纪律保证的事变成硬约束。
//
// 允许空串：表示同源相对路径，由反向代理把 /admin/v1 转给 admin-server，是推荐形态。
// 本地想验证生产产物时用 `bun run build:local`（development 模式），不受本校验约束。
function assertProductionAPIBase(base: string | undefined): void {
  const hint = "在 .env.production 配置 VITE_ADMIN_API_BASE，或用 bun run build:local 做本地产物验证"

  if (base === undefined) {
    throw new Error(`生产构建缺少 VITE_ADMIN_API_BASE。${hint}`)
  }

  // 空串是显式选择的同源相对路径，不需要进一步校验。
  if (base === "") return

  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new Error(
      `VITE_ADMIN_API_BASE 不是合法的绝对 URL：${base}。填完整地址（如 https://admin.example.com）或留空表示同源。`,
    )
  }

  if (url.protocol !== "https:") {
    throw new Error(
      `VITE_ADMIN_API_BASE 必须使用 https，当前为 ${url.protocol}//。明文 HTTP 会让 admin token 在传输中暴露。`,
    )
  }

  const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"]
  if (loopback.includes(url.hostname)) {
    throw new Error(
      `VITE_ADMIN_API_BASE 指向本机地址 ${url.hostname}，不能用于生产构建：部署后所有请求会打向使用者自己的机器。${hint}`,
    )
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === "production") {
    // loadEnv 的优先级为 .env < .env.local < .env.[mode] < .env.[mode].local，
    // 且 process.env 覆盖全部文件，因此 CI 直接设环境变量即可覆盖 .env.production。
    assertProductionAPIBase(loadEnv(mode, process.cwd()).VITE_ADMIN_API_BASE)
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
