import { addDays, addMinutes, candidateId, formatInputDate, formatJapaneseDate, toDate } from "./lib.js";

export function normalizeSelectedDates(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatInputDate(toDate(value)) === value))].sort();
}

export function summarizeCandidateDates(candidates) {
  const dates = normalizeSelectedDates(Array.isArray(candidates) ? candidates.map((candidate) => candidate.date) : []);
  return dates.map((date) => formatJapaneseDate(date)).join("、");
}

export function getDefaultCandidateRange(broadcastDate, mode = "radio") {
  if (!broadcastDate) return { candidateStartDate: "", candidateEndDate: "" };
  if (mode === "band") {
    return { candidateStartDate: broadcastDate, candidateEndDate: addDays(broadcastDate, 6) };
  }
  return { candidateStartDate: addDays(broadcastDate, -7), candidateEndDate: addDays(broadcastDate, -1) };
}

export function normalizeCandidateRange(settings) {
  const fallback = getDefaultCandidateRange(settings.broadcastDate, settings.mode);
  const legacyStartDays = Number(settings.leadStartDays || 7);
  const legacyEndDays = Number(settings.leadEndDays || 1);
  const candidateStartDate = settings.candidateStartDate || (settings.mode !== "band" && settings.broadcastDate ? addDays(settings.broadcastDate, -legacyStartDays) : fallback.candidateStartDate);
  const candidateEndDate = settings.candidateEndDate || (settings.mode !== "band" && settings.broadcastDate ? addDays(settings.broadcastDate, -legacyEndDays) : fallback.candidateEndDate);
  if (!candidateStartDate || !candidateEndDate) return { startDate: "", endDate: "" };
  return candidateStartDate <= candidateEndDate ? { startDate: candidateStartDate, endDate: candidateEndDate } : { startDate: candidateEndDate, endDate: candidateStartDate };
}

function datesInRange(settings) {
  const { startDate, endDate } = normalizeCandidateRange(settings);
  if (!startDate || !endDate) return [];
  const dates = [];
  const current = toDate(startDate);
  const end = toDate(endDate);
  while (current <= end) {
    const day = current.getDay();
    if (settings.includeWeekends || (day !== 0 && day !== 6)) dates.push(formatInputDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function getBandSelectedDates(settings) {
  if (Array.isArray(settings.selectedDates)) return normalizeSelectedDates(settings.selectedDates);
  // Older backups retain their actual candidate days, including disabled slots.
  if (Array.isArray(settings.candidates)) return normalizeSelectedDates(settings.candidates.map((candidate) => candidate.date));
  return datesInRange(settings);
}

export function generateCandidates(settings) {
  const dates = settings.mode === "band" ? getBandSelectedDates(settings) : datesInRange(settings);
  return dates.flatMap((date) => settings.timeSlots.map((startTime) => {
    const start = startTime || "20:00";
    return { id: candidateId(date, start, settings.durationMinutes), date, start, end: addMinutes(start, settings.durationMinutes), enabled: true };
  }));
}

export function updateBandSelectedDates(settings, values) {
  const selectedDates = normalizeSelectedDates(values);
  const previousDays = new Set(getBandSelectedDates(settings));
  const selected = new Set(selectedDates);
  const kept = settings.candidates.filter((candidate) => selected.has(candidate.date));
  const added = generateCandidates({ ...settings, mode: "band", selectedDates: selectedDates.filter((date) => !previousDays.has(date)) });
  return {
    selectedDates,
    candidates: [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  };
}

export function weekendDatesInMonth(month) {
  const date = new Date(month.getFullYear(), month.getMonth(), 1);
  const dates = [];
  while (date.getMonth() === month.getMonth()) {
    if (date.getDay() === 0 || date.getDay() === 6) dates.push(formatInputDate(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}
