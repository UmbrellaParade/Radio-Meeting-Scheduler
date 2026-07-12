import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCcw,
  Share2,
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
  formatInputDate,
  formatJapaneseDate,
  toDate
} from "./lib.js";
import { apiConfigured, createEvent, decideEvent, fetchEvent, updateEvent } from "./api.js";
import GuestApp from "./guest.jsx";
import ResponseTable from "./ResponseTable.jsx";

const STORAGE_KEY = "radio-meeting-scheduler:v1";

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

function getDefaultCandidateRange(broadcastDate) {
  if (!broadcastDate) return { candidateStartDate: "", candidateEndDate: "" };
  return {
    candidateStartDate: addDays(broadcastDate, -7),
    candidateEndDate: addDays(broadcastDate, -1)
  };
}

function normalizeCandidateRange(settings) {
  const fallback = getDefaultCandidateRange(settings.broadcastDate);
  const legacyStartDays = Number(settings.leadStartDays || 7);
  const legacyEndDays = Number(settings.leadEndDays || 1);
  const candidateStartDate =
    settings.candidateStartDate || (settings.broadcastDate ? addDays(settings.broadcastDate, -legacyStartDays) : fallback.candidateStartDate);
  const candidateEndDate =
    settings.candidateEndDate || (settings.broadcastDate ? addDays(settings.broadcastDate, -legacyEndDays) : fallback.candidateEndDate);
  if (!candidateStartDate || !candidateEndDate) return { startDate: "", endDate: "" };
  return candidateStartDate <= candidateEndDate
    ? { startDate: candidateStartDate, endDate: candidateEndDate }
    : { startDate: candidateEndDate, endDate: candidateStartDate };
}

function generateCandidates(settings) {
  const { startDate, endDate } = normalizeCandidateRange(settings);
  if (!startDate || !endDate) return [];
  const candidates = [];
  const current = toDate(startDate);
  const end = toDate(endDate);
  while (current <= end) {
    const date = formatInputDate(current);
    const day = toDate(date).getDay();
    if (settings.includeWeekends || (day !== 0 && day !== 6)) {
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
    current.setDate(current.getDate() + 1);
  }
  return candidates;
}

function makeDefaultState() {
  const broadcastDate = formatInputDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const candidateRange = getDefaultCandidateRange(broadcastDate);
  const state = {
    episodeTitle: "Sunoパ！ゲスト回",
    guestName: "",
    broadcastDate,
    ...candidateRange,
    includeWeekends: true,
    durationMinutes: 30,
    timeSlots: ["20:00", "21:00", "22:00"],
    candidates: [],
    scheduleUrl: "",
    share: null,
    decidedAt: "",
    meetingPlace: "オンライン（Discord / Zoomなど）",
    meetingNotes: "",
    guestDmDraft: DEFAULT_DM_TEMPLATE,
    templateBlocks: [],
    dmPresets: []
  };
  return { ...state, candidates: generateCandidates(state) };
}

function normalizeState(input = {}) {
  const base = makeDefaultState();
  const next = { ...base, ...input };
  if (!next.candidateStartDate && next.broadcastDate) {
    next.candidateStartDate = addDays(next.broadcastDate, -Number(next.leadStartDays || 7));
  }
  if (!next.candidateEndDate && next.broadcastDate) {
    next.candidateEndDate = addDays(next.broadcastDate, -Number(next.leadEndDays || 1));
  }
  delete next.leadStartDays;
  delete next.leadEndDays;
  if (!Array.isArray(next.candidates)) next.candidates = generateCandidates(next);
  if (next.share && !next.share.id) next.share = null;
  const legacyScheduleUrlKey = ["chousei", "sanUrl"].join("");
  if (!next.scheduleUrl && next[legacyScheduleUrlKey]) next.scheduleUrl = next[legacyScheduleUrlKey];
  delete next[legacyScheduleUrlKey];
  if (!next.guestDmDraft) next.guestDmDraft = DEFAULT_DM_TEMPLATE;
  if (!Array.isArray(next.templateBlocks)) next.templateBlocks = [];
  if (!Array.isArray(next.dmPresets)) next.dmPresets = [];
  return next;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return makeDefaultState();
  }
}

function shareUrlFor(shareId) {
  return `${window.location.origin}${window.location.pathname}?e=${shareId}`;
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
    meetingPlace: data.meetingPlace || "オンライン",
    scheduleUrl: data.scheduleUrl || "（共有ページを作成するとURLが入ります）",
    candidateList: candidateLines.length ? candidateLines.join("\n") : "（候補日時を生成してください）"
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(null); // {event, responses}
  const [decideTarget, setDecideTarget] = useState("");
  const [updated, setUpdated] = useState(false);

  const shareUrl = data.share?.id ? shareUrlFor(data.share.id) : "";

  const createShare = async () => {
    if (enabledCandidates.length === 0) {
      alert("候補日時がありません。先に候補日を生成してください。");
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
      alert("候補日時がありません。先に候補日を生成してください。");
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
        <span>ゲストさんに直接○△×を入力してもらう</span>
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
            <button className="secondary" onClick={updateShare} disabled={busy} title="URLはそのまま、候補日時を今の内容に置き換えます">
              <CalendarDays size={16} />
              {updated ? "候補を更新しました！" : "今の候補で共有ページを更新"}
            </button>
            <button className="ghost" onClick={createShare} disabled={busy} title="URLを新しくして最初から作り直します">
              <Share2 size={16} />作り直す
            </button>
          </div>
          <p className="hint">
            日付や時間を変えたら「今の候補で共有ページを更新」。URLは変わらず、届いている回答も残ります。
          </p>

          {live && (
            <>
              <ResponseTable
                candidates={live.event.candidates}
                responses={live.responses}
                decidedCandidateId={decideTarget}
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
                  <Check size={16} />この日時に決定
                </button>
              </div>
              {live.event.decidedAt && (
                <p className="decided-banner">
                  <Check size={16} />決定済み: <strong>{live.event.decidedAt}</strong>
                  （ゲストページにも表示されます）
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function HostApp() {
  const [data, setData] = useState(loadState);
  const [copied, setCopied] = useState("");
  const [newSlot, setNewSlot] = useState("19:30");
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockBody, setNewBlockBody] = useState("");
  const [editingBlockId, setEditingBlockId] = useState("");
  const [editingBlockName, setEditingBlockName] = useState("");
  const [editingBlockBody, setEditingBlockBody] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("basic");

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

  const candidateRange = useMemo(() => normalizeCandidateRange(data), [data]);

  const eventTitle = useMemo(() => {
    const guest = data.guestName.trim() ? `${data.guestName.trim()}さん` : "ゲストさん";
    return `${data.episodeTitle || "Sunoパ！"} ${guest} 事前打ち合わせ`;
  }, [data.episodeTitle, data.guestName]);

  const candidateLines = useMemo(
    () => enabledCandidates.map((candidate) => formatCandidateLabel(candidate)),
    [enabledCandidates]
  );

  const templateBlocks = useMemo(() => {
    const savedBlocks = data.templateBlocks || [];
    const savedById = new Map(savedBlocks.map((block) => [block.id, block]));
    const defaultBlocks = DEFAULT_TEMPLATE_BLOCKS.map((block) => ({ ...block, ...savedById.get(block.id) }));
    const customBlocks = savedBlocks.filter((block) => !DEFAULT_TEMPLATE_BLOCK_IDS.has(block.id));
    return [...defaultBlocks, ...customBlocks];
  }, [data.templateBlocks]);
  const dmPresets = useMemo(() => {
    const savedPresets = data.dmPresets || [];
    const savedById = new Map(savedPresets.map((preset) => [preset.id, preset]));
    const defaultPresets = DEFAULT_DM_PRESETS.map((preset) => ({ ...preset, ...savedById.get(preset.id) }));
    const customPresets = savedPresets.filter((preset) => !DEFAULT_DM_PRESET_IDS.has(preset.id));
    return [...defaultPresets, ...customPresets];
  }, [data.dmPresets]);
  const selectedPreset = dmPresets.find((preset) => preset.id === selectedPresetId) ?? dmPresets[0];
  const selectedSavedPreset = (data.dmPresets || []).find((preset) => preset.id === selectedPresetId);

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

  const shareUrl = data.share?.id ? shareUrlFor(data.share.id) : "";
  const scheduleUrl = shareUrl || data.scheduleUrl || "";
  const templateData = useMemo(() => ({ ...data, scheduleUrl }), [data, scheduleUrl]);

  const codexPack = useMemo(
    () =>
      [
        "# Codex Task Pack",
        "",
        "目的:",
        "Radio Meeting Schedulerでゲスト打ち合わせの日程候補とDM文面を整えてください。",
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
        "候補日時:",
        candidateLines.join("\n") || "-",
        "",
        "ゲストDM文面:",
        renderTemplate(data.guestDmDraft, templateData, candidateLines),
        "",
        "作成後に返してほしいもの:",
        "1. ゲストさんに送るDM文面",
        "2. 日程確定後にRadio Meeting Schedulerへ記録すべき内容",
        "",
        "注意:",
        "候補日時を勝手に増やさず、上記候補だけで作成してください。"
      ].join("\n"),
    [candidateLines, data.guestDmDraft, eventTitle, memoText, scheduleUrl, templateData]
  );

  const guestDm = useMemo(() => renderTemplate(data.guestDmDraft, templateData, candidateLines), [candidateLines, data.guestDmDraft, templateData]);
  const candidateCopyText = useMemo(() => candidateLines.join("\n") || "候補日時がまだありません。", [candidateLines]);

  const regenerate = () => {
    update({ candidates: generateCandidates(data) });
  };

  const updateBroadcastDate = (broadcastDate) => {
    update({ broadcastDate, ...getDefaultCandidateRange(broadcastDate) });
  };

  const resetCandidateRange = () => {
    update(getDefaultCandidateRange(data.broadcastDate));
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
        update(normalizeState(parsed));
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
          <p>ゲスト打ち合わせの日程候補づくり、共有調整ページ、DM文面、文章ブロック、プリセットをまとめます。</p>
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
              <TextInput value={data.guestName} onChange={(event) => update({ guestName: event.target.value })} placeholder="例: ヴェル13世" />
            </Field>
            <Field label="放送予定日">
              <input type="date" value={data.broadcastDate} onChange={(event) => updateBroadcastDate(event.target.value)} />
            </Field>
            <Field label="所要時間">
              <select value={data.durationMinutes} onChange={(event) => update({ durationMinutes: Number(event.target.value) })}>
                <option value={30}>30分</option>
                <option value={45}>45分</option>
                <option value={60}>60分</option>
              </select>
            </Field>
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
              <span>候補範囲: {formatJapaneseDate(candidateRange.startDate)}〜{formatJapaneseDate(candidateRange.endDate)}</span>
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
            <h2>ゲストDM文面</h2>
            <div className="inline-actions">
              <button className="secondary" onClick={() => update({ guestDmDraft: DEFAULT_DM_TEMPLATE })}>
                <RefreshCcw size={16} />初期文
              </button>
              <button className="secondary" onClick={() => copyText(guestDm, "dm", setCopied)}>
                {copied === "dm" ? <Check size={16} /> : <ClipboardCopy size={16} />}
                {copied === "dm" ? "コピー済み" : "コピー"}
              </button>
            </div>
          </div>
          <textarea value={data.guestDmDraft} onChange={(event) => update({ guestDmDraft: event.target.value })} />
          <p className="hint">差し込み: {TEMPLATE_VARIABLES.join(" / ")}。コピー時に実際の内容へ置き換わります。</p>
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
                          aria-label={DEFAULT_TEMPLATE_BLOCK_IDS.has(block.id) ? "文章ブロックを初期状態に戻す" : "文章ブロックを削除"}
                          title={DEFAULT_TEMPLATE_BLOCK_IDS.has(block.id) ? "初期状態に戻す" : "削除"}
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
        <OutputBlock title="候補日時コピー" text={candidateCopyText} copied={copied} copyId="candidates" onCopy={copyText} setCopied={setCopied} />
        <OutputBlock title="Codex依頼文" text={codexPack} copied={copied} copyId="codex" onCopy={copyText} setCopied={setCopied} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>決定後の記録</h2>
          <span>次の制作工程へ渡すメモ</span>
        </div>
        <div className="form-grid">
          <Field label="決定日時">
            <TextInput value={data.decidedAt} onChange={(event) => update({ decidedAt: event.target.value })} placeholder="例: 7/18（土）21:00-21:30" />
          </Field>
          <Field label="ステータス">
            <select value={data.decidedAt ? "fixed" : scheduleUrl ? "waiting" : "draft"} readOnly>
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

function Root() {
  const eventId = new URLSearchParams(window.location.search).get("e");
  if (eventId) return <GuestApp eventId={eventId} />;
  return <HostApp />;
}

createRoot(document.getElementById("root")).render(<Root />);
