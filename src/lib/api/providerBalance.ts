import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";

export type ProviderAdjustmentDirection = "credit" | "debit";

export interface ProviderBalanceAdjustment {
  entry_id: number;
  provider_id: number;
  entry_type: string;
  amount: string;
  currency: string;
  balance_after: string;
  reason: string;
}

export interface ProviderLedgerEntry {
  id: number;
  provider_id: number;
  request_record_id: number | null;
  request_attempt_id: number | null;
  cost_snapshot_id: number | null;
  channel_id: number | null;
  request_id: string | null;
  channel_name: string | null;
  upstream_model: string | null;
  provider_probe_record_id: number | null;
  entry_type: "usage_debit" | "probe_debit" | "adjustment_credit" | "adjustment_debit";
  amount: string;
  currency: string;
  balance_before: string;
  balance_after: string;
  idempotency_key: string;
  reason: string;
  created_at: string;
}

export interface ProviderCostRisk {
  id: number;
  provider_id: number;
  request_record_id: number | null;
  request_attempt_id: number | null;
  provider_probe_record_id: number | null;
  source_type: "request" | "probe";
  estimated_amount: string | null;
  currency: string | null;
  reason_code: string;
  reason: string;
  status: "unresolved" | "reconciled";
  reconciliation_ledger_entry_id: number | null;
  request_id: string | null;
  upstream_model: string | null;
  channel_name: string | null;
  created_at: string;
  reconciled_at: string | null;
}

export interface ProviderCostRiskSummary {
  unresolved_count: number;
  estimated_amount_usd: string;
  unknown_amount_count: number;
}

export async function adjustProviderBalance(input: {
  providerId: number;
  targetBalance: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<ProviderBalanceAdjustment> {
  const res = await api.post<{ data: ProviderBalanceAdjustment }>(
    `/admin/v1/providers/${input.providerId}/balance-adjustments`,
    {
      target_balance: input.targetBalance,
      currency: "USD",
      reason: input.reason,
      idempotency_key: input.idempotencyKey || undefined,
    },
  );
  return res.data.data;
}

export async function getProviderLedgerEntries(
  providerId: number,
  params: {
    page: number;
    page_size: number;
    entry_type?: string;
    request_id?: string;
    from?: string;
    to?: string;
  },
): Promise<Page<ProviderLedgerEntry>> {
  const res = await api.get<{ data: ProviderLedgerEntry[]; meta: ListMeta }>(
    `/admin/v1/providers/${providerId}/ledger-entries`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getProviderCostRisks(
  providerId: number,
  params: { page: number; page_size: number; status?: string },
): Promise<Page<ProviderCostRisk>> {
  const res = await api.get<{ data: ProviderCostRisk[]; meta: ListMeta }>(
    `/admin/v1/providers/${providerId}/cost-risks`,
    { params },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export async function getProviderCostRiskSummary(providerId: number): Promise<ProviderCostRiskSummary> {
  const res = await api.get<{ data: ProviderCostRiskSummary }>(
    `/admin/v1/providers/${providerId}/cost-risks/summary`,
  );
  return res.data.data;
}
