"use client";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { ActionIcon, Button, CheckIcon, Menu, Modal, Radio, Skeleton, TextInput, Tooltip } from "@mantine/core";
import { api } from "@/components/auth/auth-forms";
import { SuccessToast } from "@/components/common/success-toast";
import { CLASS_COLORS, CLASS_PALETTE, type ClassColor } from "@/lib/classes/palette";
import type { ClassType } from "@/lib/classes/types";
import staffStyles from "@/components/staff/staff.module.css";
import { CAPACITY_OPTIONS, DURATION_OPTIONS, NumberChips } from "./number-chips";
import styles from "./classes.module.css";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "연결 상태를 확인해주세요.";

export function ClassTypeManager({ onCount }: { onCount?: (activeTypes: number) => void }) {
  const [types, setTypes] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<ClassType | "new" | null>(null);
  const [color, setColor] = useState<ClassColor>("orange");
  const [capacity, setCapacity] = useState(20);
  const [duration, setDuration] = useState(50);
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const dismiss = useCallback(() => setToast(""), []);
  const activeCount = types.filter((type) => type.is_active).length;
  useEffect(() => {
    if (!loading && !error) onCount?.(activeCount);
  }, [loading, error, activeCount, onCount]);

  const load = useCallback(async () => {
    setError("");
    try {
      setTypes((await api("/api/classes/types", "GET")).types);
    } catch (error) {
      setError(message(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api("/api/classes/types", "GET")
      .then((result) => active && setTypes(result.types))
      .catch((error) => active && setError(message(error)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function open(target: ClassType | "new") {
    setFormError("");
    setColor(target === "new" ? "orange" : target.color);
    setCapacity(target === "new" ? 20 : target.default_capacity);
    setDuration(target === "new" ? 50 : target.default_duration_minutes);
    setEditing(target);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !editing) return;
    const body = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      default_capacity: capacity,
      default_duration_minutes: duration,
      color,
    };
    setPending(true);
    setFormError("");
    try {
      if (editing === "new") await api("/api/classes/types", "POST", body);
      else await api(`/api/classes/types/${editing.id}`, "PATCH", { ...body, action: "update" });
      setToast(editing === "new" ? "수업 종류 등록 완료" : "수업 종류 수정 완료");
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(message(error));
    } finally {
      setPending(false);
    }
  }
  async function toggle(type: ClassType) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await api(`/api/classes/types/${type.id}`, "PATCH", { action: "active", is_active: !type.is_active });
      setToast(type.is_active ? "사용 중지 완료" : "다시 사용 완료");
      await load();
    } catch (error) {
      setError(message(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={staffStyles.panel} aria-label="수업 종류 관리">
      <div className={staffStyles.toolbar}>
        <h2>수업 종류</h2>
        <Button size="xs" disabled={loading || pending} onClick={() => open("new")}>
          수업 종류 추가
        </Button>
      </div>
      {toast && <SuccessToast key={toast} message={toast} onClose={dismiss} />}
      {error && <p role="alert" className={`${staffStyles.message} ${staffStyles.error}`}>{error}</p>}
      <div className={staffStyles.table} aria-busy={loading}>
        {loading ? (
          <div role="status" aria-label="수업 종류를 불러오는 중입니다." className={staffStyles.skeleton}>
            {[0, 1, 2].map((row) => (
              <div className={staffStyles.skeletonRow} key={row} aria-hidden="true">
                {[0, 1, 2, 3, 4].map((column) => <Skeleton key={column} height={18} radius={4} />)}
              </div>
            ))}
          </div>
        ) : types.length === 0 ? (
          <p className={staffStyles.message}>
            {error ? "목록을 불러오지 못했습니다." : "등록된 수업 종류가 없습니다. 수업 종류를 먼저 추가해주세요."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>기본 정원</th>
                <th>기본 시간</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  <td>
                    <span className={styles.nameCell}>
                      <span
                        className={styles.dot}
                        style={{ background: CLASS_PALETTE[type.color].background, borderColor: CLASS_PALETTE[type.color].border }}
                        aria-hidden="true"
                      />
                      {type.name}
                    </span>
                  </td>
                  <td>{type.default_capacity}명</td>
                  <td>{type.default_duration_minutes}분</td>
                  <td className={type.is_active ? undefined : styles.muted}>{type.is_active ? "사용" : "사용 중지"}</td>
                  <td>
                    <Menu withinPortal position="bottom-end" width={160} shadow="sm" returnFocus>
                      <Menu.Target>
                        <Tooltip label="더보기" position="top">
                          <ActionIcon size={32} variant="default" disabled={pending} aria-label={`${type.name} 관리 더보기`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <circle cx="5" cy="12" r="1.6" />
                              <circle cx="12" cy="12" r="1.6" />
                              <circle cx="19" cy="12" r="1.6" />
                            </svg>
                          </ActionIcon>
                        </Tooltip>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => open(type)}>수정</Menu.Item>
                        <Menu.Item onClick={() => void toggle(type)}>{type.is_active ? "사용 중지" : "다시 사용"}</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal
        opened={editing !== null}
        onClose={() => !pending && setEditing(null)}
        title={editing === "new" ? "수업 종류 추가" : "수업 종류 수정"}
        closeButtonProps={{ "aria-label": "창 닫기", disabled: pending }}
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
      >
        {editing && (
          <form className={`${staffStyles.form} ${styles.modalForm}`} onSubmit={save} aria-label="수업 종류 정보">
            <TextInput
              name="name"
              label="이름"
              required
              maxLength={30}
              defaultValue={editing === "new" ? "" : editing.name}
              disabled={pending}
            />
            <NumberChips legend="기본 정원" unit="명" options={CAPACITY_OPTIONS} value={capacity} onChange={setCapacity} disabled={pending} />
            <NumberChips
              legend="기본 소요시간"
              unit="분"
              options={DURATION_OPTIONS}
              value={duration}
              onChange={setDuration}
              disabled={pending}
            />
            <fieldset className={styles.chipField}>
              <legend className={styles.fieldLabel}>색상</legend>
              <Radio.Group value={color} onChange={(value) => setColor(value as ClassColor)}>
                <div className={styles.colorCards}>
                  {CLASS_COLORS.map((key) => {
                    const palette = CLASS_PALETTE[key];
                    return (
                      <Radio.Card
                        key={key}
                        value={key}
                        withBorder={false}
                        className={styles.colorCard}
                        style={{ background: palette.background, color: palette.text, "--card-accent": palette.border } as CSSProperties}
                        disabled={pending}
                      >
                        {palette.label}
                        {color === key && <CheckIcon size={12} />}
                      </Radio.Card>
                    );
                  })}
                </div>
              </Radio.Group>
            </fieldset>
            {formError && <p role="alert" className={`${staffStyles.message} ${staffStyles.error}`}>{formError}</p>}
            <div className={staffStyles.footer}>
              <Button variant="default" disabled={pending} onClick={() => setEditing(null)}>
                취소
              </Button>
              <Button type="submit" loading={pending}>
                {editing === "new" ? "추가" : "저장"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
