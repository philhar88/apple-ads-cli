# Account management playbook

Read this for a weekly review, for optimisation, or when the user asks what to change. Sources are Apple's best-practice pages, plus practitioner rules of thumb marked as such. Make no write until the user approves each item or batch.

## Contents

- Structure
- Match types and Search Match
- Negative keywords
- Bids
- Budget and pacing
- Custom product pages
- Policy
- Weekly review (10 steps)

## Structure

- Apple recommends one keyword theme per campaign: Brand (your app or company name), Category (what the app does), Competitor (similar apps) and Discovery (finding new terms).
- Discovery has two ad groups: broad match keywords with Search Match off, and no keywords with Search Match on.
- Add every Brand, Category and Competitor keyword to Discovery as an exact negative, so the campaigns do not compete.
- A small app can start with one exact-match campaign plus one discovery campaign.
- Split by country only for large markets that need their own budget.

## Match types and Search Match

- Exact match gives clear intent and less reach. Use it in Brand, Category and Competitor campaigns, with Search Match off.
- Broad match and Search Match find new terms. Keep them in Discovery.
- Move a search term that converts into a core campaign as an exact keyword, and add it to Discovery as an exact negative.

## Negative keywords

- Prefer exact negatives, so related searches still show the ad. Use broad negatives only for words you never want, such as "login" or "customer service" for an app that is neither, and check them against converting terms first.
- Add a term as a negative when it gets taps but no installs, or when it is irrelevant.
- Negatives reduce reach. They cannot increase spend.

## Bids

- The max CPT bid is a ceiling. The actual cost is often lower.
- A keyword bid overrides the ad group's default bid.
- Bid changes can take about a day to take effect.
- Change one variable at a time, by 15% or less per step, and judge over 1-2 weeks (practitioner rule). A 20% cut needs a 25% rise to undo.
- Raise the bid on keywords that convert below the target CPA, especially when impressions are few.
- Lower the bid on keywords with taps but a CPA above target. Try a bid cut before pausing.

## Budget and pacing

- The daily budget is an average, not a daily cap. A single day can exceed it.
- Monthly spend can reach the daily budget × 30.4. With an end date, total spend can reach days × daily budget. The CLI shows both under `cli.budget` and `spend.ceilings`.
- Budget changes usually apply the same day. Cutting the budget below what has already been spent today stops serving until the next day.
- Give every test campaign an end date.
- Scale only when CPA has been at or under target for a full week and the budget runs out early: propose +10-20%.

## Custom product pages

- Use one custom product page per ad group theme. The page must be approved and VISIBLE before an ad can use it (`product-pages list --adam-id APP_ID --state VISIBLE`).
- A creative links the page; an ad places the creative in an ad group.

## Policy

- No Apple logos or marks, and no "Apple Approved" wording, in ad assets.
- No competitor names or unlicensed marks in ad assets. Bidding on a competitor's name as a keyword is allowed.

## Weekly review (10 steps)

1. **Snapshot** (read only): `campaigns list`, `ad-groups list --campaign-id ID`, `ads list --campaign-id ID`. Flag anything whose `displayStatus` is not RUNNING, with its `systemStatusReasons`. Note the daily budget, end date and `cli.budget.daysLeft`.
2. **Performance:** `reports campaigns --last 7d`, then `--last 28d`, and the same for `reports ad-groups` and `reports keywords` per campaign. Compare the last 7 days with the 7 before (`--start`/`--end`). Treat the last 1-2 days as provisional.
3. **Spend check:** compare spend with daily budget × days. Under 70% of budget suggests low bids, low relevance or low demand. Overspend on single days is normal.
4. **Search terms:** `reports search-terms --campaign-id ID --last 28d`. Propose relevant converters not yet keywords as exact keywords (plus an exact negative in Discovery). Propose irrelevant terms, or terms with 15 or more taps and no installs, as exact negatives.
5. **Keywords** (28-day totals; ignore keywords under about 10 taps):
   - CPA under target and impression share under 90%: propose +10-15% bid.
   - CPA more than 10% above target for a week: propose -15% bid.
   - 30 or more taps and no installs, or spend over about 3× target CPA with no installs: propose a pause, after a bid cut has been tried, unless the term is clearly irrelevant.
   - Impressions but almost no taps: a relevance or creative problem, not a bid problem.
   - Check `history list --since 7d` first, and do not re-tune an item changed in the last 7 days.
6. **Budget:** see Budget and pacing. Never lower the budget below what has already been spent today.
7. **Structure:** core campaigns exact only with Search Match off; Discovery has its two ad groups and the core keywords as exact negatives; each product page matches its ad group's theme.
8. **Policy:** see Policy.
9. **Report** to the user: a findings table, then a numbered list of proposed changes, each with the object, current value, proposed value, reason and data window.
10. **Apply** only what the user approves: `--dry-run`, show the plan and `spend`, then `--confirm`, then report `after`. One variable at a time, at most 15% per step.
