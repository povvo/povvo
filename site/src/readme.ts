import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Entry } from "./catalogue";
import { OWNER } from "./data";

const cache = new Map<string, Promise<string | null>>();

function rawBase(entry: Entry): string {
  return `https://raw.githubusercontent.com/${OWNER}/${entry.name}/${entry.default_branch || "HEAD"}/`;
}
function blobBase(entry: Entry): string {
  return `https://github.com/${OWNER}/${entry.name}/blob/${entry.default_branch || "HEAD"}/`;
}

function isAbsolute(url: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("#");
}

function resolveAgainst(base: string, url: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** Fetch the README text, trying the common filenames in order. */
export function fetchReadme(entry: Entry): Promise<string | null> {
  const key = `${entry.name}@${entry.default_branch}`;
  const pending = cache.get(key);
  if (pending) return pending;
  const attempt = (async () => {
    for (const file of ["README.md", "readme.md", "Readme.md", "README.MD", "README"]) {
      try {
        const res = await fetch(rawBase(entry) + file, { cache: "force-cache" });
        if (res.ok) return await res.text();
      } catch {
        /* try the next name */
      }
    }
    return null;
  })();
  cache.set(key, attempt);
  return attempt;
}

/** Markdown to sanitised HTML with repository-relative links and images resolved to GitHub. */
export function renderReadme(entry: Entry, markdown: string): string {
  const raw = rawBase(entry);
  const blob = blobBase(entry);
  const html = marked.parse(markdown, { gfm: true, breaks: false, async: false }) as string;

  DOMPurify.removeAllHooks();
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    const tag = node.nodeName.toLowerCase();
    if ((data.attrName === "src" || data.attrName === "srcset") && (tag === "img" || tag === "source" || tag === "video")) {
      if (data.attrName === "srcset") {
        data.attrValue = data.attrValue
          .split(",")
          .map((part) => {
            const [u, d] = part.trim().split(/\s+/);
            return `${isAbsolute(u) ? u : resolveAgainst(raw, u)}${d ? ` ${d}` : ""}`;
          })
          .join(", ");
      } else if (!isAbsolute(data.attrValue)) {
        data.attrValue = resolveAgainst(raw, data.attrValue);
      }
    }
    if (data.attrName === "href" && tag === "a" && !isAbsolute(data.attrValue)) {
      data.attrValue = resolveAgainst(blob, data.attrValue);
    }
  });
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A" && node.getAttribute("href") && !node.getAttribute("href")!.startsWith("#")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener");
    }
    if (node.nodeName === "IMG") node.setAttribute("loading", "lazy");
  });
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["picture", "source", "details", "summary", "video"],
    ADD_ATTR: ["srcset", "media", "align", "width", "height", "loading", "target", "controls", "muted", "playsinline"],
    FORBID_TAGS: ["style", "script", "iframe", "form", "input"],
  });
  DOMPurify.removeAllHooks();
  return clean;
}

const rendered = new Map<string, Promise<string | null>>();

/**
 * The README as sanitised HTML, fetched and rendered once. Opening a disk that was prefetched
 * (src/main.ts prefetches the settled disk and its neighbours while the page is idle) costs
 * nothing.
 */
export function readmeHtml(entry: Entry): Promise<string | null> {
  const key = `${entry.name}@${entry.default_branch}`;
  let hit = rendered.get(key);
  if (!hit) {
    hit = fetchReadme(entry).then((text) => (text === null ? null : renderReadme(entry, text)));
    hit.catch(() => rendered.delete(key));
    rendered.set(key, hit);
  }
  return hit;
}
