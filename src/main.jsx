import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  Guitar,
  MapPin,
  MessageSquareText,
  Music2,
  Pencil,
  Plus,
  Radio,
  RefreshCcw,
  Share2,
  Settings,
  Trash2,
  Upload,
  X
} from "lucide-react";
import "./styles.css";
import {
  addDays,
  addMinutes,
  candidateId,
  formatCandidateLabel,
  formatCandidateTime,
  formatInputDate,
  formatJapaneseDate
} from "./lib.js";
import { apiConfigured, createEvent, decideEvent, fetchEvent, updateEvent } from "./api.js";
import GuestApp from "./guest.jsx";
import ResponseTable from "./ResponseTable.jsx";
import { initialMode, shareUrlFor, startEmbedBridge } from "./embedding.js";
import StudioSettings, { StudioLinks } from "./StudioSettings.jsx";
import { normalizeStudios, safeWebUrl, studioLinkLines, studioSelection, venueLinkLines } from "./studios.js";
import BandDatePicker from "./BandDatePicker.jsx";
import { generateCandidates, getBandSelectedDates, getDefaultCandidateRange, normalizeCandidateRange, summarizeCandidateDates, updateBandSelectedDates } from "./scheduling.js";

const STORAGE_KEY = "radio-meeting-scheduler:v1";
const ACTIVE_MODE_KEY = "meeting-scheduler:active-mode";
const BAND_VIEW_KEY = "meeting-scheduler:band-view";
const BAND_DURATION_OPTIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 60);

function isBandScheduleMode(mode) {
  return mode === "band" || mode === "live";
}

function storageKeyFor(mode) {
  if (mode === "band") return "band-meeting-scheduler:v1";
  if (mode === "live") return "band-live-scheduler:v1";
  return STORAGE_KEY;
}

const BAND_DM_TEMPLATE = [
  "みんな、お疲れさま！",
  "",
  "次のスタジオリハの日程を合わせたいので、参加できる日時を教えてください。",
  "所要時間は{durationHours}時間、スタジオ場所は{studioPlace}を予定しています。",
  "",
  "以下のURLから、候補日時の出欠を入力してもらえると助かります。",
  "{scheduleUrl}",
  "",
  "参加できる日時は○、条件つきなら△、難しい日時は×でお願いします。",
  "遅れて参加する場合や希望のスタジオがあれば、コメントに書いてね。",
  "みんなの回答がそろったら、日程とスタジオを決めましょう！",
  "よろしくお願いします！"
].join("\n");

const BAND_DM_PRESETS = [
  { id: "basic", name: "基本のスタジオリハ連絡", body: BAND_DM_TEMPLATE },
  {
    id: "friendly",
    name: "短めのメンバー向け連絡",
    body: [
      "みんな、お疲れさま！次のスタジオリハ、いつなら集まれそう？",
      "{durationHours}時間、場所は{studioPlace}の予定です。",
      "",
      "ここに出欠を入れてね。",
      "{scheduleUrl}",
      "",
      "途中参加やスタジオの希望はコメントで教えてください。よろしく！"
    ].join("\n")
  }
];

const BAND_TEMPLATE_BLOCKS = [
  {
    id: "rehearsal-topics",
    name: "リハで合わせたいこと",
    body: "当日は、曲の構成・テンポ・入りと終わり方を確認して、通しで合わせられればと思っています。"
  },
  {
    id: "studio-requests",
    name: "スタジオ・機材の希望",
    body: "希望のスタジオや必要なレンタル機材があれば教えてください。遅れて参加・早めに退出する場合も、コメントに時間を書いてもらえると助かります。"
  }
];

const BAND_TEMPLATE_BLOCK_IDS = new Set(BAND_TEMPLATE_BLOCKS.map((block) => block.id));
const BAND_TEMPLATE_VARIABLES = ["{studioDate}", "{durationHours}", "{studioPlace}", "{studioUrl}", "{studioAccessUrl}", "{scheduleUrl}", "{candidateList}"];

const LIVE_DM_TEMPLATE = [
  "みんな、お疲れさま！",
  "",
  "ライブ出演の候補日について、参加できる日を教えてください。",
  "ライブハウスは{livehouseName}を予定しています。",
  "",
  "以下のURLから、候補日の出欠を入力してください。",
  "{scheduleUrl}",
  "",
  "出演できる日は○、条件つきなら△、難しい日は×でお願いします。",
  "入り時間など確認したいことがあれば、コメントに書いてください。",
  "よろしくお願いします！"
].join("\n");

const LIVE_DM_PRESETS = [
  { id: "basic", name: "基本のライブ日程連絡", body: LIVE_DM_TEMPLATE },
  {
    id: "friendly",
    name: "短めのライブ日程連絡",
    body: [
      "みんな、お疲れさま！このライブ候補日、出演できそうな日を教えてください。",
      "会場は{livehouseName}の予定です。",
      "",
      "ここに出欠を入れてね。",
      "{scheduleUrl}",
      "",
      "条件がある場合は△とコメントで教えてください。よろしく！"
    ].join("\n")
  }
];

const LIVE_TEMPLATE_BLOCKS = [
  {
    id: "live-details",
    name: "ライブ詳細は確認中",
    body: "出演時間・持ち時間・集合時間などの詳細は、決まり次第あらためて共有します。"
  },
  {
    id: "live-conditions",
    name: "出演条件の確認",
    body: "出演できるものの時間や移動に条件がある場合は、△を選んでコメントに書いてもらえると助かります。"
  }
];

const LIVE_TEMPLATE_BLOCK_IDS = new Set(LIVE_TEMPLATE_BLOCKS.map((block) => block.id));
const LIVE_TEMPLATE_VARIABLES = ["{liveDate}", "{livehouseName}", "{livehouseUrl}", "{livehouseAccessUrl}", "{scheduleUrl}", "{candidateList}"];

const DEFAULT_DM_TEMPLATE = [
  "こんばんは！{guestNameWithSuffix}",
  "",
  "Sunoパ！ゲスト回の事前打ち合わせ日程を調整させてください。",
  "所要時間は{durationMinutes}分ほどで、{meetingPlace}で予定しています。",
  "",
  "以下のURLから、ご都合の良い日時を入力してもらえると助かります。",
  "{scheduleUrl}",
  "",
  "当日は番組の流れ、紹介楽曲、記事掲載内容、NG事項などを軽く確認できればと思っています。",
  "よろしくお願いします！"
].join("\n");

const DEFAULT_TEMPLATE_BLOCKS = [
  {
    id: "meeting-topics",
    name: "打ち合わせ内容",
    body: [
      "打ち合わせでは、以下を軽く確認できればと思っています。",
      "・番組全体の流れ",
      "・紹介する楽曲や活動内容",
      "・記事やSNSで触れてOKな内容",
      "・触れないでほしい話題や表記の注意点"
    ].join("\n")
  },
  {
    id: "broadcast-flow",
    name: "当日の仮配信フロー",
    body: [
      "当日の流れは仮でこんなイメージです。",
      "1. オープニングとゲスト紹介",
      "2. 活動や制作についてのお話",
      "3. 紹介楽曲の話",
      "4. 告知や今後の予定",
      "5. エンディング"
    ].join("\n")
  }
];

const DEFAULT_TEMPLATE_BLOCK_IDS = new Set(DEFAULT_TEMPLATE_BLOCKS.map((block) => block.id));

const DEFAULT_DM_PRESETS = [
  {
    id: "basic",
    name: "基本の打ち合わせDM",
    body: DEFAULT_DM_TEMPLATE
  },
  {
    id: "friendly",
    name: "少しやわらかめ",
    body: [
      "こんばんは！{guestNameWithSuffix}",
      "",
      "ゲスト回の件、ありがとうございます！",
      "放送前に一度、{durationMinutes}分ほど軽く打ち合わせできればと思っています。",
      "",
      "候補はこちらです。",
      "{scheduleUrl}",
      "",
      "番組の流れや紹介内容、触れない方がいいことなどを確認できれば大丈夫です。",
      "よろしくお願いします！"
    ].join("\n")
  }
];

const DEFAULT_DM_PRESET_IDS = new Set(DEFAULT_DM_PRESETS.map((preset) => preset.id));

const TEMPLATE_VARIABLES = [
  "{guestName}",
  "{guestNameWithSuffix}",
  "{episodeTitle}",
  "{broadcastDate}",
  "{durationMinutes}",
  "{meetingPlace}",
  "{scheduleUrl}",
  "{candidateList}"
];

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeDefaultState(mode = "radio") {
  const isBand = isBandScheduleMode(mode);
  const isLive = mode === "live";
  const broadcastDate = formatInputDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const candidateRange = getDefaultCandidateRange(broadcastDate, mode);
  const state = {
    mode,
    episodeTitle: isBand ? "" : "Sunoパ！ゲスト回",
    guestName: "",
    broadcastDate,
    ...candidateRange,
    ...(isBand ? { selectedDates: [broadcastDate] } : {}),
    includeWeekends: true,
    durationMinutes: isLive ? 0 : isBand ? 180 : 30,
    timeSlots: isLive ? [] : isBand ? ["18:00", "19:00", "20:00"] : ["20:00", "21:00", "22:00"],
    candidates: [],
    scheduleUrl: "",
    share: null,
    decidedAt: "",
    meetingPlace: isBand ? "" : "オンライン（Discord / Zoomなど）",
    studios: [],
    livehouses: [],
    studioId: "",
    studioUrl: "",
    studioAccessUrl: "",
    meetingNotes: "",
    guestDmDraft: isLive ? LIVE_DM_TEMPLATE : isBand ? BAND_DM_TEMPLATE : DEFAULT_DM_TEMPLATE,
    templateBlocks: [],
    dmPresets: []
  };
  return { ...state, candidates: generateCandidates(state) };
}

function normalizeState(input = {}, mode = "radio") {
  const base = makeDefaultState(mode);
  const next = { ...base, ...input, mode };
  const isBand = isBandScheduleMode(mode);
  const isLive = mode === "live";
  if (mode === "band" && !BAND_DURATION_OPTIONS.includes(Number(next.durationMinutes))) {
    next.durationMinutes = 180;
  }
  if (isLive) {
    next.durationMinutes = 0;
    next.timeSlots = [];
  }
  const fallbackRange = getDefaultCandidateRange(next.broadcastDate, mode);
  if (!next.candidateStartDate && next.broadcastDate) {
    next.candidateStartDate = isBand ? fallbackRange.candidateStartDate : addDays(next.broadcastDate, -Number(next.leadStartDays || 7));
  }
  if (!next.candidateEndDate && next.broadcastDate) {
    next.candidateEndDate = isBand ? fallbackRange.candidateEndDate : addDays(next.broadcastDate, -Number(next.leadEndDays || 1));
  }
  delete next.leadStartDays;
  delete next.leadEndDays;
  if (isBand) next.selectedDates = getBandSelectedDates({ ...next, selectedDates: input.selectedDates, candidates: input.candidates });
  if (!Array.isArray(next.candidates)) next.candidates = generateCandidates(next);
  if (isLive) {
    next.candidates = next.candidates.map((candidate) => ({
      ...candidate,
      id: `${candidate.date}-live`,
      start: "",
      end: ""
    }));
  }
  if (next.share && !next.share.id) next.share = null;
  const legacyScheduleUrlKey = ["chousei", "sanUrl"].join("");
  if (!next.scheduleUrl && next[legacyScheduleUrlKey]) next.scheduleUrl = next[legacyScheduleUrlKey];
  delete next[legacyScheduleUrlKey];
  if (typeof next.guestDmDraft !== "string") next.guestDmDraft = base.guestDmDraft;
  if (!Array.isArray(next.templateBlocks)) next.templateBlocks = [];
  if (!Array.isArray(next.dmPresets)) next.dmPresets = [];
  next.studios = normalizeStudios(next.studios);
  next.livehouses = normalizeStudios(next.livehouses);
  next.studioUrl = safeWebUrl(next.studioUrl);
  next.studioAccessUrl = safeWebUrl(next.studioAccessUrl);
  return next;
}

function loadState(mode) {
  try {
    const raw = localStorage.getItem(storageKeyFor(mode));
    if (!raw) return makeDefaultState(mode);
    return normalizeState(JSON.parse(raw), mode);
  } catch {
    return makeDefaultState(mode);
  }
}

function copyText(text, label, setCopied) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  });
}

function renderTemplate(template, data, candidateLines) {
  const guestName = String(data.guestName || "").trim();
  const values = {
    guestName: guestName || "ゲスト",
    guestNameWithSuffix: guestName ? `${guestName}さん` : "ゲストさん",
    episodeTitle: data.episodeTitle || "Sunoパ！ゲスト回",
    broadcastDate: formatJapaneseDate(data.broadcastDate) || "未定",
    durationMinutes: String(data.durationMinutes || 30),
    durationHours: String(Number(data.durationMinutes || 180) / 60),
    studioDate: data.studioDateLabel || formatJapaneseDate(data.broadcastDate) || "未定",
    studioPlace: data.meetingPlace || "未定",
    studioUrl: safeWebUrl(data.studioUrl),
    studioAccessUrl: safeWebUrl(data.studioAccessUrl),
    liveDate: data.studioDateLabel || formatJapaneseDate(data.broadcastDate) || "未定",
    livehouseName: data.meetingPlace || "未定",
    livehouseUrl: safeWebUrl(data.studioUrl),
    livehouseAccessUrl: safeWebUrl(data.studioAccessUrl),
    meetingPlace: data.meetingPlace || "オンライン",
    scheduleUrl: data.scheduleUrl || "（共有ページを作成するとURLが入ります）",
    candidateList: candidateLines.length ? candidateLines.join("\n") : data.mode === "live" ? "（候補日を選んでください）" : "（候補日時を生成してください）"
  };
  return String(template || "").replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}\}?/g, (match, key) => values[key] ?? match);
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

function SharePanel({ data, update, eventTitle, memoText, enabledCandidates, copied, setCopied }) {
  const isLive = data.mode === "live";
  const isBand = isBandScheduleMode(data.mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(null); // {event, responses}
  const [decideTarget, setDecideTarget] = useState("");
  const [updated, setUpdated] = useState(false);

  const shareUrl = data.share?.id ? shareUrlFor(data.share.id, data.mode) : "";

  const createShare = async () => {
    if (enabledCandidates.length === 0) {
      alert(`${isLive ? "候補日" : "候補日時"}がありません。先に候補日を設定してください。`);
      return;
    }
    if (data.share?.id && !confirm("すでに共有ページがあります。新しく作り直しますか？（今までの回答は新しいページに引き継がれません）")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await createEvent({
        title: eventTitle,
        memo: memoText,
        candidates: enabledCandidates.map(({ id, date, start, end }) => ({ id, date, start, end }))
      });
      update({ share: { id: result.id, adminKey: result.adminKey } });
      setLive(null);
    } catch (err) {
      setError(err.message || "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!data.share?.id) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetchEvent(data.share.id);
      setLive({ event: result.event, responses: result.responses || [] });
    } catch (err) {
      setError(err.message || "取得に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const updateShare = async () => {
    if (!data.share?.id) return;
    if (enabledCandidates.length === 0) {
      alert(`${isLive ? "候補日" : "候補日時"}がありません。先に候補日を設定してください。`);
      return;
    }
    setBusy(true);
    setError("");
    setUpdated(false);
    try {
      await updateEvent({
        id: data.share.id,
        adminKey: data.share.adminKey,
        title: eventTitle,
        memo: memoText,
        candidates: enabledCandidates.map(({ id, date, start, end }) => ({ id, date, start, end }))
      });
      setUpdated(true);
      await refresh();
    } catch (err) {
      setError(err.message || "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    if (!data.share?.id || !decideTarget) return;
    const candidate = (live?.event?.candidates || []).find((item) => item.id === decideTarget);
    const label = candidate ? formatCandidateLabel(candidate) : decideTarget;
    setBusy(true);
    setError("");
    try {
      await decideEvent({ id: data.share.id, adminKey: data.share.adminKey, decidedAt: label });
      update({ decidedAt: label });
      await refresh();
    } catch (err) {
      setError(err.message || "決定の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>共有調整ページ</h2>
        <span>{isBand ? "メンバーの出欠" : "ゲストさんの出欠"}</span>
      </div>

      {!apiConfigured() && (
        <p className="hint setup-hint">
          この機能を使うにはGASバックエンドの設定が必要です。リポジトリの <code>gas/README.md</code>{" "}
          の手順（約5分）でデプロイし、<code>src/config.js</code> にURLを設定してください。
        </p>
      )}

      {error && <p className="error-banner">{error}</p>}

      {!data.share?.id ? (
        <button className="primary" onClick={createShare} disabled={busy || !apiConfigured()}>
          <Share2 size={16} />
          {busy ? "作成中..." : "共有ページを作成"}
        </button>
      ) : (
        <>
          <div className="url-row share-url-row">
            <TextInput value={shareUrl} readOnly />
            <button className="secondary" onClick={() => copyText(shareUrl, "share-url", setCopied)}>
              {copied === "share-url" ? <Check size={16} /> : <ClipboardCopy size={16} />}
              {copied === "share-url" ? "コピー済み" : "URLコピー"}
            </button>
            <a className="secondary link-button" href={shareUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />開く
            </a>
          </div>

          <div className="share-actions">
            <button className="secondary" onClick={refresh} disabled={busy}>
              <RefreshCcw size={16} />
              {busy ? "取得中..." : "回答状況を更新"}
            </button>
            <button className="secondary" onClick={updateShare} disabled={busy} title={`URLはそのまま、${isLive ? "候補日" : "候補日時"}を今の内容に置き換えます`}>
              <CalendarDays size={16} />
              {updated ? "候補を更新しました！" : "今の候補で共有ページを更新"}
            </button>
            <button className="ghost" onClick={createShare} disabled={busy} title="URLを新しくして最初から作り直します">
              <Share2 size={16} />作り直す
            </button>
          </div>
          <p className="hint">
            {isLive ? "候補日を変えたら" : "日付や時間を変えたら"}「今の候補で共有ページを更新」。URLは変わらず、届いている回答も残ります。
          </p>

          {live && (
            <>
              <ResponseTable
                candidates={live.event.candidates}
                responses={live.responses}
                decidedCandidateId={decideTarget}
                candidateHeading={isLive ? "候補日" : "候補日時"}
              />
              <div className="decide-row">
                <select value={decideTarget} onChange={(event) => setDecideTarget(event.target.value)}>
                  <option value="">日程を選んで決定...</option>
                  {live.event.candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {formatCandidateLabel(candidate)}
                    </option>
                  ))}
                </select>
                <button className="primary" onClick={decide} disabled={busy || !decideTarget}>
                  <Check size={16} />{isLive ? "この日に決定" : "この日時に決定"}
                </button>
              </div>
              {live.event.decidedAt && (
                <p className="decided-banner">
                  <Check size={16} />決定済み: <strong>{live.event.decidedAt}</strong>
                  （回答ページにも表示されます）
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

const WORKSPACE_TABS = [
  { id: "band", label: "バンド", Icon: Guitar },
  { id: "radio", label: "ラジオ", Icon: Radio },
  { id: "settings", label: "設定", Icon: Settings }
];

const BAND_SCHEDULE_TABS = [
  { id: "band", label: "スタジオリハ日程", Icon: Guitar },
  { id: "live", label: "ライブ日程", Icon: Music2 }
];

const SETTINGS_TABS = [
  { id: "studios", label: "スタジオ登録", Icon: Guitar },
  { id: "livehouses", label: "ライブハウス登録", Icon: MapPin }
];

function ModeTabs({ mode, onModeChange }) {
  return <div className="mode-tabs" role="tablist" aria-label="スケジュールと設定">
    {WORKSPACE_TABS.map(({ id, label, Icon }, index) => <button
      key={id} id={`mode-tab-${id}`} role="tab" aria-selected={mode === id}
      aria-controls="schedule-workspace" tabIndex={mode === id ? 0 : -1}
      onClick={() => onModeChange(id)}
      onKeyDown={(event) => {
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? WORKSPACE_TABS.length - 1 :
          event.key === "ArrowRight" ? (index + 1) % WORKSPACE_TABS.length :
          event.key === "ArrowLeft" ? (index + WORKSPACE_TABS.length - 1) % WORKSPACE_TABS.length : -1;
        if (nextIndex < 0) return;
        event.preventDefault();
        const nextMode = WORKSPACE_TABS[nextIndex].id;
        onModeChange(nextMode);
        requestAnimationFrame(() => document.getElementById(`mode-tab-${nextMode}`)?.focus());
      }}><Icon size={20} />{label}</button>)}
  </div>;
}

function SubTabs({ tabs, value, onChange, label, idPrefix }) {
  return <div className="sub-tabs" role="tablist" aria-label={label}>
    {tabs.map(({ id, label: tabLabel, Icon }, index) => <button
      key={id}
      id={`${idPrefix}-tab-${id}`}
      role="tab"
      aria-selected={value === id}
      tabIndex={value === id ? 0 : -1}
      onClick={() => onChange(id)}
      onKeyDown={(event) => {
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
          event.key === "ArrowRight" ? (index + 1) % tabs.length :
          event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
        if (nextIndex < 0) return;
        event.preventDefault();
        const nextValue = tabs[nextIndex].id;
        onChange(nextValue);
        requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${nextValue}`)?.focus());
      }}
    ><Icon size={18} />{tabLabel}</button>)}
  </div>;
}

function SchedulerWorkspace({ mode, data, update, onModeChange, onBandModeChange, onImport, studios, livehouses }) {
  const isBand = isBandScheduleMode(mode);
  const isLive = mode === "live";
  const isRehearsal = mode === "band";
  const registeredVenues = isLive ? livehouses : studios;
  const defaultTemplate = isLive ? LIVE_DM_TEMPLATE : isRehearsal ? BAND_DM_TEMPLATE : DEFAULT_DM_TEMPLATE;
  const defaultBlocks = isLive ? LIVE_TEMPLATE_BLOCKS : isRehearsal ? BAND_TEMPLATE_BLOCKS : DEFAULT_TEMPLATE_BLOCKS;
  const defaultBlockIds = isLive ? LIVE_TEMPLATE_BLOCK_IDS : isRehearsal ? BAND_TEMPLATE_BLOCK_IDS : DEFAULT_TEMPLATE_BLOCK_IDS;
  const defaultPresets = isLive ? LIVE_DM_PRESETS : isRehearsal ? BAND_DM_PRESETS : DEFAULT_DM_PRESETS;
  const [copied, setCopied] = useState("");
  const [newSlot, setNewSlot] = useState("19:30");
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockBody, setNewBlockBody] = useState("");
  const [editingBlockId, setEditingBlockId] = useState("");
  const [editingBlockName, setEditingBlockName] = useState("");
  const [editingBlockBody, setEditingBlockBody] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("basic");

  const enabledCandidates = useMemo(
    () => data.candidates.filter((candidate) => candidate.enabled),
    [data.candidates]
  );

  const candidateRange = useMemo(() => normalizeCandidateRange(data), [data]);

  const eventTitle = useMemo(() => {
    if (isLive) return "バンド ライブ日程";
    if (isRehearsal) return "バンド スタジオリハ";
    const guest = data.guestName.trim() ? `${data.guestName.trim()}さん` : "ゲストさん";
    return `${data.episodeTitle || "Sunoパ！"} ${guest} 事前打ち合わせ`;
  }, [data.episodeTitle, data.guestName, isLive, isRehearsal]);

  const candidateLines = useMemo(
    () => enabledCandidates.map((candidate) => formatCandidateLabel(candidate)),
    [enabledCandidates]
  );

  const bandDateSummary = useMemo(
    () => isBand ? summarizeCandidateDates(enabledCandidates) : "",
    [enabledCandidates, isBand]
  );

  const templateBlocks = useMemo(() => {
    const savedBlocks = data.templateBlocks || [];
    const savedById = new Map(savedBlocks.map((block) => [block.id, block]));
    const mergedDefaults = defaultBlocks.map((block) => ({ ...block, ...savedById.get(block.id) }));
    const customBlocks = savedBlocks.filter((block) => !defaultBlockIds.has(block.id));
    return [...mergedDefaults, ...customBlocks];
  }, [data.templateBlocks, defaultBlocks, defaultBlockIds]);
  const dmPresets = useMemo(() => {
    const savedPresets = data.dmPresets || [];
    const savedById = new Map(savedPresets.map((preset) => [preset.id, preset]));
    const mergedDefaults = defaultPresets.map((preset) => ({ ...preset, ...savedById.get(preset.id) }));
    const customPresets = savedPresets.filter((preset) => !DEFAULT_DM_PRESET_IDS.has(preset.id));
    return [...mergedDefaults, ...customPresets];
  }, [data.dmPresets, defaultPresets]);
  const selectedPreset = dmPresets.find((preset) => preset.id === selectedPresetId) ?? dmPresets[0];
  const selectedSavedPreset = (data.dmPresets || []).find((preset) => preset.id === selectedPresetId);

  const memoText = useMemo(
    () => {
      if (isLive) return [
        `ライブハウス: ${data.meetingPlace || "未定"}`,
        ...venueLinkLines(data, "livehouse"),
        "ライブ出演の日程を調整します。出演できる候補日を教えてください。",
        "出演できる日に○、難しい日に×、条件つきなら△でお願いします。",
        bandDateSummary ? `ライブ候補日: ${bandDateSummary}` : ""
      ].filter(Boolean).join("\n");
      if (isRehearsal) return [
        `スタジオリハの所要時間は${data.durationMinutes / 60}時間です。`,
        `スタジオ場所: ${data.meetingPlace || "未定"}`,
        ...studioLinkLines(data),
        "次のスタジオリハ、みんなが集まれる日を教えてください。途中参加や希望のスタジオがあればコメントにお願いします。",
        "参加できる日時に○、難しい日時に×、条件つきなら△でお願いします。",
        bandDateSummary ? `スタジオ候補日: ${bandDateSummary}` : ""
      ].filter(Boolean).join("\n");
      return [
        `所要時間は${data.durationMinutes || 30}分ほどです。`,
        `場所: ${data.meetingPlace || "オンライン"}`,
        "番組の流れ、紹介楽曲、記事掲載内容、NG事項の確認をします。",
        "参加できる日時に○、難しい日時に×、条件つきなら△でお願いします。",
        data.broadcastDate ? `放送予定日: ${formatJapaneseDate(data.broadcastDate)}` : ""
      ].filter(Boolean).join("\n");
    },
    [bandDateSummary, data.broadcastDate, data.durationMinutes, data.meetingPlace, data.studioUrl, data.studioAccessUrl, isLive, isRehearsal]
  );

  const shareUrl = data.share?.id ? shareUrlFor(data.share.id, mode) : "";
  const scheduleUrl = shareUrl || data.scheduleUrl || "";
  const templateData = useMemo(
    () => ({ ...data, scheduleUrl, ...(isBand ? { studioDateLabel: bandDateSummary } : {}) }),
    [bandDateSummary, data, isBand, scheduleUrl]
  );

  const codexPack = useMemo(
    () =>
      [
        "# Codex Task Pack",
        "",
        "目的:",
        isLive ? "バンドのライブ出演候補日とメンバー向けの連絡文面を整えてください。" : isRehearsal ? "バンドのスタジオリハの日程候補とメンバー向けの連絡文面を整えてください。" : "Radio Meeting Schedulerでゲスト打ち合わせの日程候補とDM文面を整えてください。",
        "",
        "日程調整URL:",
        scheduleUrl || "（未設定）",
        "",
        "イベント名:",
        eventTitle,
        "",
        "メモ:",
        memoText,
        "",
        isLive ? "候補日:" : "候補日時:",
        candidateLines.join("\n") || "-",
        "",
        isBand ? "メンバーへの連絡文面:" : "ゲストDM文面:",
        renderTemplate(data.guestDmDraft, templateData, candidateLines),
        "",
        "作成後に返してほしいもの:",
        isBand ? "1. メンバーに送る連絡文面" : "1. ゲストさんに送るDM文面",
        isLive ? "2. ライブ日程確定後に記録すべき内容" : isRehearsal ? "2. スタジオリハ確定後に記録すべき内容" : "2. 日程確定後にRadio Meeting Schedulerへ記録すべき内容",
        "",
        "注意:",
        `${isLive ? "候補日" : "候補日時"}を勝手に増やさず、上記候補だけで作成してください。`
      ].join("\n"),
    [candidateLines, data.guestDmDraft, eventTitle, memoText, scheduleUrl, templateData, isBand, isLive, isRehearsal]
  );

  const guestDm = useMemo(() => {
    const body = renderTemplate(data.guestDmDraft, templateData, candidateLines);
    const links = isBand
      ? venueLinkLines(data, isLive ? "livehouse" : "studio").filter((line) => !body.includes(line.slice(line.indexOf(": ") + 2)))
      : [];
    return [body, links.join("\n")].filter(Boolean).join("\n\n");
  }, [candidateLines, data, templateData, isBand, isLive]);
  const candidateCopyText = useMemo(() => candidateLines.join("\n") || `${isLive ? "候補日" : "候補日時"}がまだありません。`, [candidateLines, isLive]);

  const regenerate = () => {
    update({ candidates: generateCandidates(data) });
  };

  const updateBroadcastDate = (broadcastDate) => {
    update({ broadcastDate, ...(isBand ? {} : getDefaultCandidateRange(broadcastDate, mode)) });
  };

  const resetCandidateRange = () => {
    update(getDefaultCandidateRange(data.broadcastDate, mode));
  };

  const updateDuration = (durationMinutes) => {
    update({
      durationMinutes,
      ...(isRehearsal ? {
        candidates: data.candidates.map((candidate) => ({
          ...candidate,
          id: candidateId(candidate.date, candidate.start, durationMinutes),
          end: addMinutes(candidate.start, durationMinutes)
        }))
      } : {})
    });
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

  const insertBlock = (block) => {
    if (!block?.body) return;
    const current = data.guestDmDraft || "";
    update({ guestDmDraft: `${current}${current.trim() ? "\n\n" : ""}${block.body}` });
  };

  const saveTemplateBlock = () => {
    const name = newBlockName.trim();
    const body = newBlockBody.trim();
    if (!name || !body) return;
    update({
      templateBlocks: [
        ...(data.templateBlocks || []),
        {
          id: newId("block"),
          name,
          body
        }
      ]
    });
    setNewBlockName("");
    setNewBlockBody("");
  };

  const startEditTemplateBlock = (block) => {
    setEditingBlockId(block.id);
    setEditingBlockName(block.name);
    setEditingBlockBody(block.body);
  };

  const cancelEditTemplateBlock = () => {
    setEditingBlockId("");
    setEditingBlockName("");
    setEditingBlockBody("");
  };

  const saveEditedTemplateBlock = () => {
    const name = editingBlockName.trim();
    const body = editingBlockBody.trim();
    if (!editingBlockId || !name || !body) return;
    const savedBlocks = data.templateBlocks || [];
    const editedBlock = { id: editingBlockId, name, body };
    const exists = savedBlocks.some((block) => block.id === editingBlockId);
    update({
      templateBlocks: exists
        ? savedBlocks.map((block) => (block.id === editingBlockId ? editedBlock : block))
        : [...savedBlocks, editedBlock]
    });
    cancelEditTemplateBlock();
  };

  const removeTemplateBlock = (id) => {
    update({ templateBlocks: (data.templateBlocks || []).filter((block) => block.id !== id) });
    if (editingBlockId === id) cancelEditTemplateBlock();
  };

  const applyDmPreset = (preset) => {
    if (!preset) return;
    setSelectedPresetId(preset.id);
    update({ guestDmDraft: preset.body });
  };

  const saveDmPreset = () => {
    const body = String(data.guestDmDraft || "").trim();
    if (!body) return;
    const customPresetCount = (data.dmPresets || []).filter((preset) => !DEFAULT_DM_PRESET_IDS.has(preset.id)).length;
    const name = newPresetName.trim() || `DMプリセット ${customPresetCount + 1}`;
    const preset = {
      id: newId("dm"),
      name,
      body: data.guestDmDraft
    };
    update({ dmPresets: [preset, ...(data.dmPresets || [])] });
    setSelectedPresetId(preset.id);
    setNewPresetName("");
  };

  const overwriteDmPreset = () => {
    if (!selectedPreset) return;
    const savedPresets = data.dmPresets || [];
    const nextPreset = {
      id: selectedPreset.id,
      name: newPresetName.trim() || selectedPreset.name,
      body: data.guestDmDraft
    };
    const exists = savedPresets.some((preset) => preset.id === selectedPreset.id);
    update({
      dmPresets: exists
        ? savedPresets.map((preset) => (preset.id === selectedPreset.id ? nextPreset : preset))
        : [nextPreset, ...savedPresets]
    });
    setNewPresetName("");
  };

  const removeDmPreset = () => {
    if (!selectedSavedPreset) return;
    update({ dmPresets: (data.dmPresets || []).filter((preset) => preset.id !== selectedSavedPreset.id) });
    if (!DEFAULT_DM_PRESET_IDS.has(selectedSavedPreset.id)) setSelectedPresetId("basic");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${mode}-meeting-scheduler-${data.broadcastDate || "backup"}.json`;
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
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid backup");
        const importedMode = parsed.mode === "live" ? "live" : parsed.mode === "band" ? "band" : "radio";
        const next = normalizeState(parsed, importedMode);
        if (!Array.isArray(parsed.studios)) delete next.studios;
        if (!Array.isArray(parsed.livehouses)) delete next.livehouses;
        onImport(next, importedMode);
      } catch {
        alert("JSONを読み込めませんでした。");
      }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  const reset = () => {
    const scheduleName = isLive ? "ライブ日程" : isRehearsal ? "スタジオリハ日程" : "ラジオ";
    if (!confirm(`${scheduleName}の入力内容を初期状態に戻しますか？`)) return;
    update({ ...makeDefaultState(mode), studios: data.studios, livehouses: data.livehouses });
  };

  return (
    <main className={`app-shell ${isBand ? "band-mode" : "radio-mode"} ${isLive ? "live-mode" : ""}`}>
      <header className="app-header">
        <div>
          <span className="eyebrow">Umbrella Parade Toolkit</span>
          <h1>{isBand ? "Band Schedule" : "Radio Meeting Scheduler"}</h1>
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

      <ModeTabs mode={isBand ? "band" : mode} onModeChange={onModeChange} />
      {isBand && <SubTabs
        tabs={BAND_SCHEDULE_TABS}
        value={mode}
        onChange={onBandModeChange}
        label="バンド日程の種類"
        idPrefix="band-schedule"
      />}

      <div id="schedule-workspace" role="tabpanel" aria-labelledby={isBand ? `band-schedule-tab-${mode}` : `mode-tab-${mode}`}>
      <section className="layout">
        <div className="panel">
          <div className="panel-head">
            <h2>{isLive ? "バンド ライブ日程" : isRehearsal ? "バンド スタジオリハ" : "打ち合わせ設定"}</h2>
            <span>{enabledCandidates.length}候補</span>
          </div>
          <div className="form-grid">
            {!isBand && (
              <>
                <Field label="放送回タイトル">
                  <TextInput value={data.episodeTitle} onChange={(event) => update({ episodeTitle: event.target.value })} />
                </Field>
                <Field label="ゲスト名">
                  <TextInput value={data.guestName} onChange={(event) => update({ guestName: event.target.value })} placeholder="例: ヴェル13世" />
                </Field>
              </>
            )}
            <Field label={isLive ? "ライブ予定日" : isRehearsal ? "スタジオ予定日" : "放送予定日"}>
              <input type="date" value={data.broadcastDate} onChange={(event) => updateBroadcastDate(event.target.value)} />
            </Field>
            {!isLive && <Field label="所要時間">
              <select value={data.durationMinutes} onChange={(event) => updateDuration(Number(event.target.value))}>
                {isRehearsal ? BAND_DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes / 60}時間</option>
                )) : (
                  <>
                    <option value={30}>30分</option>
                    <option value={45}>45分</option>
                    <option value={60}>60分</option>
                  </>
                )}
              </select>
            </Field>}
            {isBand ? <BandDatePicker selectedDates={data.selectedDates} broadcastDate={data.broadcastDate} onChange={(dates) => update(updateBandSelectedDates(data, dates))} type={isLive ? "live" : "rehearsal"} /> : <>
            <Field label="候補開始日">
              <input type="date" value={data.candidateStartDate || ""} onChange={(event) => update({ candidateStartDate: event.target.value })} />
            </Field>
            <Field label="候補終了日">
              <input type="date" value={data.candidateEndDate || ""} onChange={(event) => update({ candidateEndDate: event.target.value })} />
            </Field>
            <div className="range-actions wide">
              <p className="hint">候補にしたい日付をそのまま選びます。放送日を変更すると、いったん1週間前から前日までに戻ります。</p>
              <button className="secondary" onClick={resetCandidateRange}>
                <CalendarDays size={16} />1週間前から前日にする
              </button>
            </div>
            </>}
            {isBand && <Field label={isLive ? "登録済みライブハウス" : "登録済みスタジオ"} wide>
              <select value={registeredVenues.some((venue) => venue.id === data.studioId) ? data.studioId : ""} onChange={(event) => update(studioSelection(registeredVenues.find((venue) => venue.id === event.target.value)))}>
                <option value="">未定・直接入力</option>
                {registeredVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </select>
            </Field>}
            <Field label={isLive ? "ライブハウス" : isRehearsal ? "スタジオ場所" : "打ち合わせ場所"} wide>
              <TextInput value={data.meetingPlace} readOnly={isBand && registeredVenues.some((venue) => venue.id === data.studioId)} onChange={(event) => update(isBand ? { ...studioSelection(null), meetingPlace: event.target.value } : { meetingPlace: event.target.value })} placeholder={isLive ? "ライブハウス名・会場名（未定なら空欄）" : isRehearsal ? "スタジオ名・住所（未定なら空欄）" : undefined} />
            </Field>
            {isBand && <div className="wide"><StudioLinks url={data.studioUrl} accessUrl={data.studioAccessUrl} /></div>}
          </div>

          {!isBand && <label className="inline-check">
            <input type="checkbox" checked={data.includeWeekends} onChange={(event) => update({ includeWeekends: event.target.checked })} />
            土日も候補に含める
          </label>}

          {!isLive && <div className="time-section">
            <div className="subhead">
              <strong>候補時間</strong>
              <span>{isRehearsal ? `選択した${data.selectedDates.length}日` : `候補範囲: ${formatJapaneseDate(candidateRange.startDate)}〜${formatJapaneseDate(candidateRange.endDate)}`}</span>
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
            <button className="primary" onClick={regenerate} disabled={isRehearsal && (!data.selectedDates.length || !data.timeSlots.length)}>
              <CalendarDays size={16} />{isRehearsal ? "選択した日付で候補時間を更新" : "候補日を自動生成"}
            </button>
          </div>}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>{isLive ? "候補日" : "候補日時"}</h2>
            <span>{data.candidates.length}件</span>
          </div>
          <div className="candidate-list">
            {data.candidates.map((candidate) => (
              <div className={`${candidate.enabled ? "candidate-row" : "candidate-row muted"}${isLive ? " date-only" : ""}`} key={candidate.id}>
                <label className="candidate-check">
                  <input type="checkbox" checked={candidate.enabled} onChange={() => toggleCandidate(candidate.id)} />
                  <span>{formatJapaneseDate(candidate.date)}</span>
                </label>
                {!isLive && <strong>{formatCandidateTime(candidate)}</strong>}
                <button className="icon-danger" onClick={() => removeCandidate(candidate.id)} aria-label="候補を削除">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {data.candidates.length === 0 && <p className="empty">{isLive ? "候補日がありません。" : isRehearsal ? "候補日時がありません。" : "候補日を自動生成してください。"}</p>}
          </div>
        </div>
      </section>

      <SharePanel
        data={data}
        update={update}
        eventTitle={eventTitle}
        memoText={memoText}
        enabledCandidates={enabledCandidates}
        copied={copied}
        setCopied={setCopied}
      />

      <section className="dm-workspace">
        <article className="output-block dm-editor">
          <div className="output-head">
            <h2>{isBand ? "メンバーへの連絡文面" : "ゲストDM文面"}</h2>
            <div className="inline-actions">
              <button className="secondary" onClick={() => update({ guestDmDraft: defaultTemplate })}>
                <RefreshCcw size={16} />初期文
              </button>
              <button className="secondary" onClick={() => copyText(guestDm, "dm", setCopied)}>
                {copied === "dm" ? <Check size={16} /> : <ClipboardCopy size={16} />}
                {copied === "dm" ? "コピー済み" : "コピー"}
              </button>
            </div>
          </div>
          <textarea aria-label={isBand ? "メンバーへの連絡文面" : "ゲストDM文面"} value={data.guestDmDraft} onChange={(event) => update({ guestDmDraft: event.target.value })} />
          <p className="hint">差し込み: {(isLive ? LIVE_TEMPLATE_VARIABLES : isRehearsal ? BAND_TEMPLATE_VARIABLES : TEMPLATE_VARIABLES).join(" / ")}。コピー時に実際の内容へ置き換わります。</p>
          <div className="rendered-preview">
            <strong>コピー内容プレビュー</strong>
            <pre>{guestDm}</pre>
          </div>
        </article>

        <div className="side-stack">
          <article className="output-block">
            <div className="output-head">
              <h2>DMプリセット</h2>
              <button className="secondary" onClick={() => applyDmPreset(selectedPreset)} disabled={!selectedPreset}>
                <MessageSquareText size={16} />反映
              </button>
            </div>
            <select value={selectedPreset?.id || ""} onChange={(event) => setSelectedPresetId(event.target.value)}>
              {dmPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <div className="preset-actions">
              <TextInput value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} placeholder="プリセット名" />
              <button className="secondary" onClick={saveDmPreset}>
                <Plus size={16} />現在のDMを保存
              </button>
              <button className="secondary" onClick={overwriteDmPreset} disabled={!selectedPreset}>
                <Check size={16} />選択プリセットを上書き
              </button>
              <button
                className="icon-danger"
                onClick={removeDmPreset}
                disabled={!selectedSavedPreset}
                aria-label={DEFAULT_DM_PRESET_IDS.has(selectedPresetId) ? "DMプリセットを初期状態に戻す" : "DMプリセットを削除"}
                title={DEFAULT_DM_PRESET_IDS.has(selectedPresetId) ? "初期状態に戻す" : "削除"}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>

          <article className="output-block">
            <div className="output-head">
              <h2>文章ブロック</h2>
            </div>
            <div className="block-list">
              {templateBlocks.map((block) => {
                const saved = (data.templateBlocks || []).some((item) => item.id === block.id);
                const editing = editingBlockId === block.id;
                return (
                  <div className={editing ? "block-row editing" : "block-row"} key={block.id}>
                    {editing ? (
                      <>
                        <div className="block-edit-fields">
                          <TextInput value={editingBlockName} onChange={(event) => setEditingBlockName(event.target.value)} />
                          <textarea value={editingBlockBody} onChange={(event) => setEditingBlockBody(event.target.value)} />
                        </div>
                        <button className="secondary" onClick={saveEditedTemplateBlock} disabled={!editingBlockName.trim() || !editingBlockBody.trim()}>
                          <Check size={16} />保存
                        </button>
                        <button className="secondary" onClick={cancelEditTemplateBlock}>
                          <X size={16} />キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>{block.name}</strong>
                          <small>{block.body.split("\n")[0]}</small>
                        </div>
                        <button className="secondary" onClick={() => insertBlock(block)}>挿入</button>
                        <button className="secondary" onClick={() => startEditTemplateBlock(block)}>
                          <Pencil size={16} />編集
                        </button>
                        <button
                          className="icon-danger"
                          onClick={() => removeTemplateBlock(block.id)}
                          disabled={!saved}
                          aria-label={defaultBlockIds.has(block.id) ? "文章ブロックを初期状態に戻す" : "文章ブロックを削除"}
                          title={defaultBlockIds.has(block.id) ? "初期状態に戻す" : "削除"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="block-form">
              <TextInput value={newBlockName} onChange={(event) => setNewBlockName(event.target.value)} placeholder="ブロック名（例: 当日の確認事項）" />
              <textarea value={newBlockBody} onChange={(event) => setNewBlockBody(event.target.value)} placeholder="挿入したい文章ブロック" />
              <button className="secondary" onClick={saveTemplateBlock}>
                <Plus size={16} />ブロック登録
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="outputs compact-outputs">
        <OutputBlock title={isLive ? "候補日コピー" : "候補日時コピー"} text={candidateCopyText} copied={copied} copyId="candidates" onCopy={copyText} setCopied={setCopied} />
        <OutputBlock title="Codex依頼文" text={codexPack} copied={copied} copyId="codex" onCopy={copyText} setCopied={setCopied} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>決定後の記録</h2>
          <span>{isLive ? "ライブ日程の記録" : isRehearsal ? "スタジオリハの記録" : "次の制作工程へ渡すメモ"}</span>
        </div>
        <div className="form-grid">
          <Field label="決定日時">
            <TextInput value={data.decidedAt} onChange={(event) => update({ decidedAt: event.target.value })} placeholder={isLive ? "例: 7/18（土）" : "例: 7/18（土）21:00-21:30"} />
          </Field>
          <Field label="ステータス">
            <select value={data.decidedAt ? "fixed" : scheduleUrl ? "waiting" : "draft"} readOnly>
              <option value="draft">候補作成中</option>
              <option value="waiting">回答待ち</option>
              <option value="fixed">日程決定</option>
            </select>
          </Field>
          <Field label={isLive ? "ライブメモ" : isRehearsal ? "スタジオリハメモ" : "打ち合わせメモ"} wide>
            <textarea value={data.meetingNotes} onChange={(event) => update({ meetingNotes: event.target.value })} placeholder={isLive ? "出演条件、集合時間、持ち時間、連絡事項など" : isRehearsal ? "練習曲、必要な機材、予約内容など" : "確認したいこと、当日の議題、決定事項など"} />
          </Field>
        </div>
      </section>
      </div>
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

function HostApp() {
  const [workspaces, setWorkspaces] = useState(() => ({
    radio: loadState("radio"),
    band: loadState("band"),
    live: loadState("live")
  }));
  const [mode, setMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem(ACTIVE_MODE_KEY);
      return savedMode === "band" || savedMode === "radio" ? savedMode : initialMode();
    } catch {
      return initialMode();
    }
  });
  const [bandView, setBandView] = useState(() => {
    try {
      return localStorage.getItem(BAND_VIEW_KEY) === "live" ? "live" : "band";
    } catch {
      return "band";
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState("studios");
  const changeMode = (nextMode) => {
    if (nextMode === "settings") { setShowSettings(true); return; }
    setShowSettings(false);
    localStorage.setItem(ACTIVE_MODE_KEY, nextMode);
    setMode(nextMode);
  };
  const changeBandView = (nextView) => {
    if (nextView !== "band" && nextView !== "live") return;
    localStorage.setItem(BAND_VIEW_KEY, nextView);
    setBandView(nextView);
  };
  // Keep pending share requests attached to their original workspace when switching tabs.
  const updateWorkspace = (targetMode, patch) => {
    setWorkspaces((current) => {
      const next = { ...current[targetMode], ...patch };
      localStorage.setItem(storageKeyFor(targetMode), JSON.stringify(next));
      return { ...current, [targetMode]: next };
    });
  };
  const importMode = (data, importedMode) => {
    updateWorkspace(importedMode, data);
    if (importedMode === "live") {
      if (Array.isArray(data.livehouses)) updateWorkspace("band", { livehouses: data.livehouses });
      changeBandView("live");
      changeMode("band");
      return;
    }
    if (importedMode === "band") changeBandView("band");
    changeMode(importedMode);
  };
  if (showSettings) return <main className="app-shell">
    <header className="app-header"><div><span className="eyebrow">Umbrella Parade Toolkit</span><h1>設定</h1></div></header>
    <ModeTabs mode="settings" onModeChange={changeMode} />
    <SubTabs
      tabs={SETTINGS_TABS}
      value={settingsView}
      onChange={setSettingsView}
      label="登録する場所の種類"
      idPrefix="settings"
    />
    <div id="schedule-workspace" role="tabpanel" aria-labelledby={`settings-tab-${settingsView}`}>
      {settingsView === "studios" ? <StudioSettings key="studios" studios={workspaces.band.studios} onSave={(studio) => {
        const studios = workspaces.band.studios;
        updateWorkspace("band", {
          studios: studios.some((item) => item.id === studio.id) ? studios.map((item) => item.id === studio.id ? studio : item) : [...studios, studio],
          ...(workspaces.band.studioId === studio.id ? studioSelection(studio) : {})
        });
      }} onDelete={(id) => updateWorkspace("band", {
        studios: workspaces.band.studios.filter((studio) => studio.id !== id),
        ...(workspaces.band.studioId === id ? { studioId: "" } : {})
      })} /> : <StudioSettings key="livehouses" type="livehouse" studios={workspaces.band.livehouses} onSave={(livehouse) => {
        const livehouses = workspaces.band.livehouses;
        updateWorkspace("band", {
          livehouses: livehouses.some((item) => item.id === livehouse.id)
            ? livehouses.map((item) => item.id === livehouse.id ? livehouse : item)
            : [...livehouses, livehouse]
        });
        if (workspaces.live.studioId === livehouse.id) updateWorkspace("live", studioSelection(livehouse));
      }} onDelete={(id) => {
        updateWorkspace("band", { livehouses: workspaces.band.livehouses.filter((livehouse) => livehouse.id !== id) });
        if (workspaces.live.studioId === id) updateWorkspace("live", { studioId: "" });
      }} />}
    </div>
  </main>;
  const workspaceMode = mode === "band" ? bandView : "radio";
  return (
    <SchedulerWorkspace
      key={workspaceMode}
      mode={workspaceMode}
      data={workspaces[workspaceMode]}
      update={(patch) => updateWorkspace(workspaceMode, patch)}
      onModeChange={changeMode}
      onBandModeChange={changeBandView}
      onImport={importMode}
      studios={workspaces.band.studios}
      livehouses={workspaces.band.livehouses}
    />
  );
}

function Root() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("e");
  const pageMode = params.get("mode");
  if (eventId) return <GuestApp eventId={eventId} mode={pageMode === "live" ? "live" : pageMode === "band" ? "band" : "radio"} />;
  return <HostApp />;
}

createRoot(document.getElementById("root")).render(<Root />);
startEmbedBridge();
