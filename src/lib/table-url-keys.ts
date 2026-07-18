import type { QueryKeys } from "@/components/tablecn/types/data-table";

/** Sanitize storageKey / queryKey into a safe URL namespace segment. */
export function sanitizeTableUrlNamespace(raw: string): string {
  return raw
    .replace(/[:/]/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Derive nuqs keys for a table namespace. Empty namespace → global keys (page, sort, q). */
export function deriveTableUrlKeys(namespace?: string): QueryKeys & {
  q: string;
  status: string;
  scope: string;
} {
  const ns = namespace?.trim();
  const prefix = ns ? `${ns}_` : "";
  return {
    page: `${prefix}page`,
    perPage: `${prefix}perPage`,
    sort: `${prefix}sort`,
    filters: `${prefix}filters`,
    joinOperator: `${prefix}joinOperator`,
    q: ns ? `${ns}_q` : "q",
    status: `${prefix}status`,
    scope: `${prefix}scope`,
  };
}

/** Build namespace from queryKey + optional extraKey segments. */
export function namespaceFromQueryKey(
  queryKey: string,
  extraKey: readonly unknown[] = [],
): string {
  const parts = [queryKey, ...extraKey.filter((x) => x != null && x !== "")].map(String);
  return sanitizeTableUrlNamespace(parts.join("-"));
}
