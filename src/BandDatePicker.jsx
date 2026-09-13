import React, { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { formatInputDate, formatJapaneseDate, toDate } from "./lib.js";
import { normalizeSelectedDates, weekendDatesInMonth } from "./scheduling.js";

function CalendarChevron({ orientation, className }) {
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return <Icon size={20} className={className} aria-hidden="true" />;
}

export default function BandDatePicker({ selectedDates, broadcastDate, onChange, type = "rehearsal" }) {
  const [month, setMonth] = useState(() => toDate(selectedDates[0] || broadcastDate || formatInputDate(new Date())));
  const ariaLabel = type === "live" ? "ライブ候補日の選択" : "スタジオ候補日の選択";
  return <section className="band-date-picker wide" aria-label={ariaLabel}>
    <div className="subhead"><strong>候補日</strong><span>{selectedDates.length}日選択中</span></div>
    <DayPicker
      mode="multiple" locale={ja} weekStartsOn={0} month={month} onMonthChange={setMonth}
      selected={selectedDates.map(toDate)} onSelect={(dates) => onChange(normalizeSelectedDates((dates || []).map(formatInputDate)))}
      fixedWeeks showOutsideDays
      className="studio-calendar"
      components={{ Chevron: CalendarChevron }}
      modifiers={{ saturday: { dayOfWeek: [6] }, sunday: { dayOfWeek: [0] } }}
      modifiersClassNames={{ saturday: "calendar-saturday", sunday: "calendar-sunday" }}
      labels={{ labelNext: () => "翌月", labelPrevious: () => "前月" }}
    />
    <div className="calendar-actions">
      <button type="button" className="secondary" onClick={() => onChange(normalizeSelectedDates([...selectedDates, ...weekendDatesInMonth(month)]))}><CalendarDays size={16} />この月の土日を追加</button>
      <button type="button" className="ghost" title="選択した日付をすべて解除" aria-label="選択した日付をすべて解除" disabled={!selectedDates.length} onClick={() => onChange([])}><X size={16} /></button>
    </div>
    <ul className="selected-date-list" aria-label="選択した候補日">
      {selectedDates.map((date) => <li key={date}>
        <span>{formatJapaneseDate(date)}</span>
        <button type="button" className="ghost" aria-label={`${date}の選択を解除`} title={`${date}の選択を解除`} onClick={() => onChange(selectedDates.filter((value) => value !== date))}><X size={14} /></button>
      </li>)}
    </ul>
  </section>;
}
