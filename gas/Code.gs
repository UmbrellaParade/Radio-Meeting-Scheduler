/**
 * Radio Meeting Scheduler - GAS backend
 *
 * Google Apps Script Web App として公開して使います。
 * データは自動作成される Google スプレッドシートに保存されます。
 * デプロイ手順は gas/README.md を参照してください。
 *
 * API:
 *   GET  ?action=event&id=EVENT_ID
 *     → { ok, event: {id,title,memo,candidates,decidedAt,createdAt}, responses: [...] }
 *   POST (Content-Type: text/plain, body は JSON)
 *     { action:"create", title, memo, candidates:[{id,date,start,end}] }
 *       → { ok, id, adminKey }
 *     { action:"answer", id, name, answers:{candidateId:"ok"|"maybe"|"ng"}, comment }
 *       → { ok }
 *     { action:"decide", id, adminKey, decidedAt }
 *       → { ok }
 */

const EVENTS_SHEET = "events";
const RESPONSES_SHEET = "responses";

const EVENT_HEADERS = ["id", "adminKey", "title", "memo", "candidatesJson", "decidedAt", "createdAt"];
const RESPONSE_HEADERS = ["eventId", "name", "answersJson", "comment", "updatedAt"];

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SPREADSHEET_ID");
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      // 削除された場合は作り直す
    }
  }
  const ss = SpreadsheetApp.create("Radio Meeting Scheduler データ");
  props.setProperty("SPREADSHEET_ID", ss.getId());
  return ss;
}

function getSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function randomId_(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function readRows_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, index) {
    const record = { rowIndex: index + 2 };
    headers.forEach(function (header, col) {
      record[header] = row[col];
    });
    return record;
  });
}

function findEvent_(ss, id) {
  const sheet = getSheet_(ss, EVENTS_SHEET, EVENT_HEADERS);
  const rows = readRows_(sheet, EVENT_HEADERS);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return { sheet: sheet, row: rows[i] };
  }
  return null;
}

function eventToPublic_(row) {
  let candidates = [];
  try {
    candidates = JSON.parse(row.candidatesJson || "[]");
  } catch (err) {
    candidates = [];
  }
  return {
    id: String(row.id),
    title: String(row.title || ""),
    memo: String(row.memo || ""),
    candidates: candidates,
    decidedAt: String(row.decidedAt || ""),
    createdAt: String(row.createdAt || "")
  };
}

function listResponses_(ss, eventId) {
  const sheet = getSheet_(ss, RESPONSES_SHEET, RESPONSE_HEADERS);
  const rows = readRows_(sheet, RESPONSE_HEADERS);
  return rows
    .filter(function (row) {
      return String(row.eventId) === String(eventId);
    })
    .map(function (row) {
      let answers = {};
      try {
        answers = JSON.parse(row.answersJson || "{}");
      } catch (err) {
        answers = {};
      }
      return {
        name: String(row.name || ""),
        answers: answers,
        comment: String(row.comment || ""),
        updatedAt: String(row.updatedAt || "")
      };
    });
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === "event") {
    const id = String(params.id || "").trim();
    if (!id) return jsonOutput_({ ok: false, error: "id がありません" });
    const ss = getSpreadsheet_();
    const found = findEvent_(ss, id);
    if (!found) return jsonOutput_({ ok: false, error: "イベントが見つかりません" });
    return jsonOutput_({
      ok: true,
      event: eventToPublic_(found.row),
      responses: listResponses_(ss, id)
    });
  }
  return jsonOutput_({ ok: true, service: "radio-meeting-scheduler", version: 1 });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let body = {};
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    } catch (err) {
      return jsonOutput_({ ok: false, error: "JSONを読み取れません" });
    }
    const action = String(body.action || "");
    if (action === "create") return handleCreate_(body);
    if (action === "answer") return handleAnswer_(body);
    if (action === "decide") return handleDecide_(body);
    return jsonOutput_({ ok: false, error: "不明なactionです: " + action });
  } finally {
    lock.releaseLock();
  }
}

function handleCreate_(body) {
  const title = String(body.title || "").trim();
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (!title) return jsonOutput_({ ok: false, error: "イベント名がありません" });
  if (candidates.length === 0) return jsonOutput_({ ok: false, error: "候補日時がありません" });

  const cleanCandidates = candidates.slice(0, 200).map(function (candidate) {
    return {
      id: String(candidate.id || ""),
      date: String(candidate.date || ""),
      start: String(candidate.start || ""),
      end: String(candidate.end || "")
    };
  });

  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, EVENTS_SHEET, EVENT_HEADERS);
  const id = randomId_(10);
  const adminKey = randomId_(16);
  sheet.appendRow([
    id,
    adminKey,
    title,
    String(body.memo || ""),
    JSON.stringify(cleanCandidates),
    "",
    new Date().toISOString()
  ]);
  return jsonOutput_({ ok: true, id: id, adminKey: adminKey });
}

function handleAnswer_(body) {
  const id = String(body.id || "").trim();
  const name = String(body.name || "").trim().slice(0, 40);
  if (!id) return jsonOutput_({ ok: false, error: "id がありません" });
  if (!name) return jsonOutput_({ ok: false, error: "お名前を入力してください" });

  const ss = getSpreadsheet_();
  const found = findEvent_(ss, id);
  if (!found) return jsonOutput_({ ok: false, error: "イベントが見つかりません" });

  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  const cleanAnswers = {};
  Object.keys(answers).forEach(function (key) {
    const value = String(answers[key]);
    if (value === "ok" || value === "maybe" || value === "ng") {
      cleanAnswers[String(key)] = value;
    }
  });

  const sheet = getSheet_(ss, RESPONSES_SHEET, RESPONSE_HEADERS);
  const rows = readRows_(sheet, RESPONSE_HEADERS);
  const rowValues = [
    id,
    name,
    JSON.stringify(cleanAnswers),
    String(body.comment || "").slice(0, 500),
    new Date().toISOString()
  ];

  // 同じイベント・同じ名前なら上書き（回答の修正）
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].eventId) === id && String(rows[i].name) === name) {
      sheet.getRange(rows[i].rowIndex, 1, 1, RESPONSE_HEADERS.length).setValues([rowValues]);
      return jsonOutput_({ ok: true, updated: true });
    }
  }
  sheet.appendRow(rowValues);
  return jsonOutput_({ ok: true, updated: false });
}

function handleDecide_(body) {
  const id = String(body.id || "").trim();
  const adminKey = String(body.adminKey || "");
  const ss = getSpreadsheet_();
  const found = findEvent_(ss, id);
  if (!found) return jsonOutput_({ ok: false, error: "イベントが見つかりません" });
  if (String(found.row.adminKey) !== adminKey) {
    return jsonOutput_({ ok: false, error: "管理キーが一致しません" });
  }
  const column = EVENT_HEADERS.indexOf("decidedAt") + 1;
  found.sheet.getRange(found.row.rowIndex, column).setValue(String(body.decidedAt || ""));
  return jsonOutput_({ ok: true });
}
