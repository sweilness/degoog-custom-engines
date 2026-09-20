# Custom degoog engine: Tavily

Ready-to-push store repository for degoog (https://github.com/degoog-org/degoog).

## Structure
- `package.json` — store manifest (what Settings → Store reads; includes the repo image)
- `engines/tavily/index.js` — Tavily engine (POST api.tavily.com/search, Bearer key)
- `engines/tavily/author.json` — author info
- `engines/tavily/screenshots/` — engine images shown in the Store gallery
- `assets/repo-image.png` — repository image

## Install
1. degoog → Settings → Store → Add repository → paste this repo's URL.
2. Install Tavily, enable it in the Engines tab, then Configure → paste API key.
3. Bang `!tavily` works out of the box.

## Notes
- Tavily has no pagination: result pages beyond 1 repeat page 1. The time filter maps
  onto Tavily's `time_range` (day/week/month/year).
- Maps cleanly to degoog's engine contract; Brave API Search
  (official-extensions/engines/brave-api-search) was used as the reference pattern.
