export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const pad = (value) => String(value).padStart(2, "0");

export function toDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

export function formatInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateString, amount) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + amount);
  return formatInputDate(date);
}

export function formatJapaneseDate(dateString) {
  if (!dateString) return "";
  const date = toDate(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）`;
}

export function addMinutes(time, minutes) {
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function candidateId(date, start, durationMinutes) {
  return `${date}-${start}-${durationMinutes}`;
}

export function formatCandidateLabel(candidate) {
  return `${formatJapaneseDate(candidate.date)} ${candidate.start}-${candidate.end}`;
}
