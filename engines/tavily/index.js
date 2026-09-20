const API_URL = "https://api.tavily.com/search";

export default class TavilyEngine {
  isClientExposed = false;
  name = "Tavily";
  bangShortcut = "tavily";
  settingsSchema = [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      secret: true,
      required: true,
      placeholder: "tvly-...",
      description: "Get a free key at https://app.tavily.com",
    },
    {
      key: "maxResults",
      label: "Max results",
      type: "number",
      default: "10",
      description: "Between 1 and 20.",
    },
    {
      key: "searchDepth",
      label: "Search depth",
      type: "select",
      options: ["basic", "advanced"],
      default: "basic",
      description: "Advanced costs 2 credits per search.",
    },
    {
      key: "topic",
      label: "Topic",
      type: "select",
      options: ["general", "news"],
      default: "general",
    },
    {
      key: "snippetLength",
      label: "Max snippet length",
      type: "number",
      default: "200",
      description:
        "Characters kept from the page content shown under each result. 0 = keep Tavily's full text.",
    },
  ];
  apiKey = "";
  maxResults = 10;
  searchDepth = "basic";
  topic = "general";
  snippetLength = 200;
  configure(settings) {
    this.apiKey = settings.apiKey || "";
    const n = parseInt(settings.maxResults || "10", 10);
    this.maxResults = Math.min(Math.max(Number.isNaN(n) ? 10 : n, 1), 20);
    this.searchDepth = settings.searchDepth === "advanced" ? "advanced" : "basic";
    this.topic = settings.topic === "news" ? "news" : "general";
    const s = parseInt(settings.snippetLength ?? "200", 10);
    this.snippetLength = Number.isNaN(s) ? 200 : Math.max(0, s);
  }
  async executeSearch(query, page = 1, timeFilter, context) {
    if (!this.apiKey) return [];
    const doFetch = context?.fetch ?? fetch;
    // Tavily's API has no offset pagination; every page returns the same batch.
    const body = {
      query,
      max_results: this.maxResults,
      search_depth: this.searchDepth,
      topic: this.topic,
    };
    // Map degoog's time filter onto Tavily's time_range (day/week/month/year).
    // Note: the older "days" param is no longer part of Tavily's API schema.
    if (timeFilter && ["day", "week", "month", "year"].includes(timeFilter)) {
      body.time_range = timeFilter;
    }
    try {
      const response = await doFetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      context?.sentinel?.(response, this.name);
      const data = await response.json();
      const maxSnippet = this.snippetLength;
      return (data?.results ?? []).map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet:
          maxSnippet > 0 ? (item.content ?? "").slice(0, maxSnippet) : (item.content ?? ""),
        source: this.name,
      }));
    } catch (e) {
      if (e?.name === "SentinelBreach") throw e;
      return [];
    }
  }
}
