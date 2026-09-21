# Custom degoog engines: Tavily + Jina + Exa + SearXNG Multi

Ready-to-push store repository for degoog (https://github.com/degoog-org/degoog).

## Structure
- `package.json` — store manifest (what Settings → Store reads; includes the repo image)
- `engines/tavily/index.js` — Tavily engine (POST api.tavily.com/search, Bearer key)
- `engines/tavily/author.json` — author info
- `engines/tavily/screenshots/` — engine images shown in the Store gallery
- `engines/jina/index.js` — Jina engine (GET s.jina.ai/?q=, Bearer key)
- `engines/jina/author.json` — author info
- `engines/jina/screenshots/` — engine images shown in the Store gallery
- `engines/exa/index.js` — Exa engine (POST api.exa.ai/search, x-api-key header)
- `engines/exa/author.json` — author info
- `engines/exa/screenshots/` — engine images shown in the Store gallery
- `engines/searxng-multi/index.js` — SearXNG engine with multi-instance failover (GET /search, format=json)
- `engines/searxng-multi/author.json` — author info
- `engines/searxng-multi/screenshots/` — engine images shown in the Store gallery
- `assets/repo-image.png` — repository image

## Install
1. degoog → Settings → Store → Add repository → paste this repo's URL.
2. Install Tavily, Jina, Exa and/or SearXNG Multi, enable them in the Engines tab, then Configure → paste API keys (SearXNG Multi takes instance URLs instead).
3. Bangs `!tavily`, `!jina`, `!exa` and `!searxng` work out of the box.

## Notes
- Tavily has no pagination: result pages beyond 1 repeat page 1. The time filter maps
  onto Tavily's `time_range` (day/week/month/year).
- Tavily's `content` field has no length control in their API, so the engine truncates
  it — set **Max snippet length** in the engine settings (default 200 chars, 0 = full).
- Jina's s.jina.ai requires an API key and has no documented pagination or time filter;
  the engine sends `num` (result count) and `hl` (language) instead.
- Exa has no offset pagination on /search; the time filter maps onto `startPublishedDate`
  (ISO 8601). Free tier adds $10 in credits monthly (~1,400 plain searches at $7/1k);
  AI page summaries are deliberately not requested since Exa bills them separately.
- Tavily and Exa have a Safe Search dropdown (Tavily `safe_search`, Exa `moderation`);
  Jina's s.jina.ai has no documented equivalent. All entries require degoog 0.19.0+.
- SearXNG Multi tries your instance list in order and uses the first healthy one:
  network errors, non-OK statuses and bad JSON all trigger failover to the next
  instance. If every instance fails, the engine reports blocked instead of returning
  nothing. Unlike the other engines it supports real pagination (`pageno`). JSON
  output must be enabled on each instance (`search.formats` in settings.yml) — many
  public instances disable it, so self-hosted instances work best. No API key needed.
- Each SearXNG instance gets its own timeout (default 3s) before failover moves on —
  set **Instance timeout** so a hanging instance can't eat degoog's whole per-engine
  budget (default 10s; raise it in the engine's Advanced settings if you run many
  instances). If every instance times out, the engine reports a timeout error
  instead of returning nothing.
- Maps cleanly to degoog's engine contract; Brave API Search
  (official-extensions/engines/brave-api-search) was used as the reference pattern.
