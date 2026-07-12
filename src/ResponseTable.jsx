import React, { useMemo } from "react";
import { formatCandidateLabel } from "./lib.js";

const ANSWER_LABELS = { ok: "○", maybe: "△", ng: "×" };

export function answerSymbol(value) {
  return ANSWER_LABELS[value] || "－";
}

export default function ResponseTable({ candidates, responses, decidedCandidateId = "" }) {
  const stats = useMemo(() => {
    const byCandidate = {};
    for (const candidate of candidates) {
      let ok = 0;
      let maybe = 0;
      let ng = 0;
      for (const response of responses) {
        const answer = response.answers?.[candidate.id];
        if (answer === "ok") ok += 1;
        else if (answer === "maybe") maybe += 1;
        else if (answer === "ng") ng += 1;
      }
      byCandidate[candidate.id] = { ok, maybe, ng, score: ok * 2 + maybe };
    }
    const bestScore = Math.max(0, ...Object.values(byCandidate).map((stat) => stat.score));
    return { byCandidate, bestScore };
  }, [candidates, responses]);

  if (responses.length === 0) {
    return <p className="empty">まだ回答がありません。</p>;
  }

  return (
    <div className="response-table-wrap">
      <table className="response-table">
        <thead>
          <tr>
            <th className="slot-col">候補日時</th>
            <th>○</th>
            <th>△</th>
            <th>×</th>
            {responses.map((response) => (
              <th key={response.name} className="name-col" title={response.comment || ""}>
                {response.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const stat = stats.byCandidate[candidate.id] || { ok: 0, maybe: 0, ng: 0, score: 0 };
            const isBest = stats.bestScore > 0 && stat.score === stats.bestScore;
            const isDecided = decidedCandidateId && candidate.id === decidedCandidateId;
            const rowClass = isDecided ? "decided-row" : isBest ? "best-row" : "";
            return (
              <tr key={candidate.id} className={rowClass}>
                <td className="slot-col">
                  {formatCandidateLabel(candidate)}
                  {isDecided && <span className="decided-badge">決定</span>}
                </td>
                <td>{stat.ok}</td>
                <td>{stat.maybe}</td>
                <td>{stat.ng}</td>
                {responses.map((response) => {
                  const answer = response.answers?.[candidate.id];
                  return (
                    <td key={response.name} className={`answer-cell answer-${answer || "none"}`}>
                      {answerSymbol(answer)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {responses.some((response) => response.comment) && (
        <div className="comment-list">
          {responses
            .filter((response) => response.comment)
            .map((response) => (
              <p key={response.name}>
                <strong>{response.name}:</strong> {response.comment}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
