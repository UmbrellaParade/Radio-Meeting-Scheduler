import { API_URL } from "./config.js";

export const apiConfigured = () => Boolean(API_URL);

const REQUEST_TIMEOUT_MS = 20000;

async function requestJson(url, options, fallbackMessage) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("共有サービスから正しい応答を受け取れませんでした。少し待って、もう一度お試しください。");
    }
    if (!response.ok || !data.ok) throw new Error(data.error || fallbackMessage);
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("共有サービスの応答に時間がかかっています。少し待って、もう一度お試しください。");
    }
    if (error instanceof TypeError) {
      throw new Error("共有サービスに接続できませんでした。通信状態を確認して、もう一度お試しください。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

// GASはOPTIONSプリフライトを処理できないため、POSTは text/plain で送る
async function post(payload) {
  if (!API_URL) throw new Error("APIのURLが設定されていません（gas/README.md 参照）");
  return requestJson(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }, "共有サービスでエラーが発生しました");
}

export async function fetchEvent(eventId) {
  if (!API_URL) throw new Error("APIのURLが設定されていません（gas/README.md 参照）");
  const url = `${API_URL}?action=event&id=${encodeURIComponent(eventId)}`;
  return requestJson(url, undefined, "共有ページを取得できませんでした");
}

export function createEvent({ title, memo, candidates }) {
  return post({ action: "create", title, memo, candidates });
}

export function updateEvent({ id, adminKey, title, memo, candidates }) {
  return post({ action: "update", id, adminKey, title, memo, candidates });
}

export function submitAnswer({ id, name, answers, comment }) {
  return post({ action: "answer", id, name, answers, comment });
}

export function decideEvent({ id, adminKey, decidedAt }) {
  return post({ action: "decide", id, adminKey, decidedAt });
}
