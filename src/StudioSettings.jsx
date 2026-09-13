import React, { useState } from "react";
import { Check, ExternalLink, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { safeWebUrl } from "./studios.js";

const EMPTY = { id: "", name: "", url: "", accessUrl: "" };

export function StudioLinks({ url, accessUrl }) {
  return <div className="studio-links">
    {safeWebUrl(url) && <a href={safeWebUrl(url)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />公式サイト</a>}
    {safeWebUrl(accessUrl) && <a href={safeWebUrl(accessUrl)} target="_blank" rel="noopener noreferrer"><MapPin size={16} />アクセス・地図</a>}
  </div>;
}

export default function StudioSettings({ studios, onSave, onDelete, type = "studio" }) {
  const isLivehouse = type === "livehouse";
  const venueName = isLivehouse ? "ライブハウス" : "スタジオ";
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved("");
    setError("");
  };
  const save = (event) => {
    event.preventDefault();
    if (!draft.name.trim()) { setError(`${venueName}名を入力してください。`); return; }
    if ([draft.url, draft.accessUrl].some((value) => value.trim() && !safeWebUrl(value))) {
      setError("URLは https:// または http:// から始まるアドレスを入力してください。");
      return;
    }
    const studio = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), url: safeWebUrl(draft.url), accessUrl: safeWebUrl(draft.accessUrl) };
    onSave(studio);
    setDraft(EMPTY);
    setSaved(`${studio.name}を保存しました。`);
    setError("");
  };
  return <section className="studio-settings">
    <div className="panel-head"><h2>{venueName}登録</h2><span>{studios.length}件</span></div>
    <form className="studio-form" onSubmit={save} noValidate>
      <label className="field wide"><span>{venueName}名</span><input value={draft.name} onChange={(event) => change("name", event.target.value)} required maxLength={200} /></label>
      <label className="field"><span>{venueName}公式サイトURL（任意）</span><input type="url" inputMode="url" value={draft.url} onChange={(event) => change("url", event.target.value)} placeholder="https://" /></label>
      <label className="field"><span>アクセス・地図URL（任意）</span><input type="url" inputMode="url" value={draft.accessUrl} onChange={(event) => change("accessUrl", event.target.value)} placeholder="https://" /></label>
      <div className="studio-form-actions">
        <button className="secondary" type="submit">{draft.id ? <Check size={16} /> : <Plus size={16} />}{draft.id ? "変更を保存" : `${venueName}を登録`}</button>
        {draft.id && <button className="secondary" type="button" onClick={() => { setDraft(EMPTY); setError(""); }}><X size={16} />キャンセル</button>}
      </div>
    </form>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {saved && <p className="studio-save-status" role="status">{saved}</p>}
    <div className="studio-list">
      {studios.map((studio) => <article className="studio-row" key={studio.id}>
        <div><h3>{studio.name}</h3><StudioLinks url={studio.url} accessUrl={studio.accessUrl} /></div>
        <div className="inline-actions">
          <button className="ghost" title={`${studio.name}を編集`} aria-label={`${studio.name}を編集`} onClick={() => { setDraft(studio); setSaved(""); setError(""); }}><Pencil size={16} /></button>
          <button className="icon-danger" title={`${studio.name}を削除`} aria-label={`${studio.name}を削除`} onClick={() => {
            if (!confirm(`${studio.name}を${venueName}の登録一覧から削除しますか？設定済みの日程と共有ページの場所は変わりません。`)) return;
            onDelete(studio.id);
            if (draft.id === studio.id) setDraft(EMPTY);
            setSaved("");
          }}><Trash2 size={16} /></button>
        </div>
      </article>)}
      {!studios.length && <p className="empty">登録済みの{venueName}はありません。</p>}
    </div>
  </section>;
}
