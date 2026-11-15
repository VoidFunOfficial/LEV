// Browser versions of LearnEV's /api/wiki, /api/image-search and /api/street-route.
// Inside DeepSeek Harness there is no LearnEV server, so the view asks the public
// services directly; Wikipedia, Commons and the OSRM demo server all allow CORS.
// The logic and limits follow src/app/api/*/route.ts.

type WikiSummary = { thumbnail?: { source?: string }; coordinates?: { lat?: number; lon?: number } };
type WikiMedia = { items?: { type?: string; srcset?: { src: string }[] }[] };
type WikiInfo = { lat?: number; lng?: number; photos: string[] };
type Page = { index?: number; title?: string; thumbnail?: { source?: string }; imageinfo?: { thumburl?: string; url?: string; mime?: string }[] };

const wikiCache = new Map<string, WikiInfo>();
const imageCache = new Map<string, string[]>();
const routeCache = new Map<string, [number, number][]>();
const SKIP = /\.svg|icon|logo|map|flag|seal|coat_of_arms|signature|diagram/i;
const WIDTH = 960;
const MAX_STOPS = 25;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function remember<T>(cache: Map<string, T>, key: string, value: T, limit: number) {
  if (cache.size >= limit) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
}

async function wikiGet(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  return response.json();
}

async function wiki(title: string): Promise<WikiInfo> {
  const cached = wikiCache.get(title);
  if (cached) return cached;
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const [summary, media]: [WikiSummary, WikiMedia] = await Promise.all([
    wikiGet(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`),
    wikiGet(`https://en.wikipedia.org/api/rest_v1/page/media-list/${t}`),
  ]);
  const photos: string[] = [];
  const key = (u: string) => decodeURIComponent(u.split("?")[0].split("/").slice(-1)[0]).replace(/^\d+px-/, "");
  if (summary?.thumbnail?.source) photos.push(summary.thumbnail.source);
  for (const item of media?.items ?? []) {
    if (item.type !== "image" || !item.srcset?.length) continue;
    const src = item.srcset[0].src;
    if (/\.svg|icon|logo|map|flag|seal/i.test(src)) continue;
    const url = src.startsWith("//") ? `https:${src}` : src;
    if (!photos.some((p) => key(p) === key(url))) photos.push(url);
    if (photos.length >= 3) break;
  }
  const info = { lat: summary?.coordinates?.lat, lng: summary?.coordinates?.lon, photos };
  remember(wikiCache, title, info, 500);
  return info;
}

async function query(host: string, params: Record<string, string>): Promise<Page[]> {
  const search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", origin: "*", ...params });
  const response = await fetch(`https://${host}/w/api.php?${search}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${host} ${response.status}`);
  const data: { error?: unknown; query?: { pages?: Page[] } } = await response.json();
  if (data.error) throw new Error(`${host} error`);
  return (data.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);

async function imageSearch(q: string): Promise<string[]> {
  const cached = imageCache.get(q);
  if (cached) return cached;
  const images: string[] = [];
  const add = (url: string | undefined) => {
    if (url && url.startsWith("https://") && !SKIP.test(url) && !images.includes(url)) images.push(url);
  };
  const wanted = new Set(words(q));
  const articles = await query("en.wikipedia.org", { generator: "search", gsrsearch: q, gsrlimit: "6", prop: "pageimages", piprop: "thumbnail", pithumbsize: String(WIDTH) });
  articles.filter((page) => words(page.title ?? "").some((w) => wanted.has(w))).forEach((page) => add(page.thumbnail?.source));
  const terms = q.split(/\s+/);
  const tries = [...new Set([terms.join(" "), terms.slice(0, 3).join(" "), terms.slice(0, 2).join(" ")])];
  for (const t of tries) {
    if (images.length >= 3) break;
    const files = await query("commons.wikimedia.org", { generator: "search", gsrsearch: `${t} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "6", prop: "imageinfo", iiprop: "url|mime", iiurlwidth: String(WIDTH) });
    files.forEach((page) => {
      const info = page.imageinfo?.[0];
      if (info?.mime?.startsWith("image/")) add(info.thumburl ?? info.url);
    });
  }
  const found = images.slice(0, 4);
  remember(imageCache, q, found, 500);
  return found;
}

async function streetRoute(coords: string, signal?: AbortSignal | null): Promise<[number, number][] | null> {
  const points = coords.split(";").map((pair) => pair.split(",").map(Number));
  const valid = points.length >= 2 && points.length <= MAX_STOPS
    && points.every(([lng, lat, ...rest]) => !rest.length && Math.abs(lng) <= 180 && Math.abs(lat) <= 90);
  if (!valid) return null;
  const key = points.map((p) => p.join(",")).join(";");
  const cached = routeCache.get(key);
  if (cached) return cached;
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${key}?overview=full&geometries=geojson&steps=false`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`OSRM ${response.status}`);
  const data: { code?: string; routes?: { geometry?: { coordinates?: [number, number][] } }[] } = await response.json();
  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];
  if (data.code !== "Ok" || coordinates.length < 2) throw new Error("No street route");
  const route = coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  remember(routeCache, key, route, 200);
  return route;
}

/** fetch() for the LearnEV components: answers their /api/ requests in the browser and passes anything else through. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!href.startsWith("/api/")) return fetch(input, init);
  const url = new URL(href, "http://localhost");
  const param = (name: string) => url.searchParams.get(name)?.replace(/\s+/g, " ").trim() ?? "";
  try {
    switch (url.pathname) {
      case "/api/wiki": {
        const title = param("title");
        if (!title || title.length > 200) return json({ error: { message: "title is required" } }, 400);
        return json(await wiki(title));
      }
      case "/api/image-search": {
        const q = param("q");
        if (q.length < 2 || q.length > 200) return json({ error: { message: "q must be 2 to 200 characters" } }, 400);
        return json({ images: await imageSearch(q) });
      }
      case "/api/street-route": {
        const route = await streetRoute(url.searchParams.get("coords") ?? "", init?.signal);
        return route ? json({ points: route }) : json({ error: { message: `coords must be 2–${MAX_STOPS} lng,lat pairs` } }, 400);
      }
    }
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    return json({ error: { message: "Lookup unavailable" } }, 502);
  }
  return json({ error: { message: "Not found" } }, 404);
}
