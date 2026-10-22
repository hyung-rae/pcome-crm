"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Button, Select, Skeleton, Tooltip } from "@mantine/core";
import { api } from "@/components/auth/auth-forms";
import { SuccessToast } from "@/components/common/success-toast";
import { CLASS_PALETTE } from "@/lib/classes/palette";
import {
  addDays,
  minutesToTime,
  seoulDateTime,
  seoulToday,
  shortDate,
  timeToMinutes,
  weekStart,
  weekdayLabel,
} from "@/lib/classes/dates";
import type { ClassSession, ClassType, Instructor } from "@/lib/classes/types";
import staffStyles from "@/components/staff/staff.module.css";
import { SessionDetail } from "./session-detail";
import { SessionForm, type FormTarget } from "./session-form";
import styles from "./classes.module.css";

const HOUR = 64;
// Like Mantine Schedule's startScrollTime: other weeks open at 08:00; the current week opens an hour before now.
const START_SCROLL = 8 * 60;
const nowInSeoul = () => seoulDateTime(new Date().toISOString());
const MIN_GRID_HEIGHT = 320;
const UNASSIGNED = "unassigned";
const ALL = "all";
type Placed = ClassSession & { start: number; end: number; lane: number; lanes: number };

function Arrow({ left }: { left?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={left ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
function label(session: ClassSession, started: boolean) {
  const start = seoulDateTime(session.starts_at);
  const end = seoulDateTime(session.ends_at);
  return `${session.type_name} ${shortDate(start.date)} ${start.time}–${end.time} ${session.instructor_name ?? "강사 미정"}${session.status === "cancelled" ? " 휴강" : ""}${started ? " 지난 수업" : ""}`;
}
// Overlapping sessions (different instructors) share the day column side by side.
function place(sessions: ClassSession[]) {
  const items = sessions
    .map((session) => {
      const start = timeToMinutes(seoulDateTime(session.starts_at).time);
      const minutes = (new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000;
      return { ...session, start, end: start + minutes, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    cluster.forEach((item) => (item.lanes = laneEnds.length));
    cluster = [];
    laneEnds = [];
  };
  for (const item of items) {
    if (item.start >= clusterEnd) flush();
    const lane = laneEnds.findIndex((end) => end <= item.start);
    item.lane = lane === -1 ? laneEnds.length : lane;
    laneEnds[item.lane] = item.end;
    clusterEnd = Math.max(clusterEnd, item.end);
    cluster.push(item);
    placed.push(item);
  }
  flush();
  return placed;
}

function fetchWeek(week: string) {
  return Promise.all([
    api(`/api/classes/sessions?from=${week}&to=${addDays(week, 6)}`, "GET"),
    api("/api/classes/types", "GET"),
    api("/api/classes/instructors", "GET"),
  ]);
}

export function ScheduleBoard({
  onTypeCount,
}: {
  onTypeCount?: (activeTypes: number) => void;
}) {
  const [week, setWeek] = useState(() => weekStart(seoulToday()));
  const [today, setToday] = useState(() => seoulToday());
  const [horizon, setHorizon] = useState("");
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [types, setTypes] = useState<ClassType[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [instructorFilter, setInstructorFilter] = useState(ALL);
  const [detail, setDetail] = useState<ClassSession | null>(null);
  const [form, setForm] = useState<FormTarget | null>(null);
  const dismiss = useCallback(() => setToast(""), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);

  const apply = useCallback(
    ([schedule, typeResult, instructorResult]: Awaited<ReturnType<typeof fetchWeek>>) => {
      setSessions(schedule.sessions);
      setToday(schedule.today);
      setHorizon(schedule.horizon);
      setTypes(typeResult.types);
      setInstructors(instructorResult.instructors);
    },
    [],
  );
  const fail = (error: unknown) =>
    setError(error instanceof Error ? error.message : "수업 시간표를 불러오지 못했습니다.");
  useEffect(() => {
    let active = true;
    fetchWeek(week)
      .then((result) => active && apply(result))
      .catch((error) => active && fail(error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apply, week]);
  function goTo(target: string) {
    setLoading(true);
    setError("");
    setWeek(target);
  }
  async function reload() {
    setLoading(true);
    setError("");
    try {
      apply(await fetchWeek(week));
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  }

  const visible = sessions.filter(
    (session) =>
      (typeFilter === ALL || session.class_type_id === typeFilter) &&
      (instructorFilter === ALL ||
        (instructorFilter === UNASSIGNED ? !session.instructor_id : session.instructor_id === instructorFilter)),
  );
  const byDay = new Map(days.map((day) => [day, [] as ClassSession[]]));
  visible.forEach((session) => byDay.get(seoulDateTime(session.starts_at).date)?.push(session));
  const activeTypes = types.filter((type) => type.is_active);
  const canAdd = activeTypes.length > 0 && instructors.length > 0;
  const lastWeek = horizon ? weekStart(horizon) : "";

  function saved(message: string) {
    setForm(null);
    setDetail(null);
    setToast(message);
    void reload();
  }
  function openCreate() {
    setForm({ mode: "create", date: week > today ? week : today });
  }

  let rangeStart = 8 * 60;
  let rangeEnd = 23 * 60;
  const placedByDay = new Map(days.map((day) => [day, place(byDay.get(day) ?? [])]));
  placedByDay.forEach((items) =>
    items.forEach((item) => {
      rangeStart = Math.min(rangeStart, Math.floor(item.start / 60) * 60);
      rangeEnd = Math.max(rangeEnd, Math.ceil(item.end / 60) * 60);
    }),
  );
  // The closing hour is labeled too; the grid's bottom padding keeps that label from being cut off.
  const hours = Array.from({ length: (rangeEnd - rangeStart) / 60 + 1 }, (_, index) => rangeStart + index * 60);
  const height = ((rangeEnd - rangeStart) / 60) * HOUR;
  const gridReady = !(loading && sessions.length === 0);
  const activeTypeCount = activeTypes.length;
  useEffect(() => {
    if (!loading && !error) onTypeCount?.(activeTypeCount);
  }, [loading, error, activeTypeCount, onTypeCount]);

  // The grid scrolls on its own under the sticky weekday row; it takes the height left in the workspace so the page does not scroll.
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState<number>();
  useEffect(() => {
    const element = gridRef.current;
    const main = document.getElementById("main-content");
    const workspace = main?.parentElement;
    if (!gridReady || !element || !main || !workspace) return;
    const fit = () => {
      if (!element.offsetParent) return;
      const grid = element.getBoundingClientRect();
      const top = grid.top - workspace.getBoundingClientRect().top + workspace.scrollTop;
      const below = main.getBoundingClientRect().bottom - grid.bottom;
      setGridHeight(Math.max(workspace.clientHeight - top - below, MIN_GRID_HEIGHT));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(workspace);
    observer.observe(main);
    return () => observer.disconnect();
  }, [gridReady]);
  // Scroll once per opened week, after its data loaded and the height limit applied; earlier the grid cannot scroll yet.
  const scrollPending = useRef(true);
  useEffect(() => {
    scrollPending.current = true;
  }, [week]);
  useEffect(() => {
    const element = gridRef.current;
    if (loading || error || !element || gridHeight === undefined || !scrollPending.current) return;
    const current = nowInSeoul();
    const inWeek = current.date >= week && current.date <= addDays(week, 6);
    const target = inWeek ? timeToMinutes(current.time) - 60 : START_SCROLL;
    element.scrollTop = (Math.max(target - rangeStart, 0) / 60) * HOUR;
    scrollPending.current = false;
  }, [loading, error, gridHeight, week, rangeStart]);
  // The grid only renders on the client after loading, so reading the clock here causes no hydration mismatch.
  const [now, setNow] = useState(nowInSeoul);
  useEffect(() => {
    const timer = setInterval(() => setNow(nowInSeoul()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const nowMinutes = timeToMinutes(now.time);
  // Like Mantine Schedule: a faint line across the current week, a strong one in today's column and a time pill.
  const showNow = days.includes(now.date) && nowMinutes >= rangeStart && nowMinutes <= rangeEnd;
  const nowTop = ((nowMinutes - rangeStart) / 60) * HOUR;
  // Started or finished sessions are dimmed; the minute clock keeps this current while the page stays open.
  const nowMs = new Date(`${now.date}T${now.time}:00+09:00`).getTime();
  const started = (session: ClassSession) => session.is_past || new Date(session.starts_at).getTime() <= nowMs;
  const stateClass = (session: ClassSession) =>
    `${session.status === "cancelled" ? styles.cancelled : ""} ${started(session) ? styles.past : ""}`;

  return (
    <section className={staffStyles.panel} aria-label="주간 시간표">
      <div className={staffStyles.toolbar}>
        <div className={styles.toolbarGroup}>
          <Tooltip label="이전 주">
            <ActionIcon size={32} variant="default" aria-label="이전 주" disabled={loading} onClick={() => goTo(addDays(week, -7))}>
              <Arrow left />
            </ActionIcon>
          </Tooltip>
          <span className={styles.weekLabel} aria-live="polite">
            {shortDate(days[0])} – {shortDate(days[6])}
          </span>
          <Tooltip label="다음 주">
            <ActionIcon
              size={32}
              variant="default"
              aria-label="다음 주"
              disabled={loading || (!!lastWeek && week >= lastWeek)}
              onClick={() => goTo(addDays(week, 7))}
            >
              <Arrow />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="default" disabled={loading || week === weekStart(today)} onClick={() => goTo(weekStart(today))}>
            오늘
          </Button>
        </div>
        <div className={styles.filters}>
          <Select
            aria-label="수업 종류 필터"
            allowDeselect={false}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value ?? ALL)}
            data={[{ value: ALL, label: "전체 수업 종류" }, ...types.map((type) => ({ value: type.id, label: type.name }))]}
          />
          <Select
            aria-label="강사 필터"
            allowDeselect={false}
            value={instructorFilter}
            onChange={(value) => setInstructorFilter(value ?? ALL)}
            data={[
              { value: ALL, label: "전체 강사" },
              ...instructors.map((item) => ({ value: item.id, label: item.name })),
              { value: UNASSIGNED, label: "강사 미정" },
            ]}
          />
          <Button size="xs" disabled={loading || !canAdd} onClick={openCreate}>
            수업 추가
          </Button>
        </div>
      </div>
      {!loading && !error && !canAdd && (
        <p className={styles.hint}>
          {activeTypes.length === 0
            ? "수업을 추가하려면 '수업 종류' 탭에서 수업 종류를 먼저 등록해주세요."
            : "강사로 지정된 직원이 없습니다. 관리자가 관리자 관리 화면에서 강사를 지정해야 수업을 추가할 수 있습니다."}
        </p>
      )}
      {toast && <SuccessToast key={toast} message={toast} onClose={dismiss} />}
      {error && (
        <p role="alert" className={`${staffStyles.message} ${staffStyles.error}`}>
          {error}{" "}
          <Button size="xs" variant="default" onClick={() => void reload()}>
            다시 시도
          </Button>
        </p>
      )}
      {!gridReady ? (
        <div role="status" aria-label="수업 시간표를 불러오는 중입니다." className={staffStyles.skeleton}>
          {[0, 1, 2].map((row) => <Skeleton key={row} height={48} radius={6} mt={12} />)}
        </div>
      ) : (
        <>
        <div
          ref={gridRef}
          className={`${styles.gridScroll} ${styles.desktopOnly}`}
          style={{ maxHeight: gridHeight }}
          aria-busy={loading}
        >
          <div className={styles.grid} role="group" aria-label="주간 시간표 그리드">
            <div className={styles.dayHead} aria-hidden="true" />
            {days.map((day) => (
              <div key={day} className={`${styles.dayHead} ${day === today ? styles.today : ""}`} aria-hidden="true">
                <strong>{weekdayLabel(day)}</strong>
                {shortDate(day)}
              </div>
            ))}
            <div className={styles.timeColumn} style={{ height }} aria-hidden="true">
              {hours
                // Hide an hour label the current time pill would cover.
                .filter((minute) => !showNow || Math.abs(minute - nowMinutes) >= 15)
                .map((minute) => (
                  <span key={minute} className={styles.timeLabel} style={{ top: Math.max(((minute - rangeStart) / 60) * HOUR, 8) }}>
                    {minutesToTime(minute)}
                  </span>
                ))}
              {showNow && (
                <>
                  <div className={styles.nowTrack} style={{ top: nowTop }} />
                  <span className={styles.nowPill} style={{ top: nowTop }}>
                    {now.time}
                  </span>
                </>
              )}
            </div>
            {days.map((day) => (
              <div
                key={day}
                className={styles.dayColumn}
                style={{ height, backgroundSize: `100% ${HOUR}px` }}
                role="group"
                aria-label={`${shortDate(day)} ${weekdayLabel(day)}요일`}
              >
                {showNow && (
                  <div className={day === now.date ? styles.nowLine : styles.nowTrack} style={{ top: nowTop }} aria-hidden="true" />
                )}
                {placedByDay.get(day)!.map((item) => {
                  const palette = CLASS_PALETTE[item.color];
                  return (
                    <Tooltip
                      key={item.id}
                      openDelay={150}
                      withArrow
                      label={
                        <div className={styles.blockTip}>
                          <span>
                            {minutesToTime(item.start)}–{minutesToTime(item.end)}
                          </span>
                          <span>강사 {item.instructor_name ?? "미정"}</span>
                          <span>정원 {item.capacity}명</span>
                        </div>
                      }
                    >
                      <button
                        type="button"
                        className={`${styles.block} ${stateClass(item)}`}
                        style={{
                          top: ((item.start - rangeStart) / 60) * HOUR + 1,
                          height: Math.max(((item.end - item.start) / 60) * HOUR - 2, 22),
                          left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / item.lanes}% - 4px)`,
                          background: palette.background,
                          borderLeftColor: palette.border,
                          color: palette.text,
                        }}
                        aria-label={label(item, started(item))}
                        onClick={() => setDetail(item)}
                      >
                        <strong>
                          {item.type_name}
                          {item.status === "cancelled" && <span className={styles.tag}>휴강</span>}
                        </strong>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.list} ${styles.mobileOnly}`} aria-busy={loading}>
          {days.map((day) => {
            const items = byDay.get(day) ?? [];
            return (
              <section key={day} className={styles.day} aria-label={`${shortDate(day)} ${weekdayLabel(day)}요일`}>
                <h3>
                  {shortDate(day)} ({weekdayLabel(day)}){day === today && <span>오늘</span>}
                </h3>
                {items.length === 0 ? (
                  <p className={styles.empty}>수업 없음</p>
                ) : (
                  items.map((item) => {
                    const palette = CLASS_PALETTE[item.color];
                    const start = seoulDateTime(item.starts_at);
                    const end = seoulDateTime(item.ends_at);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.listItem} ${stateClass(item)}`}
                        style={{ background: palette.background, borderLeftColor: palette.border, color: palette.text }}
                        aria-label={label(item, started(item))}
                        onClick={() => setDetail(item)}
                      >
                        <span>
                          {start.time}–{end.time}
                        </span>
                        <span>
                          <strong>
                            {item.type_name}
                            {item.status === "cancelled" && <span className={styles.tag}>휴강</span>}
                          </strong>
                          <small className={item.instructor_name ? undefined : styles.unassigned}>
                            {item.instructor_name ?? "강사 미정"} · 정원 {item.capacity}명
                          </small>
                        </span>
                      </button>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
        </>
      )}
      {!loading && !error && visible.length === 0 && (
        <p className={styles.hint}>{sessions.length === 0 ? "이번 주에 등록된 수업이 없습니다." : "필터 조건에 맞는 수업이 없습니다."}</p>
      )}
      {detail && (
        <SessionDetail
          session={{ ...detail, is_past: started(detail) }}
          onClose={() => setDetail(null)}
          onEdit={(scope) => {
            setForm({ mode: "edit", session: detail, scope });
            setDetail(null);
          }}
          onDone={saved}
        />
      )}
      {form && (
        <SessionForm
          target={form}
          types={types}
          instructors={instructors}
          today={today}
          horizon={horizon}
          onClose={() => setForm(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}
