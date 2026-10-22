import { seoulDateTime, shortDate, weekdayLabel } from "@/lib/classes/dates";
import type { ClassConflict } from "@/lib/classes/types";
import styles from "./classes.module.css";

const SHOWN = 10;

export function ConflictList({ conflicts }: { conflicts: ClassConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <ul className={styles.conflicts} aria-label={`겹치는 수업 ${conflicts.length}건`}>
      {conflicts.slice(0, SHOWN).map((conflict) => {
        const start = seoulDateTime(conflict.starts_at);
        const end = seoulDateTime(conflict.ends_at);
        return (
          <li key={conflict.id}>
            {shortDate(start.date)} ({weekdayLabel(start.date)}) {start.time}–{end.time} {conflict.class_name}
          </li>
        );
      })}
      {conflicts.length > SHOWN && <li>외 {conflicts.length - SHOWN}건</li>}
    </ul>
  );
}
