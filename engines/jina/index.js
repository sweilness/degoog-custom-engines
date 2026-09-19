const API_URL = "https://s.jina.ai/";

export default class JinaSearchEngine {
  isClientExposed = false;
  name = "Jina Search";
  bangShortcut = "jina";
  settingsSchema = [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      secret: true,
      required: true,
      placeholder: "jina_...",
      description: "Get a free key at https://jina.ai",
    },
    {
      key: "maxResults",
      label: "Max results",
      type: "number",
      default: "10",
      description: "Number of results to request (1-20).",
    },
  ];
  apiKey = "";
  maxResults = 10;
  configure(settings) {
    this.apiKey = settings.apiKey || "";
    const n = parseInt(settings.maxResults || "10", 10);
    this.maxResults = Math.min(Math.max(Number.isNaN(n) ? 10 : n, 1), 20);
  }
  async executeSearch(query, page = 1, timeFilter, context) {
    if (!this.apiKey) return [];
    const doFetch = context?.fetch ?? fetch;
    // s.jina.ai search accepts num (result count) and hl (language); it has no
    // documented time filter, and page support for search is unclear, so both
    // page and timeFilter are ignored.
    const params = new URLSearchParams({ q: query });
    if (this.maxResults) params.set("num", String(this.maxResults));
    if (context?.lang) params.set("hl", context.lang);
    const url = `${API_URL}?${params}`;
    try {
      const response = await doFetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      context?.sentinel?.(response, this.name);
      const data = await response.json();
      return (data?.data ?? []).map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: (item.description || item.content || "").slice(0, 300),
        source: this.name,
      }));
    } catch (e) {
      if (e?.name === "SentinelBreach") throw e;
      return [];
    }
  }
}
