"use client";
import { useState, type FormEvent } from "react";
import { Button, Chip, Modal, SegmentedControl, Select, TextInput } from "@mantine/core";
import { api } from "@/components/auth/auth-forms";
import { WEEKDAY_LABELS, isoWeekday, minutesToTime, seoulDateTime, shortDate, timeToMinutes } from "@/lib/classes/dates";
import type { ClassConflict, ClassSession, ClassType, Instructor } from "@/lib/classes/types";
import staffStyles from "@/components/staff/staff.module.css";
import { ConflictList } from "./conflict-list";
import { CAPACITY_OPTIONS, DURATION_OPTIONS, NumberChips } from "./number-chips";
import styles from "./classes.module.css";

// Select cannot hold an empty value, so "강사 미정" uses a sentinel that maps back to "".
const UNASSIGNED = "unassigned";

export type FormTarget =
  | { mode: "create"; date: string }
  | { mode: "edit"; session: ClassSession; scope: "one" | "following" };

function initial(target: FormTarget, types: ClassType[]) {
  if (target.mode === "create") {
    const type = types.find((item) => item.is_active);
    return {
      typeId: type?.id ?? "",
      instructorId: "",
      date: target.date,
      weekdays: [String(isoWeekday(target.date))],
      endDate: "",
      startTime: "19:00",
      duration: String(type?.default_duration_minutes ?? 50),
      capacity: String(type?.default_capacity ?? 20),
    };
  }
  const { session } = target;
  const start = seoulDateTime(session.starts_at);
  const minutes = Math.round((new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000);
  // "Following" edits the repeat rule, so start from the rule rather than this (maybe modified) session.
  if (target.scope === "following" && session.series) {
    const rule = session.series;
    return {
      typeId: rule.class_type_id,
      instructorId: rule.instructor_id ?? "",
      date: start.date,
      weekdays: rule.weekdays.map(String),
      endDate: rule.end_date ?? "",
      startTime: rule.start_time.slice(0, 5),
      duration: String(rule.duration_minutes),
      capacity: String(rule.capacity),
    };
  }
  return {
    typeId: session.class_type_id,
    instructorId: session.instructor_id ?? "",
    date: start.date,
    weekdays: (session.series?.weekdays ?? [isoWeekday(start.date)]).map(String),
    endDate: session.series?.end_date ?? "",
    startTime: start.time,
    duration: String(minutes),
    capacity: String(session.capacity),
  };
}

export function SessionForm({
  target,
  types,
  instructors,
  today,
  horizon,
  onClose,
  onSaved,
}: {
  target: FormTarget;
  types: ClassType[];
  instructors: Instructor[];
  today: string;
  horizon: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState(() => initial(target, types));
  const [repeat, setRepeat] = useState(target.mode === "edit" && target.scope === "following");
  const [weekdaysTouched, setWeekdaysTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<ClassConflict[]>([]);
  const editing = target.mode === "edit" ? target : null;
  const following = editing?.scope === "following";
  const set = (key: keyof typeof values) => (value: string | string[]) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const typeOptions = types.filter((type) => type.is_active || type.id === editing?.session.class_type_id);
  const endMinutes = values.startTime ? timeToMinutes(values.startTime) + Number(values.duration || 0) : 0;

  function chooseType(id: string) {
    const type = types.find((item) => item.id === id);
    setValues((previous) => ({
      ...previous,
      typeId: id,
      ...(type && !editing
        ? { duration: String(type.default_duration_minutes), capacity: String(type.default_capacity) }
        : {}),
    }));
  }
  // Until weekdays are picked by hand, they follow the chosen start date.
  function chooseDate(date: string) {
    setValues((previous) => ({
      ...previous,
      date,
      ...(!weekdaysTouched && date ? { weekdays: [String(isoWeekday(date))] } : {}),
    }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // A non-searchable Select input is read-only, so the browser skips its required check.
    if (!editing && !values.instructorId) {
      setError("강사를 선택해주세요.");
      return;
    }
    if ((repeat || following) && values.weekdays.length === 0) {
      setError("반복할 요일을 하나 이상 선택해주세요.");
      return;
    }
    setPending(true);
    setError("");
    setConflicts([]);
    const common = {
      class_type_id: values.typeId,
      instructor_id: values.instructorId || null,
      capacity: values.capacity,
      duration_minutes: values.duration,
      start_time: values.startTime,
    };
    const weekdays = values.weekdays.map(Number);
    try {
      if (!editing) {
        await api("/api/classes/sessions", "POST", {
          ...common,
          date: values.date,
          repeat,
          weekdays: repeat ? weekdays : undefined,
          end_date: repeat ? values.endDate || null : undefined,
        });
        onSaved("수업 등록 완료");
      } else {
        await api(`/api/classes/sessions/${editing.session.id}`, "PATCH", {
          ...common,
          action: "update",
          scope: editing.scope,
          ...(following ? { weekdays, end_date: values.endDate || null } : { date: values.date }),
        });
        onSaved("수업 수정 완료");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "연결 상태를 확인해주세요.");
      const data = (error as { data?: { conflicts?: ClassConflict[] } }).data;
      setConflicts(data?.conflicts ?? []);
    } finally {
      setPending(false);
    }
  }

  const splitDate = editing?.session.occurrence_date;
  return (
    <Modal
      opened
      onClose={() => !pending && onClose()}
      title={editing ? (following ? "반복 수업 수정 · 이후 전체" : "수업 수정") : "수업 추가"}
      closeButtonProps={{ "aria-label": "창 닫기", disabled: pending }}
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
    >
      <form className={`${staffStyles.form} ${styles.modalForm}`} onSubmit={submit} aria-label="수업 정보">
        {following && splitDate && (
          <p className={styles.notice}>
            {shortDate(splitDate)} 회차부터 바뀝니다. 이전 회차는 그대로 두고, 휴강·삭제한 날짜는 유지합니다.
          </p>
        )}
        <Select
          label="수업 종류"
          required
          allowDeselect={false}
          value={values.typeId || null}
          onChange={(value) => value && chooseType(value)}
          data={typeOptions.map((type) => ({
            value: type.id,
            label: type.is_active ? type.name : `${type.name} (사용 중지)`,
          }))}
          disabled={pending}
        />
        <Select
          label="강사"
          required={!editing}
          allowDeselect={false}
          placeholder="강사 선택"
          value={values.instructorId || (editing ? UNASSIGNED : null)}
          onChange={(value) => set("instructorId")(!value || value === UNASSIGNED ? "" : value)}
          data={[
            ...(editing ? [{ value: UNASSIGNED, label: "강사 미정" }] : []),
            ...instructors.map((item) => ({ value: item.id, label: item.name })),
          ]}
          disabled={pending}
        />
        {!editing && (
          <SegmentedControl
            value={repeat ? "repeat" : "once"}
            onChange={(value) => setRepeat(value === "repeat")}
            data={[
              { value: "once", label: "단발 수업" },
              { value: "repeat", label: "매주 반복" },
            ]}
            disabled={pending}
            aria-label="반복 여부"
          />
        )}
        {!following && (
          <TextInput
            label={repeat ? "시작일" : "날짜"}
            type="date"
            required
            min={today}
            max={horizon}
            value={values.date}
            onChange={(event) => chooseDate(event.currentTarget.value)}
            disabled={pending}
          />
        )}
        {(repeat || following) && (
          <>
            <div>
              <span className={styles.fieldLabel} id="weekday-label">반복 요일</span>
              <Chip.Group
                multiple
                value={values.weekdays}
                onChange={(value) => {
                  setWeekdaysTouched(true);
                  set("weekdays")(value);
                }}
              >
                <div className={styles.weekdays} role="group" aria-labelledby="weekday-label">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <Chip key={label} value={String(index + 1)} size="xs" disabled={pending}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </Chip.Group>
            </div>
            <TextInput
              label="종료일"
              description="비워두면 계속 반복합니다."
              type="date"
              min={following && splitDate ? splitDate : values.date}
              value={values.endDate}
              onChange={(event) => set("endDate")(event.currentTarget.value)}
              disabled={pending}
            />
          </>
        )}
        <TextInput
          label="시작 시각"
          type="time"
          required
          step={300}
          value={values.startTime}
          onChange={(event) => set("startTime")(event.currentTarget.value)}
          disabled={pending}
        />
        <NumberChips
          legend="소요시간"
          unit="분"
          options={DURATION_OPTIONS}
          value={Number(values.duration)}
          onChange={(value) => set("duration")(String(value))}
          hint={endMinutes > 0 && endMinutes <= 1440 ? `종료 ${minutesToTime(endMinutes)}` : undefined}
          disabled={pending}
        />
        <NumberChips
          legend="정원"
          unit="명"
          options={CAPACITY_OPTIONS}
          value={Number(values.capacity)}
          onChange={(value) => set("capacity")(String(value))}
          disabled={pending}
        />
        {error && <p role="alert" className={`${staffStyles.message} ${staffStyles.error}`}>{error}</p>}
        <ConflictList conflicts={conflicts} />
        <div className={staffStyles.footer}>
          <Button variant="default" disabled={pending} onClick={onClose}>
            취소
          </Button>
          <Button type="submit" loading={pending}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
