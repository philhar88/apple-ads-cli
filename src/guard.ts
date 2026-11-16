import { refused } from "./errors.js";

export interface Target {
  type: string;
  id?: string;
  campaignId?: string;
}

export interface GuardSettings {
  protectedCampaignIds: string[];
  allowPauseProtected: boolean;
}

/**
 * Refuses (exit 6) any write whose target is a protected campaign or sits under one.
 * `reduceOnly` writes (pause, negatives add) pass only when allowPauseProtected is true.
 */
export function assertNotProtected(targets: Target[], g: GuardSettings, reduceOnly: boolean): void {
  if (!g.protectedCampaignIds.length) return;
  const set = new Set(g.protectedCampaignIds.map(String));
  const hits = targets.filter((t) => (t.campaignId && set.has(String(t.campaignId))) || (t.type === "campaign" && t.id && set.has(String(t.id))));
  if (!hits.length) return;
  if (reduceOnly && g.allowPauseProtected) return;
  const which = [...new Set(hits.map((t) => t.campaignId ?? t.id))].join(", ");
  throw refused(
    "PROTECTED",
    `Campaign ${which} is protected in this profile; the write was not sent`,
    "ask the user; protectedCampaignIds is set in the CLI config and only the owner should change it",
  );
}

/** For the raw `api` command: finds protected IDs in the path or anywhere in the body. */
export function scanForProtected(path: string, body: unknown, ids: string[]): string[] {
  if (!ids.length) return [];
  const set = new Set(ids.map(String));
  const found = new Set<string>();
  for (const seg of path.split(/[/?&=,]/)) if (set.has(seg)) found.add(seg);
  const walk = (v: unknown): void => {
    if (v === null || v === undefined) return;
    if (typeof v === "string" || typeof v === "number") {
      if (set.has(String(v))) found.add(String(v));
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v as object).forEach(walk);
  };
  walk(body);
  return [...found];
}
