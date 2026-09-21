const SAFESEARCH_MAP = { off: "0", moderate: "1", strict: "2" };
// SearXNG's time_range only knows day/month/year; hour collapses onto day,
// week and custom date ranges have no equivalent and are honestly omitted.
const TIME_RANGE_MAP = { hour: "day", day: "day", month: "month", year: "year" };

export default class SearxngMultiEngine {
  isClientExposed = false;
  name = "SearXNG Multi";
  bangShortcut = "searxng";

  settingsSchema = [
    {
      key: "instances",
      label: "Instances",
      type: "urllist",
      description:
        "SearXNG instances tried in order — the first healthy one wins. JSON output (format=json) must be enabled on each instance (search.formats in settings.yml).",
    },
    {
      key: "safeSearch",
      label: "Safe Search",
      type: "select",
      options: ["off", "moderate", "strict"],
      default: "off",
      description: "Maps onto SearXNG's safesearch parameter (0/1/2).",
    },
    {
      key: "maxResults",
      label: "Max results",
      type: "number",
      default: "20",
      description: "Results kept per search (1-50).",
    },
    {
      key: "instanceTimeout",
      label: "Instance timeout (ms)",
      type: "number",
      default: "3000",
      description:
        "Time each instance gets to answer before failover moves to the next one. Keep instances × this within degoog's per-engine timeout (Advanced settings, default 10s) — or raise that timeout.",
    },
    {
      key: "categories",
      label: "Categories",
      type: "text",
      default: "general",
      description:
        "SearXNG categories, comma-separated (e.g. general, images, videos, news, it, music, files).",
    },
  ];

  instances = [];
  safeSearch = "off";
  maxResults = 20;
  categories = "general";
  instanceTimeoutMs = 3000;

  configure(settings) {
    // The urllist control stores a JSON-encoded array of URLs.
    let list = settings.instances;
    if (typeof list === "string") {
      try {
        list = JSON.parse(list);
      } catch {
        list = [];
      }
    }
    if (!Array.isArray(list)) list = [];
    this.instances = list
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u.trim()))
      .map((u) => u.trim().replace(/\/+$/, ""));
    this.safeSearch = ["off", "moderate", "strict"].includes(settings.safeSearch)
      ? settings.safeSearch
      : "off";
    const n = parseInt(settings.maxResults || "20", 10);
    this.maxResults = Math.min(Math.max(Number.isNaN(n) ? 20 : n, 1), 50);
    const t = parseInt(settings.instanceTimeout || "3000", 10);
    this.instanceTimeoutMs = Math.min(
      Math.max(Number.isNaN(t) ? 3000 : t, 500),
      60000,
    );
    this.categories = (settings.categories || "general").trim() || "general";
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    if (!this.instances.length) return [];
    const doFetch = context?.fetch ?? fetch;

    const params = new URLSearchParams({
      q: query,
      format: "json",
      pageno: String(Math.max(1, page || 1)),
    });
    if (context?.lang) params.set("language", context.lang);
    if (this.categories) params.set("categories", this.categories);
    if (this.safeSearch !== "off") {
      params.set("safesearch", SAFESEARCH_MAP[this.safeSearch]);
    }
    const timeRange = TIME_RANGE_MAP[timeFilter];
    if (timeRange) params.set("time_range", timeRange);

    let lastError = null;
    let lastBreach = null;
    let timedOut = false;
    for (const base of this.instances) {
      // Bound each attempt so a hanging instance cannot eat the whole
      // engine timeout before failover gets a chance to run.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.instanceTimeoutMs);
      try {
        const response = await doFetch(`${base}/search?${params}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        context?.sentinel?.(response, this.name);
        const data = await response.json();
        const items = Array.isArray(data?.results) ? data.results : [];

        let host = base;
        try {
          host = new URL(base).hostname;
        } catch {
          /* keep base as label */
        }

        return items.slice(0, this.maxResults).map((item) => {
          const thumb = item.thumbnail_src ?? item.thumbnail ?? "";
          return {
            title: item.title ?? "",
            url: item.url ?? "",
            snippet: (item.content ?? "").slice(0, 300),
            source: `SearXNG (${host})`,
            // Route thumbnails through the server-side image proxy when available.
            thumbnail: thumb
              ? (context?.signProxyUrl?.(thumb) ?? thumb)
              : "",
          };
        });
      } catch (e) {
        // Failover: remember the error and try the next instance. A structured
        // block (SentinelBreach) is kept separately so it can still be surfaced
        // if a later instance only fails at the network level.
        lastError = e;
        if (e?.name === "SentinelBreach") lastBreach = e;
        if (e?.name === "AbortError") timedOut = true;
      } finally {
        clearTimeout(timer);
      }
    }

    // Every instance failed. If any of them was hard-blocked (403/429/5xx),
    // surface that structured error so the UI shows "engine blocked"
    // instead of a silent 0-results. If they all timed out, report a
    // timeout the same way. Pure network failures return [].
    if (lastBreach) throw lastBreach;
    if (timedOut) {
      if (context?.engineError) {
        throw context.engineError(
          "timeout",
          `${this.name}: all instances timed out after ${this.instanceTimeoutMs}ms`,
          { engine: this.name },
        );
      }
    }
    return [];
  }
}
