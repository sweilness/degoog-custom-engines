# Custom degoog engines: Tavily + Jina + Exa

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
- `assets/repo-image.png` — repository image

## Install
1. degoog → Settings → Store → Add repository → paste this repo's URL.
2. Install Tavily, Jina and/or Exa, enable them in the Engines tab, then Configure → paste API keys.
3. Bangs `!tavily`, `!jina` and `!exa` work out of the box.

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
- Maps cleanly to degoog's engine contract; Brave API Search
  (official-extensions/engines/brave-api-search) was used as the reference pattern.
