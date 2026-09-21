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
      type: "list",
      addLabel: "Add instance",
      itemSchema: [
        {
          key: "name",
          label: "Display name",
          type: "text",
          placeholder: "e.g. Home LAN (optional — hostname is used if empty)",
        },
        {
          key: "url",
          label: "Instance URL",
          type: "url",
          placeholder: "http://10.69.69.208:8080",
        },
      ],
      description:
        "SearXNG instances, tried in order (ordered strategy) or all at once (race strategy). JSON output (format=json) must be enabled on each instance (search.formats in settings.yml). The display name shows on the results page.",
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
      key: "strategy",
      label: "Instance strategy",
      type: "select",
      options: ["ordered", "race"],
      default: "ordered",
      description:
        "ordered = try instances in list order, first healthy one serves (lowest load, consistent results). race = ask every instance at once, first one with results wins (lowest worst-case latency, but every query contacts every instance).",
    },
    {
      key: "instanceTimeout",
      label: "Instance timeout (ms)",
      type: "number",
      default: "3000",
      description:
        "Time each instance gets to answer before it is cut off. Keep instances × this within degoog's per-engine timeout (Advanced settings, default 10s) — or raise that timeout.",
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
  strategy = "ordered";
  instanceTimeoutMs = 3000;
  categories = "general";

  configure(settings) {
    // The list control stores a JSON-encoded array of {name, url} rows.
    // Values saved by older versions (plain array of URL strings) migrate
    // automatically: they keep working, with the hostname as the label.
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
      .map((item) => {
        if (typeof item === "string") return { name: "", url: item };
        if (item && typeof item === "object") {
          return { name: String(item.name ?? ""), url: String(item.url ?? "") };
        }
        return { name: "", url: "" };
      })
      .filter(
        (e) => typeof e.url === "string" && /^https?:\/\//i.test(e.url.trim()),
      )
      .map((e) => ({
        name: e.name.trim(),
        url: e.url.trim().replace(/\/+$/, ""),
      }));
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
    this.strategy = settings.strategy === "race" ? "race" : "ordered";
    this.categories = (settings.categories || "general").trim() || "general";
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    if (!this.instances.length) return [];

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

    if (this.strategy === "race") {
      return this.#raceSearch(context, params);
    }
    return this.#orderedSearch(context, params);
  }

  // Shared result mapping: labelled source + proxy-wrapped thumbs.
  #toResults(items, label, context) {
    return items.slice(0, this.maxResults).map((item) => {
      const thumb = item.thumbnail_src ?? item.thumbnail ?? "";
      return {
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: (item.content ?? "").slice(0, 300),
        source: `SearXNG (${label})`,
        thumbnail: thumb ? (context?.signProxyUrl?.(thumb) ?? thumb) : "",
      };
    });
  }

  // Display label for the source field: custom name, else the hostname.
  #labelFor(entry) {
    if (entry.name) return entry.name;
    try {
      return new URL(entry.url).hostname;
    } catch {
      return entry.url;
    }
  }

  #attempt(entry, params, context, controller) {
    const doFetch = context?.fetch ?? fetch;
    const timer = setTimeout(() => controller.abort(), this.instanceTimeoutMs);
    return (async () => {
      try {
        const response = await doFetch(`${entry.url}/search?${params}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        context?.sentinel?.(response, this.name);
        const data = await response.json();
        const items = Array.isArray(data?.results) ? data.results : [];
        if (!items.length) {
          // A 200 with zero results is not a win in race mode; the next
          // instance may still have hits for this query.
          throw new Error(`${entry.url}: empty results`);
        }
        return { label: this.#labelFor(entry), items };
      } finally {
        clearTimeout(timer);
      }
    })();
  }

  // Strategy "ordered": walk the list in order, first healthy instance serves.
  async #orderedSearch(context, params) {
    let lastBreach = null;
    let timedOut = false;
    for (const entry of this.instances) {
      const controller = new AbortController();
      try {
        const { label, items } = await this.#attempt(
          entry,
          params,
          context,
          controller,
        );
        return this.#toResults(items, label, context);
      } catch (e) {
        // Failover: remember the error and try the next instance. A structured
        // block (SentinelBreach) is kept separately so it can still be surfaced
        // if a later instance only fails at the network level.
        if (e?.name === "SentinelBreach") lastBreach = e;
        if (e?.name === "AbortError") timedOut = true;
      }
    }

    // Every instance failed. If any of them was hard-blocked (403/429/5xx),
    // surface that structured error so the UI shows "engine blocked"
    // instead of a silent 0-results. If they all timed out, report a
    // timeout the same way. Pure network failures return [].
    if (lastBreach) throw lastBreach;
    if (timedOut && context?.engineError) {
      throw context.engineError(
        "timeout",
        `${this.name}: all instances timed out after ${this.instanceTimeoutMs}ms`,
        { engine: this.name },
      );
    }
    return [];
  }

  // Strategy "race": contact every instance at once, first one with
  // non-empty results wins; losers are aborted immediately after.
  async #raceSearch(context, params) {
    const controllers = this.instances.map(() => new AbortController());
    const errors = [];
    const attempts = this.instances.map((entry, i) =>
      this.#attempt(entry, params, context, controllers[i]).catch((e) => {
        errors.push(e);
        throw e;
      }),
    );

    let won = false;
    try {
      const { label, items } = await Promise.any(attempts);
      won = true;
      // Cut off the losers so their sockets close instead of lingering.
      controllers.forEach((c) => c.abort());
      return this.#toResults(items, label, context);
    } catch {
      /* all instances failed — handled below */
    } finally {
      if (!won) controllers.forEach((c) => c.abort());
    }

    const breach = errors.find((e) => e?.name === "SentinelBreach");
    if (breach) throw breach;
    if (errors.some((e) => e?.name === "AbortError") && context?.engineError) {
      throw context.engineError(
        "timeout",
        `${this.name}: all instances timed out after ${this.instanceTimeoutMs}ms`,
        { engine: this.name },
      );
    }
    return [];
  }
}
