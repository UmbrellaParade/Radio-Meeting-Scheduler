import { API_URL } from "./config.js";

export const apiConfigured = () => Boolean(API_URL);

// GASはOPTIONSプリフライトを処理できないため、POSTは text/plain で送る
async function post(payload) {
  if (!API_URL) throw new Error("APIのURLが設定されていません（gas/README.md 参照）");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "サーバーエラーが発生しました");
  return data;
}

export async function fetchEvent(eventId) {
  if (!API_URL) throw new Error("APIのURLが設定されていません（gas/README.md 参照）");
  const url = `${API_URL}?action=event&id=${encodeURIComponent(eventId)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "イベントを取得できませんでした");
  return data;
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
