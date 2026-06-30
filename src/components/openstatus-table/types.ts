import type { ReactNode } from "react";

/** openstatus 风格 facet 选项（值 + 展示标签，可选自定义渲染）。 */
export interface FacetOption {
  value: string;
  label: string;
  /** 自定义选项渲染（如带颜色的 Badge）。 */
  render?: () => ReactNode;
}
