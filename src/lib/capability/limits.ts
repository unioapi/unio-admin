// capability limits 的纯展示与解析工具，模型能力 / 渠道收紧弹窗共用。

// formatLimits 把 limits JSON 值渲染成紧凑字符串用于展示与表单回填；null/undefined → 空串。
export function formatLimits(limits: unknown): string {
  if (limits == null) return "";
  return JSON.stringify(limits);
}

