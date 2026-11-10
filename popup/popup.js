"use strict";

/**
 * Runs inside the inspected page (isolated world). Must be fully
 * self-contained — no references to variables outside this function,
 * since chrome.scripting.executeScript serializes it separately.
 */
function extractPageMetadata() {
  function getMetaContent(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const content = el.getAttribute("content");
        if (content && content.trim()) return content.trim();
      }
    }
    return null;
  }

  const title = document.title ? document.title.trim() : null;
  const description = getMetaContent(['meta[name="description" i]']);
  const robots = getMetaContent(['meta[name="robots" i]']);

  const canonicalLinks = Array.from(document.querySelectorAll('link[rel="canonical" i]'));
  const canonicalHrefs = canonicalLinks.map((l) => l.href).filter(Boolean);
  const canonical = canonicalHrefs[0] || null;
  const canonicalUnique = Array.from(new Set(canonicalHrefs));

  const h1Elements = Array.from(document.querySelectorAll("h1"));
  const h1Count = h1Elements.length;
  const h1Texts = h1Elements
    .slice(0, 5)
    .map((h) => (h.textContent || "").trim().slice(0, 120))
    .filter(Boolean);

  const og = {
    title: getMetaContent(['meta[property="og:title" i]', 'meta[name="og:title" i]']),
    description: getMetaContent(['meta[property="og:description" i]', 'meta[name="og:description" i]']),
    image: getMetaContent(['meta[property="og:image" i]', 'meta[name="og:image" i]']),
    url: getMetaContent(['meta[property="og:url" i]', 'meta[name="og:url" i]']),
    type: getMetaContent(['meta[property="og:type" i]', 'meta[name="og:type" i]'])
  };

  const twitter = {
    card: getMetaContent(['meta[name="twitter:card" i]', 'meta[property="twitter:card" i]']),
    title: getMetaContent(['meta[name="twitter:title" i]', 'meta[property="twitter:title" i]']),
    description: getMetaContent(['meta[name="twitter:description" i]', 'meta[property="twitter:description" i]']),
    image: getMetaContent(['meta[name="twitter:image" i]', 'meta[property="twitter:image" i]'])
  };

  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  let parseErrors = 0;
  const types = new Set();

  function collectTypes(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(collectTypes);
      return;
    }
    if (node["@type"]) {
      if (Array.isArray(node["@type"])) {
        node["@type"].forEach((t) => types.add(String(t)));
      } else {
        types.add(String(node["@type"]));
      }
    }
    if (Array.isArray(node["@graph"])) {
      node["@graph"].forEach(collectTypes);
    }
  }

  jsonLdScripts.forEach((script) => {
    const text = script.textContent;
    if (!text || !text.trim()) return;
    try {
      collectTypes(JSON.parse(text));
    } catch (e) {
      parseErrors++;
    }
  });

  return {
    url: location.href,
    title,
    description,
    canonical,
    canonicalCount: canonicalHrefs.length,
    canonicalUnique,
    robots,
    h1Count,
    h1Texts,
    og,
    twitter,
    jsonLd: {
      blockCount: jsonLdScripts.length,
      types: Array.from(types),
      parseErrors
    }
  };
}

const RESTRICTED_SCHEMES = new Set([
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "devtools:",
  "view-source:",
  "chrome-search:",
  "chrome-error:",
  "chrome-untrusted:"
]);

const RESTRICTED_HOSTS = new Set(["chrome.google.com", "chromewebstore.google.com"]);

function isRestrictedUrl(rawUrl) {
  if (!rawUrl) return true;
  let u;
  try {
    u = new URL(rawUrl);
  } catch (e) {
    return true;
  }
  if (RESTRICTED_SCHEMES.has(u.protocol)) return true;
  if ((u.protocol === "https:" || u.protocol === "http:") && RESTRICTED_HOSTS.has(u.hostname)) {
    return true;
  }
  return false;
}

function classifyLength(text, shortUnder, longOver) {
  if (!text) return null;
  const len = text.length;
  if (len < shortUnder) return "Short";
  if (len > longOver) return "Long";
  return "Within common range";
}

/* ----------------------------------------------------------------------
 * Issue library
 *
 * Severity levels:
 *   error   — fundamental metadata problems
 *   warning — useful/recommended metadata that is missing or off
 *   info    — worth surfacing, not inherently a problem
 * ------------------------------------------------------------------- */

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 };

function buildIssues(data) {
  const issues = [];
  const push = (issue) => issues.push(issue);

  // --- Title ---------------------------------------------------------
  if (!data.title) {
    push({
      severity: "error",
      title: "Missing page title",
      why: "Without a <title>, browsers, search engines and shared links typically fall back to a generic or blank label for this page.",
      fix: "Add a concise, descriptive title in the page <head>.",
      example: '<title>Your Page Title</title>'
    });
  } else {
    const titleLen = classifyLength(data.title, 30, 60);
    if (titleLen === "Short") {
      push({
        severity: "warning",
        title: "Short title",
        why: `The title is ${data.title.length} characters. Very short titles may not fully describe the page, and search engines sometimes rewrite them.`,
        fix: "Consider a slightly more descriptive title — commonly somewhere in the 30–60 character common range, though this varies by page and search engine."
      });
    } else if (titleLen === "Long") {
      push({
        severity: "warning",
        title: "Long title",
        why: `The title is ${data.title.length} characters. Long titles are sometimes truncated or rewritten in search results.`,
        fix: "Consider leading with the most important words. Search engines may still choose their own display text regardless of length."
      });
    }
  }

  // --- Meta description -----------------------------------------------
  if (!data.description) {
    push({
      severity: "warning",
      title: "Missing meta description",
      why: "Without a meta description, search engines and some platforms may generate their own preview text from the page content, which can be inconsistent.",
      fix: "Add a concise meta description summarizing the page.",
      example: '<meta name="description" content="A short summary of the page.">'
    });
  } else {
    const descLen = classifyLength(data.description, 70, 160);
    if (descLen === "Short") {
      push({
        severity: "warning",
        title: "Short meta description",
        why: `The description is ${data.description.length} characters. Very short descriptions may look sparse in a search result snippet.`,
        fix: "Consider expanding it to better summarize the page — commonly somewhere in the 70–160 character common range."
      });
    } else if (descLen === "Long") {
      push({
        severity: "warning",
        title: "Long meta description",
        why: `The description is ${data.description.length} characters. Long descriptions may be truncated in a search result snippet.`,
        fix: "Consider trimming it to the most important sentence first. Search engines may choose their own snippet text regardless."
      });
    }
  }

  // --- Canonical -------------------------------------------------------
  if (data.canonicalUnique.length > 1) {
    push({
      severity: "error",
      title: "Multiple conflicting canonical tags",
      why: "Multiple canonical tags pointing to different URLs give search engines contradictory signals about which URL is authoritative.",
      fix: "Keep only one canonical link tag, pointing to the preferred URL for this page.",
      detail: `Found: ${data.canonicalUnique.join(", ")}`
    });
  } else if (!data.canonical) {
    push({
      severity: "error",
      title: "Missing canonical URL",
      why: "Without a canonical URL, search engines decide for themselves which version of a page (with tracking parameters, different casing, etc.) to treat as primary, which can occasionally split signals across duplicate URLs.",
      fix: "Add a self-referencing canonical link, particularly if this page is reachable through more than one URL variant.",
      example: '<link rel="canonical" href="https://example.com/page">'
    });
  }

  // --- Robots ------------------------------------------------------------
  if (!data.robots) {
    push({
      severity: "info",
      title: "No robots meta tag",
      why: "Without a robots meta tag, browsers and search engines normally default to index, follow — meaning the page is eligible to be indexed and its links followed.",
      fix: "Only add a robots meta tag if you specifically want to restrict indexing or link-following; otherwise the default is usually fine."
    });
  }

  // --- H1 ------------------------------------------------------------
  if (data.h1Count === 0) {
    push({
      severity: "error",
      title: "No H1 element found",
      why: "An H1 typically communicates the primary topic of a page to readers, assistive technology and search engines.",
      fix: "Add a single, descriptive H1 that reflects the page's main heading."
    });
  } else if (data.h1Count > 1) {
    push({
      severity: "warning",
      title: "Multiple H1 elements",
      why: `${data.h1Count} H1 elements were found. Multiple H1s can dilute the page's primary heading signal and may be confusing for assistive technology users.`,
      fix: "Consider using a single H1 for the main heading, and H2/H3 for subsections."
    });
  }

  // --- Open Graph / Twitter (with smart grouping) -----------------------
  const ogComplete = Boolean(data.og.title && data.og.description && data.og.image);
  const bothImagesMissing = !data.og.image && !data.twitter.image;
  const allTwitterMissing = !data.twitter.card && !data.twitter.title && !data.twitter.description && !data.twitter.image;

  if (!data.og.title) {
    push({
      severity: "warning",
      title: "Missing Open Graph title",
      why: "Without og:title, social platforms typically fall back to the page title, which may not be written for sharing context.",
      fix: "Add an explicit og:title tailored for social sharing.",
      example: '<meta property="og:title" content="Your Page Title">'
    });
  }

  if (!data.og.description) {
    push({
      severity: "warning",
      title: "Missing Open Graph description",
      why: "Without og:description, social platforms typically fall back to the meta description, or may pull arbitrary text from the page.",
      fix: "Add an explicit og:description written for a social preview.",
      example: '<meta property="og:description" content="A short, shareable summary.">'
    });
  }

  if (!data.og.url) {
    push({
      severity: "warning",
      title: "Missing og:url",
      why: "og:url tells social platforms which URL to associate with shares of this page — useful when a page is reachable through more than one URL.",
      fix: "Add og:url pointing to the preferred URL for this page."
    });
  }

  if (bothImagesMissing) {
    push({
      severity: "warning",
      title: "Missing social preview image",
      why: "Neither an Open Graph nor a Twitter image is set, so platforms may choose an arbitrary image from the page — or none at all — when this page is shared.",
      fix: "Add one og:image, ideally around 1200×630px. Most platforms, including X/Twitter, will fall back to it even without a separate twitter:image.",
      example: '<meta property="og:image" content="https://example.com/og-image.jpg">'
    });
  } else if (!data.og.image) {
    push({
      severity: "warning",
      title: "Missing Open Graph image",
      why: "Social platforms may choose an arbitrary image from the page when the URL is shared.",
      fix: "Add an explicit Open Graph image, ideally around 1200×630px.",
      example: '<meta property="og:image" content="https://example.com/og-image.jpg">'
    });
  }

  if (allTwitterMissing) {
    if (ogComplete) {
      push({
        severity: "info",
        title: "Twitter-specific metadata not set",
        why: "X and some other platforms may fall back to Open Graph metadata when Twitter-specific tags are absent.",
        fix: "Add Twitter card tags if you want explicit control over how this page appears when shared on X.",
        example: '<meta name="twitter:card" content="summary_large_image">'
      });
    } else {
      push({
        severity: "warning",
        title: "No social preview metadata set",
        why: "Neither Twitter-specific tags nor complete Open Graph tags are present, so platforms may be unable to generate a rich preview when this page is shared.",
        fix: "Add Open Graph tags (og:title, og:description, og:image) as a baseline — most platforms, including X/Twitter, will fall back to them."
      });
    }
  } else {
    if (!data.twitter.card) {
      push({
        severity: "warning",
        title: "Missing twitter:card",
        why: "Without twitter:card, X/Twitter may not render a rich preview even if other Twitter tags are present.",
        fix: 'Add <meta name="twitter:card" content="summary_large_image"> (or "summary").'
      });
    }
    if (!data.twitter.title) {
      push({
        severity: "warning",
        title: "Missing twitter:title",
        why: "Without twitter:title, X/Twitter typically falls back to og:title or the page title.",
        fix: "Add an explicit twitter:title, or rely on og:title if it already suits sharing."
      });
    }
    if (!data.twitter.description) {
      push({
        severity: "warning",
        title: "Missing twitter:description",
        why: "Without twitter:description, X/Twitter typically falls back to og:description.",
        fix: "Add an explicit twitter:description, or rely on og:description if it already suits sharing."
      });
    }
    if (!data.twitter.image && !bothImagesMissing) {
      push({
        severity: "warning",
        title: "Missing twitter:image",
        why: "X/Twitter will typically fall back to og:image if present.",
        fix: "Add an explicit twitter:image, or confirm og:image is suitable for a Twitter card."
      });
    }
  }

  // --- Structured data -------------------------------------------------
  if (data.jsonLd.blockCount === 0) {
    push({
      severity: "info",
      title: "No JSON-LD structured data found",
      why: "JSON-LD isn't required for a page to function, but it can help search engines understand entities on the page (articles, products, organizations, etc.) for enhanced results.",
      fix: "Consider adding a JSON-LD script block with schema.org markup relevant to this page's content, if applicable."
    });
  }
  if (data.jsonLd.parseErrors > 0) {
    push({
      severity: "error",
      title: `${data.jsonLd.parseErrors} JSON-LD block${data.jsonLd.parseErrors > 1 ? "s" : ""} could not be parsed`,
      why: "Malformed JSON-LD is typically ignored by search engines and other consumers, so any structured data it contains has no effect.",
      fix: "Check the block(s) for syntax errors such as trailing commas or unescaped quotes. A JSON validator can help pinpoint the issue."
    });
  }

  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return issues;
}

function computeStatus(issues) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const total = issues.length;

  if (total === 0) {
    return { tone: "good", label: "Everything looks good" };
  }
  if (errorCount > 0) {
    return { tone: "bad", label: "Needs attention" };
  }
  return { tone: "warn", label: `${total} issue${total > 1 ? "s" : ""} found` };
}

function el(id) {
  return document.getElementById(id);
}

function setDot(key, status) {
  const dot = document.querySelector(`[data-dot="${key}"]`);
  if (!dot) return;
  dot.className = "dot" + (status ? ` dot-${status}` : "");
}

function setValue(id, value, opts = {}) {
  const node = el(id);
  if (!value) {
    node.textContent = opts.emptyText || "Not present";
    node.classList.add("is-empty");
  } else {
    node.textContent = value;
    node.classList.remove("is-empty");
  }
  if (opts.mono) node.classList.add("is-mono");
}

const SEVERITY_BADGE_CLASS = { error: "badge-bad", warning: "badge-warn", info: "badge-info" };
const SEVERITY_BADGE_LABEL = { error: "Error", warning: "Warning", info: "Info" };

function issueCard(issue) {
  const card = document.createElement("div");
  card.className = "issue-card";

  const head = document.createElement("div");
  head.className = "issue-head";

  const badge = document.createElement("span");
  badge.className = `issue-badge ${SEVERITY_BADGE_CLASS[issue.severity]}`;
  badge.textContent = SEVERITY_BADGE_LABEL[issue.severity];

  const title = document.createElement("span");
  title.className = "issue-title";
  title.textContent = issue.title;

  head.appendChild(badge);
  head.appendChild(title);
  card.appendChild(head);

  const why = document.createElement("div");
  why.className = "issue-row";
  const whyLabel = document.createElement("div");
  whyLabel.className = "issue-row-label";
  whyLabel.textContent = "Why it matters";
  const whyText = document.createElement("div");
  whyText.className = "issue-body issue-row-text";
  whyText.textContent = issue.why;
  why.appendChild(whyLabel);
  why.appendChild(whyText);
  card.appendChild(why);

  const fix = document.createElement("div");
  fix.className = "issue-row";
  const fixLabel = document.createElement("div");
  fixLabel.className = "issue-row-label";
  fixLabel.textContent = "Suggested fix";
  const fixText = document.createElement("div");
  fixText.className = "issue-body issue-row-text";
  fixText.textContent = issue.fix;
  fix.appendChild(fixLabel);
  fix.appendChild(fixText);
  card.appendChild(fix);

  if (issue.detail) {
    const detail = document.createElement("div");
    detail.className = "issue-detail";
    detail.textContent = issue.detail;
    card.appendChild(detail);
  }

  if (issue.example) {
    const pre = document.createElement("pre");
    pre.className = "issue-example";
    pre.textContent = issue.example;
    card.appendChild(pre);
  }

  return card;
}

function render(data) {
  el("loading").hidden = true;
  el("unavailable").hidden = true;
  el("results").hidden = false;

  // Core metadata
  setDot("title", data.title ? "good" : "bad");
  setValue("val-title", data.title);
  const titleLen = classifyLength(data.title, 30, 60);
  el("note-title").textContent = data.title
    ? `${data.title.length} characters — ${titleLen} (typical range varies by search engine and page type)`
    : "";

  setDot("description", data.description ? "good" : "warn");
  setValue("val-description", data.description);
  const descLen = classifyLength(data.description, 70, 160);
  el("note-description").textContent = data.description
    ? `${data.description.length} characters — ${descLen} (typical range varies by search engine and page type)`
    : "";

  setDot("canonical", data.canonical ? "good" : "warn");
  setValue("val-canonical", data.canonical, { mono: true });

  setDot("robots", data.robots ? "good" : "neutral");
  setValue("val-robots", data.robots, { emptyText: "Not set (defaults to index, follow)" });

  const h1Status = data.h1Count === 1 ? "good" : "warn";
  setDot("h1", h1Status);
  let h1Text = `${data.h1Count} found`;
  if (data.h1Count > 0 && data.h1Texts.length) {
    h1Text += `\n${data.h1Texts.map((t) => `“${t}”`).join("\n")}`;
  }
  setValue("val-h1", h1Text);

  // Open Graph
  setDot("og-title", data.og.title ? "good" : "warn");
  setValue("val-og-title", data.og.title);
  setDot("og-description", data.og.description ? "good" : "warn");
  setValue("val-og-description", data.og.description);
  setDot("og-image", data.og.image ? "good" : "warn");
  setValue("val-og-image", data.og.image, { mono: true });
  setDot("og-url", data.og.url ? "good" : "neutral");
  setValue("val-og-url", data.og.url, { mono: true });
  setDot("og-type", data.og.type ? "good" : "neutral");
  setValue("val-og-type", data.og.type);

  // Twitter / X
  setDot("tw-card", data.twitter.card ? "good" : "neutral");
  setValue("val-tw-card", data.twitter.card);
  setDot("tw-title", data.twitter.title ? "good" : "neutral");
  setValue("val-tw-title", data.twitter.title);
  setDot("tw-description", data.twitter.description ? "good" : "neutral");
  setValue("val-tw-description", data.twitter.description);
  setDot("tw-image", data.twitter.image ? "good" : "neutral");
  setValue("val-tw-image", data.twitter.image, { mono: true });

  // Structured data
  const jsonLdStatus = data.jsonLd.parseErrors > 0 ? "bad" : data.jsonLd.blockCount === 0 ? "warn" : "good";
  setDot("jsonld", jsonLdStatus);
  setValue("val-jsonld-count", `${data.jsonLd.blockCount} block${data.jsonLd.blockCount === 1 ? "" : "s"}`);
  setValue("val-jsonld-types", data.jsonLd.types.length ? data.jsonLd.types.join(", ") : null, {
    emptyText: "None detected"
  });
  el("note-jsonld-errors").textContent =
    data.jsonLd.parseErrors > 0
      ? `${data.jsonLd.parseErrors} block${data.jsonLd.parseErrors > 1 ? "s" : ""} failed to parse as valid JSON.`
      : "";

  // Issues + overall status
  const issues = buildIssues(data);
  const status = computeStatus(issues);

  const statusDot = el("status-dot");
  statusDot.className = `status-dot status-${status.tone}`;
  el("status-label").textContent = status.label;

  const issuesSection = el("section-issues");
  const emptyState = el("status-empty-state");

  if (issues.length === 0) {
    issuesSection.hidden = true;
    emptyState.hidden = false;
    el("status-empty-detail").textContent =
      "No obvious metadata issues found. Title, description, canonical URL, social metadata and structured data are all present.";
  } else {
    emptyState.hidden = true;
    issuesSection.hidden = false;
    const container = el("issues-container");
    container.innerHTML = "";
    issues.forEach((issue) => container.appendChild(issueCard(issue)));
  }

  el("copy-btn").disabled = false;
  el("copy-btn").dataset.report = buildReportText(data, issues, status);
}

function line(label, value) {
  return `${label}: ${value || "Not present"}`;
}

function buildReportText(data, issues, status) {
  const lines = [];
  lines.push("Page Metadata Inspector Report");
  lines.push(line("URL", data.url));
  lines.push(`Status: ${status.label}`);
  lines.push("");
  lines.push(line("Title", data.title));
  lines.push(line("Description", data.description));
  lines.push(line("Canonical", data.canonical));
  lines.push(line("Robots", data.robots));
  lines.push(line("H1 count", String(data.h1Count)));
  lines.push("");
  lines.push("Open Graph:");
  lines.push(`  og:title: ${data.og.title || "Not present"}`);
  lines.push(`  og:description: ${data.og.description || "Not present"}`);
  lines.push(`  og:image: ${data.og.image || "Not present"}`);
  lines.push(`  og:url: ${data.og.url || "Not present"}`);
  lines.push(`  og:type: ${data.og.type || "Not present"}`);
  lines.push("");
  lines.push("Twitter/X card:");
  lines.push(`  twitter:card: ${data.twitter.card || "Not present"}`);
  lines.push(`  twitter:title: ${data.twitter.title || "Not present"}`);
  lines.push(`  twitter:description: ${data.twitter.description || "Not present"}`);
  lines.push(`  twitter:image: ${data.twitter.image || "Not present"}`);
  lines.push("");
  lines.push("Structured data:");
  lines.push(`  JSON-LD blocks: ${data.jsonLd.blockCount}`);
  lines.push(`  Detected types: ${data.jsonLd.types.length ? data.jsonLd.types.join(", ") : "None detected"}`);
  if (data.jsonLd.parseErrors > 0) {
    lines.push(`  Parse errors: ${data.jsonLd.parseErrors}`);
  }
  lines.push("");
  lines.push("Issues:");
  if (issues.length === 0) {
    lines.push("  None found.");
  } else {
    issues.forEach((issue, idx) => {
      lines.push(`  ${idx + 1}. ${issue.title} [${SEVERITY_BADGE_LABEL[issue.severity]}]`);
      lines.push(`     Why: ${issue.why}`);
      lines.push(`     Fix: ${issue.fix}`);
      if (issue.detail) lines.push(`     Detail: ${issue.detail}`);
    });
  }
  return lines.join("\n");
}

function showUnavailable() {
  el("loading").hidden = true;
  el("results").hidden = true;
  el("unavailable").hidden = false;
}

async function init() {
  const copyBtn = el("copy-btn");
  const copyFeedback = el("copy-feedback");

  copyBtn.addEventListener("click", async () => {
    const report = copyBtn.dataset.report;
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      copyFeedback.textContent = "Copied to clipboard";
      setTimeout(() => (copyFeedback.textContent = ""), 2000);
    } catch (e) {
      copyFeedback.textContent = "Copy failed";
      setTimeout(() => (copyFeedback.textContent = ""), 2000);
    }
  });

  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch (e) {
    showUnavailable();
    return;
  }

  if (!tab || !tab.id || isRestrictedUrl(tab.url)) {
    showUnavailable();
    return;
  }

  try {
    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageMetadata
    });
    if (!injectionResult || !injectionResult.result) {
      showUnavailable();
      return;
    }
    render(injectionResult.result);
  } catch (e) {
    showUnavailable();
  }
}

document.addEventListener("DOMContentLoaded", init);
