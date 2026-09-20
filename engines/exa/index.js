const API_URL = "https://api.exa.ai/search";

export default class ExaSearchEngine {
  isClientExposed = false;
  name = "Exa";
  bangShortcut = "exa";
  settingsSchema = [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      secret: true,
      required: true,
      placeholder: "...",
      description:
        "Get a key at https://exa.ai — free tier adds $10 in credits every month (plus $20 one-time on signup).",
    },
    {
      key: "safeSearch",
      label: "Safe Search",
      type: "select",
      options: ["off", "moderate", "strict"],
      default: "off",
      description: "Enable Exa content moderation to filter unsafe results.",
    },
    {
      key: "maxResults",
      label: "Max results",
      type: "number",
      default: "10",
      description: "Between 1 and 20. Base price covers up to 10 results; extras are billed.",
    },
    {
      key: "searchType",
      label: "Search type",
      type: "select",
      options: ["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"],
      default: "auto",
      description:
        "deep* modes are synthesized research ($12-15/1k requests) — pricier than plain search ($7/1k).",
    },
  ];
  apiKey = "";
  safeSearch = "off";
  maxResults = 10;
  searchType = "auto";
  configure(settings) {
    this.apiKey = settings.apiKey || "";
    this.safeSearch = ["off", "moderate", "strict"].includes(settings.safeSearch)
      ? settings.safeSearch
      : "off";
    const n = parseInt(settings.maxResults || "10", 10);
    this.maxResults = Math.min(Math.max(Number.isNaN(n) ? 10 : n, 1), 20);
    this.searchType = ["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"].includes(
      settings.searchType
    )
      ? settings.searchType
      : "auto";
  }
  async executeSearch(query, page = 1, timeFilter, context) {
    if (!this.apiKey) return [];
    const doFetch = context?.fetch ?? fetch;
    // Exa /search has no offset pagination; every page returns the same batch.
    const body = {
      query,
      numResults: this.maxResults,
      type: this.searchType,
      // Short text snippets for result rows. AI summaries are deliberately NOT
      // requested — Exa bills them separately ($1/1k pages).
      contents: { text: { maxCharacters: 300 } },
    };
    // Map degoog's time filter onto Exa's startPublishedDate (ISO 8601).
    const daysMap = { day: 1, week: 7, month: 30, year: 365 };
    if (timeFilter && daysMap[timeFilter]) {
      body.startPublishedDate = new Date(
        Date.now() - daysMap[timeFilter] * 86400000
      ).toISOString();
    }
    // Exa's moderation is a boolean; both moderate and strict enable it.
    if (this.safeSearch !== "off") {
      body.moderation = true;
    }
    try {
      const response = await doFetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      });
      context?.sentinel?.(response, this.name);
      const data = await response.json();
      return (data?.results ?? []).map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: (item.text || item.summary || "").slice(0, 300),
        source: this.name,
        thumbnail: item.image ?? "",
      }));
    } catch (e) {
      if (e?.name === "SentinelBreach") throw e;
      return [];
    }
  }
}
