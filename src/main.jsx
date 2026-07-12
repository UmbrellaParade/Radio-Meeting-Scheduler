import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Trash2,
  Upload
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "radio-meeting-scheduler:v1";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const pad = (value) => String(value).padStart(2, "0");

function toDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateString, amount) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + amount);
  return formatInputDate(date);
}

function formatJapaneseDate(dateString) {
  if (!dateString) return "";
  const date = toDate(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）`;
}

function addMinutes(time, minutes) {
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function candidateId(date, start, durationMinutes) {
  return `${date}-${start}-${durationMinutes}`;
}

function generateCandidates(settings) {
  if (!settings.broadcastDate) return [];
  const start = Number(settings.leadStartDays || 7);
  const end = Number(settings.leadEndDays || 1);
  const first = Math.max(start, end);
  const last = Math.min(start, end);
  const candidates = [];
  for (let offset = first; offset >= last; offset -= 1) {
    const date = addDays(settings.broadcastDate, -offset);
    const day = toDate(date).getDay();
    if (!settings.includeWeekends && (day === 0 || day === 6)) continue;
    for (const startTime of settings.timeSlots) {
      const cleanStart = startTime || "20:00";
      const endTime = addMinutes(cleanStart, settings.durationMinutes);
      candidates.push({
        id: candidateId(date, cleanStart, settings.durationMinutes),
        date,
        start: cleanStart,
        end: endTime,
        enabled: true
      });
    }
  }
  return candidates;
}

function makeDefaultState() {
  const broadcastDate = formatInputDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const state = {
    episodeTitle: "Sunoパ！ゲスト回",
    guestName: "",
    broadcastDate,
    leadStartDays: 7,
    leadEndDays: 1,
    includeWeekends: true,
    durationMinutes: 30,
    timeSlots: ["20:00", "21:00", "22:00"],
    candidates: [],
    chouseisanUrl: "",
    decidedAt: "",
    meetingPlace: "オンライン（Discord / Zoomなど）",
    meetingNotes: ""
  };
  return { ...state, candidates: generateCandidates(state) };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    return { ...makeDefaultState(), ...JSON.parse(raw) };
  } catch {
    return makeDefaultState();
  }
}

function copyText(text, label, setCopied) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  });
}

function Field({ label, children, wide = false }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return <input type="text" {...props} />;
}

function App() {
  const [data, setData] = useState(loadState);
  const [copied, setCopied] = useState("");
  const [newSlot, setNewSlot] = useState("19:30");

  const update = (patch) => {
    setData((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const enabledCandidates = useMemo(
    () => data.candidates.filter((candidate) => candidate.enabled),
    [data.candidates]
  );

  const eventTitle = useMemo(() => {
    const guest = data.guestName.trim() ? `${data.guestName.trim()}さん` : "ゲストさん";
    return `${data.episodeTitle || "Sunoパ！"} ${guest} 事前打ち合わせ`;
  }, [data.episodeTitle, data.guestName]);

  const candidateLines = useMemo(
    () => enabledCandidates.map((candidate) => `${formatJapaneseDate(candidate.date)} ${candidate.start}-${candidate.end}`),
    [enabledCandidates]
  );

  const memoText = useMemo(
    () =>
      [
        `所要時間は${data.durationMinutes || 30}分ほどです。`,
        `場所: ${data.meetingPlace || "オンライン"}`,
        "番組の流れ、紹介楽曲、記事掲載内容、NG事項の確認をします。",
        "参加できる日時に○、難しい日時に×、条件つきなら△でお願いします。",
        data.broadcastDate ? `放送予定日: ${formatJapaneseDate(data.broadcastDate)}` : ""
      ]
        .filter(Boolean)
        .join("\n"),
    [data.broadcastDate, data.durationMinutes, data.meetingPlace]
  );

  const chouseisanText = useMemo(
    () =>
      [
        "【イベント名】",
        eventTitle,
        "",
        "【メモ】",
        memoText,
        "",
        "【候補日時】",
        candidateLines.join("\n")
      ].join("\n"),
    [candidateLines, eventTitle, memoText]
  );

  const codexPack = useMemo(
    () =>
      [
        "# Codex Task Pack",
        "",
        "目的:",
        "調整さんでゲスト打ち合わせ用の日程調整ページを作成してください。",
        "",
        "作成先:",
        "https://chouseisan.com/",
        "",
        "イベント名:",
        eventTitle,
        "",
        "メモ:",
        memoText,
        "",
        "候補日時:",
        candidateLines.join("\n") || "-",
        "",
        "作成後に返してほしいもの:",
        "1. 調整さんURL",
        "2. ゲストさんに送るDM文面",
        "3. 日程確定後にRadio Meeting Schedulerへ記録すべき内容",
        "",
        "注意:",
        "候補日時を勝手に増やさず、上記候補だけで作成してください。"
      ].join("\n"),
    [candidateLines, eventTitle, memoText]
  );

  const guestDm = useMemo(
    () =>
      [
        data.guestName.trim() ? `${data.guestName.trim()}さん` : "こんにちは！",
        "",
        "Sunoパ！ゲスト回の事前打ち合わせ日程を調整させてください。",
        `所要時間は${data.durationMinutes || 30}分ほどで、${data.meetingPlace || "オンライン"}で予定しています。`,
        "",
        "以下のURLから、参加できる日時に○、難しい日時に×、条件つきなら△を入れてもらえると助かります。",
        data.chouseisanUrl || "（調整さんURLをここに貼ります）",
        "",
        "当日は番組の流れ、紹介楽曲、記事掲載内容、NG事項などを軽く確認できればと思っています。",
        "よろしくお願いします！"
      ].join("\n"),
    [data.chouseisanUrl, data.durationMinutes, data.guestName, data.meetingPlace]
  );

  const regenerate = () => {
    update({ candidates: generateCandidates(data) });
  };

  const toggleCandidate = (id) => {
    update({
      candidates: data.candidates.map((candidate) =>
        candidate.id === id ? { ...candidate, enabled: !candidate.enabled } : candidate
      )
    });
  };

  const removeCandidate = (id) => {
    update({ candidates: data.candidates.filter((candidate) => candidate.id !== id) });
  };

  const addTimeSlot = () => {
    const slot = newSlot.trim();
    if (!slot || data.timeSlots.includes(slot)) return;
    update({ timeSlots: [...data.timeSlots, slot].sort() });
  };

  const updateTimeSlot = (index, value) => {
    update({ timeSlots: data.timeSlots.map((slot, slotIndex) => (slotIndex === index ? value : slot)) });
  };

  const removeTimeSlot = (index) => {
    update({ timeSlots: data.timeSlots.filter((_, slotIndex) => slotIndex !== index) });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `radio-meeting-scheduler-${data.broadcastDate || "backup"}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const importJson = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        update({ ...makeDefaultState(), ...parsed });
      } catch {
        alert("JSONを読み込めませんでした。");
      }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  const reset = () => {
    if (!confirm("入力内容を初期状態に戻しますか？")) return;
    const next = makeDefaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setData(next);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">Umbrella Parade Toolkit</span>
          <h1>Radio Meeting Scheduler</h1>
          <p>ゲスト打ち合わせの日程候補、調整さん用コピー、Codex依頼文、DM文面をまとめます。</p>
        </div>
        <div className="header-actions">
          <button className="secondary" onClick={exportJson}>
            <Download size={16} />JSON保存
          </button>
          <label className="secondary file-button">
            <Upload size={16} />JSON読込
            <input type="file" accept="application/json" onChange={importJson} />
          </label>
          <button className="ghost" onClick={reset} title="初期化">
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      <section className="layout">
        <div className="panel">
          <div className="panel-head">
            <h2>打ち合わせ設定</h2>
            <span>{enabledCandidates.length}候補</span>
          </div>
          <div className="form-grid">
            <Field label="放送回タイトル">
              <TextInput value={data.episodeTitle} onChange={(event) => update({ episodeTitle: event.target.value })} />
            </Field>
            <Field label="ゲスト名">
              <TextInput value={data.guestName} onChange={(event) => update({ guestName: event.target.value })} placeholder="例: 結音" />
            </Field>
            <Field label="放送予定日">
              <input type="date" value={data.broadcastDate} onChange={(event) => update({ broadcastDate: event.target.value })} />
            </Field>
            <Field label="所要時間">
              <select value={data.durationMinutes} onChange={(event) => update({ durationMinutes: Number(event.target.value) })}>
                <option value={30}>30分</option>
                <option value={45}>45分</option>
                <option value={60}>60分</option>
              </select>
            </Field>
            <Field label="候補開始">
              <input type="number" min="1" max="30" value={data.leadStartDays} onChange={(event) => update({ leadStartDays: Number(event.target.value) })} />
            </Field>
            <Field label="候補終了">
              <input type="number" min="0" max="30" value={data.leadEndDays} onChange={(event) => update({ leadEndDays: Number(event.target.value) })} />
            </Field>
            <Field label="打ち合わせ場所" wide>
              <TextInput value={data.meetingPlace} onChange={(event) => update({ meetingPlace: event.target.value })} />
            </Field>
          </div>

          <label className="inline-check">
            <input type="checkbox" checked={data.includeWeekends} onChange={(event) => update({ includeWeekends: event.target.checked })} />
            土日も候補に含める
          </label>

          <div className="time-section">
            <div className="subhead">
              <strong>候補時間</strong>
              <span>放送日の{data.leadStartDays}日前から{data.leadEndDays}日前まで</span>
            </div>
            <div className="time-list">
              {data.timeSlots.map((slot, index) => (
                <div className="time-row" key={`${slot}-${index}`}>
                  <input type="time" value={slot} onChange={(event) => updateTimeSlot(index, event.target.value)} />
                  <button className="icon-danger" onClick={() => removeTimeSlot(index)} aria-label="時間を削除">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="time-row">
                <input type="time" value={newSlot} onChange={(event) => setNewSlot(event.target.value)} />
                <button className="secondary" onClick={addTimeSlot}>
                  <Plus size={16} />追加
                </button>
              </div>
            </div>
            <button className="primary" onClick={regenerate}>
              <CalendarDays size={16} />候補日を自動生成
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>候補日時</h2>
            <span>{data.candidates.length}件</span>
          </div>
          <div className="candidate-list">
            {data.candidates.map((candidate) => (
              <div className={candidate.enabled ? "candidate-row" : "candidate-row muted"} key={candidate.id}>
                <label className="candidate-check">
                  <input type="checkbox" checked={candidate.enabled} onChange={() => toggleCandidate(candidate.id)} />
                  <span>{formatJapaneseDate(candidate.date)}</span>
                </label>
                <strong>{candidate.start}-{candidate.end}</strong>
                <button className="icon-danger" onClick={() => removeCandidate(candidate.id)} aria-label="候補を削除">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {data.candidates.length === 0 && <p className="empty">候補日を自動生成してください。</p>}
          </div>
        </div>
      </section>

      <section className="outputs">
        <OutputBlock title="調整さん入力用" text={chouseisanText} copied={copied} copyId="chouseisan" onCopy={copyText} setCopied={setCopied} />
        <OutputBlock title="Codex依頼文" text={codexPack} copied={copied} copyId="codex" onCopy={copyText} setCopied={setCopied} />
        <OutputBlock title="ゲストDM文面" text={guestDm} copied={copied} copyId="dm" onCopy={copyText} setCopied={setCopied} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>決定後の記録</h2>
          <span>次の制作工程へ渡すメモ</span>
        </div>
        <div className="form-grid">
          <Field label="調整さんURL" wide>
            <div className="url-row">
              <TextInput value={data.chouseisanUrl} onChange={(event) => update({ chouseisanUrl: event.target.value })} placeholder="https://chouseisan.com/..." />
              {data.chouseisanUrl && (
                <a className="secondary link-button" href={data.chouseisanUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />開く
                </a>
              )}
            </div>
          </Field>
          <Field label="決定日時">
            <TextInput value={data.decidedAt} onChange={(event) => update({ decidedAt: event.target.value })} placeholder="例: 7/18（土）21:00-21:30" />
          </Field>
          <Field label="ステータス">
            <select value={data.decidedAt ? "fixed" : data.chouseisanUrl ? "waiting" : "draft"} readOnly>
              <option value="draft">候補作成中</option>
              <option value="waiting">回答待ち</option>
              <option value="fixed">日程決定</option>
            </select>
          </Field>
          <Field label="打ち合わせメモ" wide>
            <textarea value={data.meetingNotes} onChange={(event) => update({ meetingNotes: event.target.value })} placeholder="確認したいこと、当日の議題、決定事項など" />
          </Field>
        </div>
      </section>
    </main>
  );
}

function OutputBlock({ title, text, copied, copyId, onCopy, setCopied }) {
  return (
    <article className="output-block">
      <div className="output-head">
        <h2>{title}</h2>
        <button className="secondary" onClick={() => onCopy(text, copyId, setCopied)}>
          {copied === copyId ? <Check size={16} /> : <ClipboardCopy size={16} />}
          {copied === copyId ? "コピー済み" : "コピー"}
        </button>
      </div>
      <textarea readOnly value={text} />
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
