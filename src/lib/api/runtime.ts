export type RuntimeSyncState =
  | "active"
  | "runtime_sync_pending"
  | "runtime_sync_required"
  | "stale"
  | "store_unavailable"
  | "runtime_state_lost";

export type BreakerState = "closed" | "open" | "half_open";

export type BreakerStoreAdmission = "normal" | "denied";
