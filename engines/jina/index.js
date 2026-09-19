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
  ];
  apiKey = "";
  configure(settings) {
    this.apiKey = settings.apiKey || "";
  }
  async executeSearch(query, page = 1, timeFilter, context) {
    if (!this.apiKey) return [];
    const doFetch = context?.fetch ?? fetch;
    // s.jina.ai has no pagination or time filters; page/timeFilter are ignored.
    const url = `${API_URL}?q=${encodeURIComponent(query)}`;
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
