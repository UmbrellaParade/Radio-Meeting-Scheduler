export function shareUrlFor(shareId, mode) {
  let url = new URL(`${window.location.origin}${window.location.pathname}`);
  try {
    const pageUrl = window.frameElement?.dataset.umsPageUrl;
    if (pageUrl) {
      const parentUrl = new URL(pageUrl);
      if (parentUrl.origin === window.location.origin) url = parentUrl;
    }
  } catch {
    // Cross-origin embeds keep standalone share links.
  }
  url.hash = "";
  url.searchParams.delete("embed");
  url.searchParams.delete("initialMode");
  url.searchParams.set("e", shareId);
  if (mode === "band") url.searchParams.set("mode", "band");
  else url.searchParams.delete("mode");
  return url.href;
}

export function initialMode() {
  return new URLSearchParams(window.location.search).get("initialMode") === "band" ? "band" : "radio";
}

export function startEmbedBridge() {
  if (window.parent === window || new URLSearchParams(window.location.search).get("embed") !== "wordpress") return;
  const root = document.getElementById("root");
  let previousHeight = 0;
  let pending = false;
  const reportHeight = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const height = Math.ceil(root.getBoundingClientRect().height);
      if (!height || height === previousHeight) return;
      previousHeight = height;
      window.parent.postMessage({ type: "umbrella-scheduler:resize", height }, window.location.origin);
    });
  };
  new ResizeObserver(reportHeight).observe(root);
  reportHeight();
}
