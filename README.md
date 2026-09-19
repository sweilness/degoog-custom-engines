# Custom degoog engines: Tavily + Jina

Ready-to-push store repository for degoog (https://github.com/degoog-org/degoog).

## Structure
- `package.json` — store manifest (what Settings → Store reads)
- `engines/tavily/index.js` — Tavily engine (POST api.tavily.com/search, Bearer key)
- `engines/jina/index.js` — Jina engine (GET s.jina.ai/?q=, Bearer key)
- `author.json` in each engine folder — edit name/url before publishing

## Install
1. Push this folder to a git repo (e.g. github.com/you/degoog-custom-engines).
2. degoog → Settings → Store → Add repository → paste the git URL.
3. Install both engines, enable them in the Engines tab, then Configure → paste API keys.
4. Bangs `!tavily` and `!jina` work out of the box.

## Notes
- Tavily has no pagination: result pages beyond 1 repeat page 1. Jina search accepts
  `num` (result count) and `hl` (language) — both are used by the engine — but its `page`
  param is undocumented for search, so pagination is not attempted.
- Jina response shape (`data[].title/url/description/content`) verified against the
  s.jina.ai OpenAPI spec (2026-09).
- Both map cleanly to degoog's engine contract; Brave API Search
  (official-extensions/engines/brave-api-search) was used as the reference pattern.
