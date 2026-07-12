import React, { useEffect, useMemo, useState } from "react";
import { Check, RefreshCcw, Send } from "lucide-react";
import { apiConfigured, fetchEvent, submitAnswer } from "./api.js";
import { formatCandidateLabel } from "./lib.js";
import ResponseTable from "./ResponseTable.jsx";

const GUEST_NAME_KEY = "radio-meeting-scheduler:guest-name";

const ANSWER_OPTIONS = [
  { value: "ok", label: "○", hint: "参加できる" },
  { value: "maybe", label: "△", hint: "条件つき" },
  { value: "ng", label: "×", hint: "難しい" }
];

export default function GuestApp({ eventId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [event, setEvent] = useState(null);
  const [responses, setResponses] = useState([]);
  const [name, setName] = useState(() => localStorage.getItem(GUEST_NAME_KEY) || "");
  const [answers, setAnswers] = useState({});
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchEvent(eventId);
      setEvent(data.event);
      setResponses(data.responses || []);
      // 自分の回答が既にあれば読み込む（再編集用）
      const savedName = localStorage.getItem(GUEST_NAME_KEY) || "";
      const mine = (data.responses || []).find((response) => response.name === savedName);
      if (mine) {
        setAnswers(mine.answers || {});
        setComment(mine.comment || "");
      }
    } catch (err) {
      setError(err.message || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiConfigured()) load();
    else {
      setLoading(false);
      setError("このページはまだ準備中です（APIが未設定）。主催者にご連絡ください。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const setAnswer = (candidateId, value) => {
    setAnswers((current) => ({ ...current, [candidateId]: value }));
    setSent(false);
  };

  const fillAll = (value) => {
    if (!event) return;
    const next = {};
    for (const candidate of event.candidates) next[candidate.id] = value;
    setAnswers(next);
    setSent(false);
  };

  const answeredCount = useMemo(
    () => (event ? event.candidates.filter((candidate) => answers[candidate.id]).length : 0),
    [answers, event]
  );

  const submit = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      alert("お名前を入力してください。");
      return;
    }
    if (answeredCount === 0) {
      alert("少なくとも1つの候補に○△×を入力してください。");
      return;
    }
    setSending(true);
    setError("");
    try {
      localStorage.setItem(GUEST_NAME_KEY, cleanName);
      await submitAnswer({ id: eventId, name: cleanName, answers, comment: comment.trim() });
      setSent(true);
      await load();
    } catch (err) {
      setError(err.message || "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="app-shell guest-shell">
        <p className="empty">読み込み中...</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="app-shell guest-shell">
        <header className="app-header">
          <div>
            <span className="eyebrow">Umbrella Parade Toolkit</span>
            <h1>日程調整</h1>
          </div>
        </header>
        <p className="error-banner">{error || "イベントが見つかりませんでした。"}</p>
      </main>
    );
  }

  return (
    <main className="app-shell guest-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">Umbrella Parade Toolkit</span>
          <h1>{event.title}</h1>
          {event.memo && <p className="event-memo">{event.memo}</p>}
        </div>
      </header>

      {event.decidedAt && (
        <div className="decided-banner">
          <Check size={18} />
          日程が決定しました: <strong>{event.decidedAt}</strong>
        </div>
      )}

      {error && <p className="error-banner">{error}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>出欠を入力</h2>
          <span>
            {answeredCount}/{event.candidates.length}件 入力済み
          </span>
        </div>

        <label className="field guest-name-field">
          <span>お名前</span>
          <input
            type="text"
            value={name}
            onChange={(nameEvent) => setName(nameEvent.target.value)}
            placeholder="例: ヴェル13世"
          />
        </label>

        <div className="fill-actions">
          <button className="secondary" onClick={() => fillAll("ok")}>
            全部○にする
          </button>
          <button className="secondary" onClick={() => fillAll("ng")}>
            全部×にする
          </button>
        </div>

        <div className="answer-list">
          {event.candidates.map((candidate) => (
            <div className="answer-row" key={candidate.id}>
              <span className="answer-label">{formatCandidateLabel(candidate)}</span>
              <div className="answer-buttons" role="group" aria-label={formatCandidateLabel(candidate)}>
                {ANSWER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    className={
                      answers[candidate.id] === option.value
                        ? `answer-button selected answer-${option.value}`
                        : "answer-button"
                    }
                    onClick={() => setAnswer(candidate.id, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="field wide">
          <span>コメント（任意）</span>
          <textarea
            value={comment}
            onChange={(commentEvent) => setComment(commentEvent.target.value)}
            placeholder="例: 21時以降なら確実に参加できます"
          />
        </label>

        <div className="submit-row">
          <button className="primary" onClick={submit} disabled={sending}>
            <Send size={16} />
            {sending ? "送信中..." : sent ? "送信済み（再送信で上書き）" : "回答を送信"}
          </button>
          {sent && (
            <span className="sent-note">
              <Check size={16} />
              回答を受け付けました！
            </span>
          )}
        </div>
        <p className="hint">同じお名前でもう一度送信すると、回答を修正できます。</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>みんなの回答</h2>
          <button className="secondary" onClick={load}>
            <RefreshCcw size={16} />
            更新
          </button>
        </div>
        <ResponseTable candidates={event.candidates} responses={responses} decidedCandidateId="" />
      </section>
    </main>
  );
}
