import type { ProtocolScope } from "@/lib/api/capability";

export const PROTOCOL_SCOPE_ORDER: ProtocolScope[] = [
  "shared",
  "openai",
  "anthropic",
];

export type ProtocolScopeFilter = "all" | ProtocolScope;

const PROTOCOL_SCOPE_LABEL: Record<ProtocolScope, string> = {
  shared: "通用",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/** 协议归属样式：黑白灰，仅用字重/边框深浅区分，不用彩色。 */
const PROTOCOL_SCOPE_STYLES: Record<
  ProtocolScope,
  {
    badge: string;
    groupHeader: string;
    sectionBar: string;
    filterActive: string;
    filterIdle: string;
  }
> = {
  shared: {
    badge: "border-border bg-muted text-foreground",
    groupHeader: "bg-muted/80 text-foreground font-medium",
    sectionBar: "border-l-2 border-foreground/20 bg-muted/20",
    filterActive: "",
    filterIdle: "",
  },
  openai: {
    badge: "border-border bg-muted text-foreground",
    groupHeader: "bg-muted/80 text-foreground font-medium",
    sectionBar: "border-l-2 border-foreground/20 bg-muted/20",
    filterActive: "",
    filterIdle: "",
  },
  anthropic: {
    badge: "border-border bg-muted text-foreground",
    groupHeader: "bg-muted/80 text-foreground font-medium",
    sectionBar: "border-l-2 border-foreground/20 bg-muted/20",
    filterActive: "",
    filterIdle: "",
  },
};

export function protocolScopeStyles(scope: ProtocolScope | "both") {
  return PROTOCOL_SCOPE_STYLES[normalizeProtocolScope(scope)];
}

/** DB/API 取值 shared；兼容历史 both。 */
export function normalizeProtocolScope(
  scope: ProtocolScope | "both" | undefined | null,
): ProtocolScope {
  if (scope === "openai" || scope === "anthropic") return scope;
  if (scope === "shared" || scope === "both") return "shared";
  return "shared";
}

export function protocolScopeLabel(scope: ProtocolScope): string {
  return PROTOCOL_SCOPE_LABEL[scope];
}

export function groupKeysByProtocolScope<T extends { protocol_scope: ProtocolScope | "both" }>(
  keys: T[],
): Array<[ProtocolScope, T[]]> {
  const buckets = new Map<ProtocolScope, T[]>();
  for (const scope of PROTOCOL_SCOPE_ORDER) {
    buckets.set(scope, []);
  }
  for (const def of keys) {
    const scope = normalizeProtocolScope(def.protocol_scope);
    buckets.get(scope)?.push(def);
  }
  const out: Array<[ProtocolScope, T[]]> = [];
  for (const scope of PROTOCOL_SCOPE_ORDER) {
    const defs = buckets.get(scope)!;
    if (defs.length > 0) {
      out.push([scope, defs]);
    }
  }
  return out;
}

export function filterKeysByProtocolScope<T extends { protocol_scope: ProtocolScope | "both" }>(
  keys: T[],
  filter: ProtocolScopeFilter,
): T[] {
  if (filter === "all") return keys;
  return keys.filter((k) => normalizeProtocolScope(k.protocol_scope) === filter);
}

export function groupKeysByDomain<T extends { domain: string }>(
  keys: T[],
): [string, T[]][] {
  const byDomain = new Map<string, T[]>();
  for (const def of keys) {
    const list = byDomain.get(def.domain) ?? [];
    list.push(def);
    byDomain.set(def.domain, list);
  }
  return [...byDomain.entries()];
}
