# Changelog

## 2.0.0

A ground-up rewrite on the Apple Ads Platform API v1. Apple sunsets the Campaign Management API v5, which 1.x used, on 26 January 2027.

### Breaking changes

- Every command name and flag changed. Commands are now `<noun> <verb>`, for example `campaigns list` and `reports keywords`.
- 1.x credentials no longer work. Run `auth setup` with the API key's client ID, team ID, key ID and private key path. The CLI now signs its own client secret and refreshes the access token.
- The ad account ID replaces the org ID in the request context.
- Node.js 22 or later is required.
- Removed: `--format compact` (pipe the JSON instead) and `--credentials` (use `--config` or `--profile`).

### Added

- Writes: create, update, pause, resume and delete for campaigns, ad groups, ads and creatives; bulk add, update, pause, resume and delete for keywords and negative keywords. Every write supports `--dry-run`, needs `--confirm`, reports its spend effect and re-reads the result.
- Protected campaigns per profile (`protectedCampaignIds`): writes to them, or anything under them, are refused with exit 6.
- Reports for campaigns, ad groups, keywords, search terms and ads, with local checks for spans, granularity and time zone. Reports always send a sort order (the 1.x report commands failed without one).
- `apps`, `product-pages`, `geo`, `insights`, `history`, `schema` and a raw `api` command.
- Pagination on every list: `--limit`, `--all`, `--offset`, and a `truncated` flag in every result.
- Documented exit codes (0-6), JSON errors with hints, retries with backoff, and rate-limit pacing.
- `--output table`.
- A rewritten agent skill with reference files.
- Tests (`node:test`, no network).

### Migrating from 1.x

| 1.x | 2.0 |
|---|---|
| API v5, `https://api.searchads.apple.com/api/v5` | Platform API v1, `https://api.ads.apple.com/v1` |
| pre-made access token in `credentials.json` | `auth setup` with the key path; tokens refresh automatically |
| org ID | ad account ID |
| `acl` | `access` |
| `campaigns` | `campaigns list` |
| `campaign <id>` | `campaigns get <id>` |
| `adgroups <campaignId>` | `ad-groups list --campaign-id <id>` |
| `ads <campaignId> <adGroupId>` | `ads list --ad-group-id <id>` |
| `keywords <campaignId> <adGroupId>` | `keywords list --ad-group-id <id>` |
| `campaign-negative-keywords <campaignId>` | `negatives list --campaign-id <id> --campaign-level` |
| `negative-keywords <campaignId> <adGroupId>` | `negatives list --ad-group-id <id>` |
| `search-apps <query>` | `apps search --query <query>` |
| `app-eligibility <adamId>` | `apps eligibility <adamId>` |
| `app <adamId>` | `apps get <adamId>` |
| `budget-orders` / `budget-order <id>` | `budget-orders list` / `budget-orders get <id>` |
| `report <campaignId>` | `reports campaigns --campaign-id <id>` |
| `report-adgroups <campaignId>` | `reports ad-groups --campaign-id <id>` |
| `report-keywords <campaignId>` | `reports keywords --campaign-id <id>` |
| `--format compact` | removed |
| `--return-records-with-no-metrics` | `--include-empty` |
| `--credentials <file>` | `--config <file>` / `--profile <name>` |

The old `~/.config/apple-ads-cli/credentials.json` is not read. `auth status` and `auth doctor` warn when it exists; you can delete it after running `auth setup`. The same API key works for both APIs, and campaign IDs are unchanged.

## 1.0.4 and earlier

Read-only CLI on the Campaign Management API v5, by Benn Huang.
