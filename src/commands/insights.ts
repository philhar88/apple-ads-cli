import type { Command } from "commander";
import { act, type Deps } from "../context.js";
import { PAGE_MAX_ENTITY, PAGE_MAX_REPORT } from "../constants.js";
import { usageError } from "../errors.js";
import { filter, paginate, parseFilterFlag, parseSort, type Filter, type Pagination } from "../query.js";
import { addDays, dateIn, daysBetweenInclusive, resolveRange } from "../time.js";
import { addListFlags, doc, extraFilters, idArg, listOpts, truncationNote } from "./shared.js";

const collect = (v: string, prev: string[] = []) => [...prev, ...v.split(",").map((s) => s.trim()).filter(Boolean)];

export function buildImpressionShareBody(o: any, todayUtc: string): Record<string, unknown> {
  const granularity = (o.granularity ?? "DAILY").toUpperCase();
  if (granularity !== "DAILY" && granularity !== "WEEKLY_SUN_SAT") throw usageError("--granularity must be DAILY or WEEKLY_SUN_SAT");
  const { start, end } = resolveRange({ last: o.last, start: o.start, end: o.end }, todayUtc);
  const span = daysBetweenInclusive(start, end);
  if (granularity === "DAILY" && span > 30) throw usageError(`impression share DAILY allows 30 days at most (got ${span})`);
  if (granularity === "WEEKLY_SUN_SAT") {
    if (span > 28) throw usageError(`impression share WEEKLY_SUN_SAT allows 4 weeks at most (got ${span} days)`);
    if (new Date(`${start}T00:00:00Z`).getUTCDay() !== 0) throw usageError("WEEKLY_SUN_SAT ranges must start on a Sunday");
  }
  const slots = (o.slots ?? "first").toLowerCase();
  if (slots !== "first" && slots !== "all") throw usageError("--slots must be first or all");
  // promotedObjectId only accepts IN.
  const filters: Filter[] = [filter("promotedObjectId", "IN", [String(o.adamId)])];
  if (o.country?.length) filters.push(filter("countryOrRegion", "IN", o.country.map((c: string) => c.toUpperCase())));
  filters.push(...extraFilters(o));
  const body: Record<string, unknown> = {
    filters,
    options: { impressionShareReportType: slots === "first" ? "FIRST_SLOT" : "ALL_SLOTS" },
    timeRange: { start, end, timeZone: "UTC", granularity },
  };
  if (o.sort?.length) body.sorting = o.sort.map(parseSort);
  return body;
}

export function registerInsights(program: Command, deps: Deps): void {
  const g = program.command("insights").description("Impression share and keyword suggestions (read-only)");

  const is = addListFlags(g.command("impression-share").description("Impression share by search term (UTC)"), "report")
    .requiredOption("--adam-id <id>", "App Store app ID", idArg("--adam-id"))
    .option("--country <codes>", "country or region codes (repeatable or comma-separated)", collect)
    .option("--granularity <g>", "DAILY (default, up to 30 days) or WEEKLY_SUN_SAT (up to 4 weeks from a Sunday)")
    .option("--last <Nd>", "N full UTC days before today (default 7d)")
    .option("--start <date>", "YYYY-MM-DD (with --end)")
    .option("--end <date>", "YYYY-MM-DD")
    .option("--slots <first|all>", "first slot (default) or all slots")
    .action(
      act(deps, async (ctx, o) => {
        const body = buildImpressionShareBody(o, dateIn("UTC", ctx.deps.now()));
        const page = await paginate(ctx.client, { path: "/insights/apps/impression-share/query", body, pageMax: PAGE_MAX_REPORT, rows: (j) => j?.result?.rows ?? [], ...listOpts(o, "report") });
        ctx.out.emit({ result: { rows: page.rows }, pagination: page.pagination, cli: { timeZone: "UTC", timeRange: body.timeRange } });
        truncationNote(ctx, page.pagination);
      }),
    );
  doc(is, { endpoint: "POST /v1/insights/apps/impression-share/query", schema: "ImpressionShareQueryRequest", examples: ["apple-ads-cli insights impression-share --adam-id 1234567890 --country US --last 14d"] });

  const ks = addListFlags(g.command("keyword-suggestions").description("Keyword ideas for an app"), "entity")
    .requiredOption("--adam-id <id>", "App Store app ID", idArg("--adam-id"))
    .option("--term <text>", "seed terms (repeatable or comma-separated)", collect)
    .option("--country <codes>", "country or region codes (repeatable or comma-separated)", collect)
    .action(
      act(deps, async (ctx, o) => {
        const f: Filter[] = [filter("promotedObjectId", "EQUALS", [String(o.adamId)]), filter("promotedObjectType", "EQUALS", ["APPSTORE_APP"])];
        if (o.term?.length) f.push(filter("terms", "IN", o.term));
        if (o.country?.length) f.push(filter("countriesOrRegions", "IN", o.country.map((c: string) => c.toUpperCase())));
        f.push(...(o.filter ?? []).map(parseFilterFlag));
        const page = await paginate(ctx.client, { path: "/suggestions/keywords/query", body: { filters: f }, pageMax: PAGE_MAX_ENTITY, ...listOpts(o, "entity") });
        ctx.out.emit({ result: page.rows, pagination: page.pagination }, [
          { header: "text", path: "text" },
          { header: "popularity", path: "popularity" },
        ]);
        truncationNote(ctx, page.pagination);
      }),
    );
  doc(ks, { endpoint: "POST /v1/suggestions/keywords/query", schema: "RecommendationQueryRequest", examples: ["apple-ads-cli insights keyword-suggestions --adam-id 1234567890 --country US"] });
}

export const DEFAULT_ENTITY_TYPES = ["Campaign", "AdGroup", "Keyword", "NegativeKeyword", "Ad", "Creative"];

export function registerHistory(program: Command, deps: Deps): void {
  const g = program.command("history").description("Change history (who changed what, up to 6 months back)");
  const list = addListFlags(g.command("list").description("List changes"), "report")
    .option("--since <Nd>", "changes in the last N days (default 7d, at most 180d)")
    .option("--start <date>", "UTC date YYYY-MM-DD (with --end)")
    .option("--end <date>", "UTC date YYYY-MM-DD")
    .option("--campaign-id <id>", "only this campaign", idArg("--campaign-id"))
    .option("--ad-group-id <id>", "only this ad group", idArg("--ad-group-id"))
    .option("--entity-type <type>", "Campaign, AdGroup, Keyword, NegativeKeyword, Ad, Creative (repeatable; default all six)", collect)
    .option("--event-type <type>", "CREATE, UPDATE or DELETE (repeatable)", collect)
    .action(
      act(deps, async (ctx, o) => {
        const today = dateIn("UTC", ctx.deps.now());
        let start: string;
        let end: string;
        if (o.start || o.end) {
          if (!o.start || !o.end) throw usageError("--start and --end go together");
          ({ start, end } = resolveRange({ start: o.start, end: o.end }, today));
        } else {
          const m = /^(\d{1,3})d$/.exec(o.since ?? "7d");
          if (!m) throw usageError("--since takes Nd, for example 7d");
          start = addDays(today, -Number(m[1]));
          end = addDays(today, 1);
        }
        if (daysBetweenInclusive(start, today) > 184) throw usageError("history reaches back 6 months at most");
        const types: string[] = o.entityType?.length ? o.entityType : DEFAULT_ENTITY_TYPES;
        const common: Filter[] = [filter("eventTime", "BETWEEN", [start, end])];
        if (o.eventType?.length) common.push(filter("eventType", "IN", o.eventType.map((x: string) => x.toUpperCase())));
        common.push(...extraFilters(o));
        // campaignId is only filterable on child entity types; the campaign itself is matched by entityId.
        const queries: Filter[][] = [];
        if (o.adGroupId) {
          const t = types.filter((x) => x === "Keyword" || x === "NegativeKeyword");
          if (t.length) queries.push([...common, filter("entityType", "IN", t), filter("adGroupId", "EQUALS", [o.adGroupId])]);
          if (types.includes("AdGroup")) queries.push([...common, filter("entityType", "IN", ["AdGroup"]), filter("entityId", "EQUALS", [o.adGroupId])]);
        } else if (o.campaignId) {
          const t = types.filter((x) => ["AdGroup", "Keyword", "NegativeKeyword"].includes(x));
          if (t.length) queries.push([...common, filter("entityType", "IN", t), filter("campaignId", "EQUALS", [o.campaignId])]);
          if (types.includes("Campaign")) queries.push([...common, filter("entityType", "IN", ["Campaign"]), filter("entityId", "EQUALS", [o.campaignId])]);
        } else {
          queries.push([...common, filter("entityType", "IN", types)]);
        }
        if (!queries.length) throw usageError("No entity types left to query", "with --campaign-id use Campaign, AdGroup, Keyword or NegativeKeyword");
        const rows: any[] = [];
        let truncated = false;
        let totalCount = 0;
        let single: Pagination | undefined;
        for (const filters of queries) {
          const body: Record<string, unknown> = { filters, options: { metadata: "latest" } };
          if (o.sort?.length) body.sorting = o.sort.map(parseSort);
          const page = await paginate(ctx.client, { path: "/change-history/query", body, pageMax: PAGE_MAX_ENTITY, ...listOpts(o, "entity") });
          rows.push(...page.rows);
          truncated ||= page.pagination.truncated;
          totalCount += page.pagination.totalCount ?? page.rows.length;
          single = page.pagination;
        }
        if (queries.length > 1) rows.sort((a, b) => String(b.eventTime).localeCompare(String(a.eventTime)));
        const page = { rows, pagination: queries.length === 1 && single ? single : { offset: o.offset ?? 0, returned: rows.length, totalCount, truncated } };
        ctx.out.emit({ result: page.rows, pagination: page.pagination, cli: { eventTime: { from: start, to: end }, timeZone: "UTC", entityTypes: types } }, [
          { header: "eventTime", path: "eventTime" },
          { header: "eventType", path: "eventType" },
          { header: "entityType", path: "entityType" },
          { header: "userType", path: "userType" },
          { header: "count", path: "count" },
        ]);
        truncationNote(ctx, page.pagination);
      }),
    );
  doc(list, {
    endpoint: "POST /v1/change-history/query",
    schema: "AuditQuery",
    examples: ["apple-ads-cli history list --since 7d --campaign-id 111111111"],
    notes: ["use it before re-tuning: the playbook waits 7 days between changes to the same item", "with --campaign-id, ad and creative changes are not included (Apple filters them by entityId only)"],
  });

  doc(
    g
      .command("get")
      .description("Field-level details of one change")
      .argument("<detailId>", "EntityType.entityId.txnId from history list")
      .option("--limit <n>", "maximum rows", (v) => Number(v), 100)
      .option("--offset <n>", "start at this row", (v) => Number(v), 0)
      .action(
        act(deps, async (ctx, o, [id]) => {
          const r = await ctx.client.request({ method: "GET", path: `/change-history/${encodeURIComponent(id!)}`, query: { limit: o.limit, offset: o.offset } });
          ctx.out.emit({ result: r.json?.result ?? null, ...(r.json?.pagination ? { pagination: r.json.pagination } : {}) });
        }),
      ),
    { endpoint: "GET /v1/change-history/{detailId}", examples: ["apple-ads-cli history get Campaign.111111111.TXN_ID"] },
  );
}
