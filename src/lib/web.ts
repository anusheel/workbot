import { config } from "./config";

export type SearchResult = { title: string; url: string; description: string };

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** The readable text of an HTML page: scripts and styles dropped, block elements as line breaks. */
export function textOf(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(
      /<\/?(p|div|br|li|h[1-6]|tr|section|article|header|footer|blockquote|pre|table)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith("#x"))
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#"))
        return String.fromCodePoint(Number(code.slice(1)));
      return entities[code.toLowerCase()] ?? match;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Hosts and address ranges the assistant must never read: this machine, the
// private networks, the shared range (100.64.0.0/10) and link-local, where
// cloud metadata services live. Hostnames are not resolved here, so a public
// name pointing at a private address still gets through.
const privateName = /^(localhost|.+\.(localhost|local|internal))$/;
const privateV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const privateV6 = /^(::1?$|f[cd]|fe[89ab])/;
const maxBytes = 512_000;

/** Whether an address is on the public web: http or https, and not this machine, a private network or link-local. */
export function isPublic(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const bracketless = url.hostname.replace(/^\[|\]$/g, "");
  // A trailing dot is the same name in DNS (localhost. is localhost) but the
  // parser keeps it. A loop, not /\.+$/: that regex retries at every dot of a
  // long run, which is quadratic on a host an attacker chooses.
  let end = bracketless.length;
  while (end > 0 && bracketless.charCodeAt(end - 1) === 46) end--;
  const host = bracketless.slice(0, end).toLowerCase();
  // The URL parser writes an IPv4-mapped address as ::ffff:7f00:1; check it as the IPv4 it is.
  const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  const address = mapped
    ? mapped
        .slice(1)
        .flatMap((hex) => [parseInt(hex, 16) >> 8, parseInt(hex, 16) & 255])
        .join(".")
    : host;
  return !(
    privateName.test(address) ||
    (address.includes(":") ? privateV6.test(address) : privateV4.test(address))
  );
}

function assertPublic(url: URL) {
  if (!isPublic(url)) throw new Error(`${url} is not a public web address`);
}

async function readUpTo(response: Response, bytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let read = 0;
  while (read < bytes) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  return text;
}

/**
 * Fetches a public page. Redirects are followed by hand so every hop is
 * checked, and the body is read only as far as the cap. The address the page
 * was finally read from comes back with it, for resolving its links.
 */
export async function fetchPage(
  url: string,
): Promise<{ url: string; html: string }> {
  let target = new URL(url);
  for (let hop = 0; ; hop++) {
    assertPublic(target);
    const response = await fetch(target, {
      headers: { accept: "text/html,text/plain" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === 3) throw new Error(`${url} redirects too many times`);
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) throw new Error(`${target} answered ${response.status}`);
    return { url: target.href, html: await readUpTo(response, maxBytes) };
  }
}

/** The text of a public page, capped so one page cannot fill the context. */
export async function readPage(url: string, limit = 8_000): Promise<string> {
  return textOf((await fetchPage(url)).html).slice(0, limit);
}

/** Web search through Brave; needs the key in configuration. */
export async function searchWeb(
  query: string,
  count = 5,
): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-subscription-token": config.brave.key ?? "",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Brave Search answered ${response.status}`);
  const { web } = (await response.json()) as {
    web?: { results?: SearchResult[] };
  };
  return (web?.results ?? []).map(({ title, url, description }) => ({
    title,
    url,
    description,
  }));
}
