import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";

// 与后端 projectDTO 对齐。项目即工作空间：仅作归类，不承载任何限额/策略。
export interface Project {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListParams {
  page: number;
  pageSize: number;
  // 按所属用户过滤；缺省列全部。
  userId?: number;
}

export async function listProjects(
  params: ProjectListParams,
): Promise<Page<Project>> {
  const res = await api.get<{ data: Project[]; meta: ListMeta }>(
    "/admin/v1/projects",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        user_id: params.userId || undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getProject(id: number): Promise<Project> {
  const res = await api.get<{ data: Project }>(`/admin/v1/projects/${id}`);
  return res.data.data;
}
