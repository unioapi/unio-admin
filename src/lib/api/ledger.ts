import { api } from "@/lib/api/client";
import type { ListMeta, Page } from "@/lib/api/types";

// 与后端 ledgerEntryDTO 对齐；金额是十进制字符串（不经 float）。
export interface LedgerEntry {
  id: number;
  user_id: number;
  request_record_id: number | null;
  entry_type: string;
  amount: string;
  currency: string;
  balance_before: string;
  balance_after: string;
  idempotency_key: string;
  reason: string;
  created_at: string;
}

// 与后端 billingExceptionDTO 对齐；金额是十进制字符串。
export interface BillingException {
  id: number;
  user_id: number;
  request_record_id: number;
  reservation_id: number;
  event_type: string;
  actual_amount: string | null;
  captured_amount: string;
  platform_amount: string;
  currency: string;
  reason_code: string;
  reason: string;
  created_at: string;
}

export interface LedgerEntryListParams {
  page: number;
  pageSize: number;
  userId?: number;
  entryType?: string;
  currency?: string;
  from?: string;
  to?: string;
}

export async function listLedgerEntries(
  params: LedgerEntryListParams,
): Promise<Page<LedgerEntry>> {
  const res = await api.get<{ data: LedgerEntry[]; meta: ListMeta }>(
    "/admin/v1/ledger/entries",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        user_id: params.userId || undefined,
        entry_type: params.entryType || undefined,
        currency: params.currency || undefined,
        from: params.from || undefined,
        to: params.to || undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}

export interface BillingExceptionListParams {
  page: number;
  pageSize: number;
  userId?: number;
  eventType?: string;
  from?: string;
  to?: string;
}

export async function listBillingExceptions(
  params: BillingExceptionListParams,
): Promise<Page<BillingException>> {
  const res = await api.get<{ data: BillingException[]; meta: ListMeta }>(
    "/admin/v1/ledger/billing-exceptions",
    {
      params: {
        page: params.page,
        page_size: params.pageSize,
        user_id: params.userId || undefined,
        event_type: params.eventType || undefined,
        from: params.from || undefined,
        to: params.to || undefined,
      },
    },
  );
  return { items: res.data.data, total: res.data.meta.total };
}
