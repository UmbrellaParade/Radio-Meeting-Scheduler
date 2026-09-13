export function safeWebUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeStudios(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter((studio) => {
    if (!studio || typeof studio.id !== "string" || !studio.id || seen.has(studio.id) || typeof studio.name !== "string" || !studio.name.trim()) return false;
    seen.add(studio.id);
    return true;
  }).map((studio) => ({
    id: studio.id,
    name: studio.name.trim(),
    url: safeWebUrl(studio.url),
    accessUrl: safeWebUrl(studio.accessUrl)
  }));
}

export function studioSelection(studio) {
  return {
    studioId: studio?.id || "",
    meetingPlace: studio?.name || "",
    studioUrl: safeWebUrl(studio?.url),
    studioAccessUrl: safeWebUrl(studio?.accessUrl)
  };
}

export function studioLinkLines(data) {
  return [
    safeWebUrl(data.studioUrl) ? `スタジオ公式サイト: ${safeWebUrl(data.studioUrl)}` : "",
    safeWebUrl(data.studioAccessUrl) ? `アクセス・地図: ${safeWebUrl(data.studioAccessUrl)}` : ""
  ].filter(Boolean);
}
