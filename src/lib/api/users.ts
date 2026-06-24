import { api } from "@/lib/api/client";

// 与后端 userDTO 对齐（绝不含 password_hash）。
export interface User {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

// 用户某币种余额；金额为十进制字符串（不经 float）。
export interface Balance {
  currency: string;
  balance: string;
  reserved_balance: string;
}

// 用户详情：基础信息 + 各币种余额。
export interface UserDetail extends User {
  balances: Balance[];
}

export async function getUser(id: number): Promise<UserDetail> {
  const res = await api.get<{ data: UserDetail }>(`/admin/v1/users/${id}`);
  return res.data.data;
}

export type AdjustDirection = "credit" | "debit";

// 手工调额结果（一条 adjustment_* 账本流水）。
export interface Adjustment {
  entry_id: number;
  user_id: number;
  entry_type: string;
  amount: string;
  currency: string;
  balance_after: string;
  reason: string;
}

export interface CreateAdjustmentInput {
  userId: number;
  direction: AdjustDirection;
  amount: string;
  currency: string;
  reason: string;
  // 幂等键：同一次提交带上可保证重试不重复入账。
  idempotencyKey?: string;
}

export async function createAdjustment(
  input: CreateAdjustmentInput,
): Promise<Adjustment> {
  const res = await api.post<{ data: Adjustment }>(
    `/admin/v1/users/${input.userId}/balance-adjustments`,
    {
      direction: input.direction,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      idempotency_key: input.idempotencyKey || undefined,
    },
  );
  return res.data.data;
}
