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
- Both APIs are single-page: no offset/limit params, so result pages beyond 1 repeat page 1.
- Jina response shape (`data[].title/url/description/content`) should be sanity-checked
  against current docs at https://jina.ai/docs — their API surface moves occasionally.
- Both map cleanly to degoog's engine contract; Brave API Search
  (official-extensions/engines/brave-api-search) was used as the reference pattern.
