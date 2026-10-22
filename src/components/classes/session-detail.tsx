"use client";
import { useState } from "react";
import { Button, Modal, Radio } from "@mantine/core";
import { api } from "@/components/auth/auth-forms";
import { WEEKDAY_LABELS, seoulDateTime, shortDate, weekdayLabel } from "@/lib/classes/dates";
import type { ClassConflict, ClassSession } from "@/lib/classes/types";
import staffStyles from "@/components/staff/staff.module.css";
import { ConflictList } from "./conflict-list";
import styles from "./classes.module.css";

type Action = "edit" | "cancel" | "restore" | "delete";
type Scope = "one" | "following";
const ACTION_LABEL: Record<Action, string> = {
  edit: "수정",
  cancel: "휴강",
  restore: "휴강 취소",
  delete: "삭제",
};
const DONE: Record<Exclude<Action, "edit">, string> = {
  cancel: "휴강 처리 완료",
  restore: "휴강 취소 완료",
  delete: "수업 삭제 완료",
};

export function describeRepeat(session: ClassSession) {
  if (!session.series) return "단발 수업";
  const days = session.series.weekdays.map((day) => WEEKDAY_LABELS[day - 1]).join("·");
  const end = session.series.end_date ? `${shortDate(session.series.end_date)}까지` : "종료일 없음";
  return `매주 ${days} · ${end}`;
}

export function SessionDetail({
  session,
  onClose,
  onEdit,
  onDone,
}: {
  session: ClassSession;
  onClose: () => void;
  onEdit: (scope: Scope) => void;
  onDone: (message: string) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [scope, setScope] = useState<Scope>("one");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<ClassConflict[]>([]);
  const start = seoulDateTime(session.starts_at);
  const end = seoulDateTime(session.ends_at);
  const repeating = !!session.series_id;

  function choose(next: Action) {
    setError("");
    setConflicts([]);
    setScope("one");
    // Single sessions need no scope choice; edits go straight to the form.
    if (next === "edit" && !repeating) return onEdit("one");
    setAction(next);
  }
  async function confirm() {
    if (!action || pending) return;
    if (action === "edit") return onEdit(scope);
    setPending(true);
    setError("");
    setConflicts([]);
    try {
      const path = `/api/classes/sessions/${session.id}`;
      if (action === "delete") await api(path, "DELETE", { scope });
      else await api(path, "PATCH", { action, scope });
      onDone(DONE[action]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "연결 상태를 확인해주세요.");
      setConflicts((error as { data?: { conflicts?: ClassConflict[] } }).data?.conflicts ?? []);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      opened
      onClose={() => !pending && onClose()}
      title={session.type_name}
      closeButtonProps={{ "aria-label": "창 닫기", disabled: pending }}
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
    >
      <div className={staffStyles.form}>
        <dl className={styles.details}>
          <dt>일시</dt>
          <dd>
            {shortDate(start.date)} ({weekdayLabel(start.date)}) {start.time}–{end.time}
          </dd>
          <dt>강사</dt>
          <dd className={session.instructor_name ? undefined : styles.unassigned}>{session.instructor_name ?? "강사 미정"}</dd>
          <dt>정원</dt>
          <dd>{session.capacity}명</dd>
          <dt>반복</dt>
          <dd>{describeRepeat(session)}</dd>
          <dt>상태</dt>
          <dd>
            {session.status === "cancelled" ? "휴강" : "정상"}
            {session.is_modified && " · 이 회차만 수정됨"}
          </dd>
        </dl>
        {session.is_past ? (
          <p className={styles.notice}>이미 시작했거나 지난 수업은 조회만 할 수 있습니다.</p>
        ) : action ? (
          <>
            {repeating && (
              <Radio.Group
                label={`${ACTION_LABEL[action]} 범위`}
                value={scope}
                onChange={(value) => setScope(value as Scope)}
              >
                <Radio value="one" label="이 회차만" mt={8} disabled={pending} />
                <Radio value="following" label="이 회차 이후 전체" mt={8} disabled={pending} />
              </Radio.Group>
            )}
            {action === "delete" && (
              <p className={styles.notice}>
                {repeating && scope === "following"
                  ? "이 회차부터 이후 반복 회차를 모두 삭제하고 반복을 종료합니다. 지난 회차는 남습니다."
                  : "이 수업을 시간표에서 삭제합니다."}
              </p>
            )}
            {error && <p role="alert" className={`${staffStyles.message} ${staffStyles.error}`}>{error}</p>}
            <ConflictList conflicts={conflicts} />
            <div className={staffStyles.footer}>
              <Button variant="default" disabled={pending} onClick={() => setAction(null)}>
                이전
              </Button>
              <Button color={action === "delete" ? "red" : undefined} loading={pending} onClick={() => void confirm()}>
                {action === "edit" ? "다음" : ACTION_LABEL[action]}
              </Button>
            </div>
          </>
        ) : (
          <div className={staffStyles.footer}>
            <Button variant="default" color="red" onClick={() => choose("delete")}>
              삭제
            </Button>
            <Button variant="default" onClick={() => choose(session.status === "cancelled" ? "restore" : "cancel")}>
              {session.status === "cancelled" ? "휴강 취소" : "휴강"}
            </Button>
            <Button onClick={() => choose("edit")}>수정</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
