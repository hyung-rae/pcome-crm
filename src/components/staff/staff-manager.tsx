"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ActionIcon, Button, Menu, Modal, PasswordInput, TextInput, Tooltip, Skeleton, Switch, Loader } from "@mantine/core";
import type { StaffRow } from "@/lib/auth/types";
import { api } from "@/components/auth/auth-forms";
import { SuccessToast } from "@/components/common/success-toast";
import { RoleBadge } from "@/components/common/role-badge";
import styles from "./staff.module.css";

type Edit = { row: StaffRow; action: "rename" | "reset" | "delete" };
export function StaffManager() {
  const requestLock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null);
  const menuButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastEditId = useRef<string | null>(null);
  const [rows, setRows] = useState<StaffRow[]>([]),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [edit, setEdit] = useState<Edit | null>(null);
  const dismissMessage = useCallback(() => setMessage(""), []);
  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const result = await api("/api/staff", "GET");
      setRows(result.staff);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "직원 목록을 불러오지 못했습니다.",
      );
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api("/api/staff", "GET")
      .then((result) => {
        if (active) setRows(result.staff);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "직원 목록을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || refreshing || requestLock.current) return;
    const form = event.currentTarget,
      body = Object.fromEntries(new FormData(form));
    setPending(true);
    setFormError("");
    setMessage("");
    try {
      await api("/api/staff", "POST", body);
      form.reset();
      setCreating(false);
      setMessage("계정 생성 완료");
      await load();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "연결 상태를 확인해주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit || pending || refreshing || requestLock.current) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setFormError("");
    setError("");
    setMessage("");
    try {
      if (edit.action === "delete") {
        await api(`/api/staff/${edit.row.id}`, "DELETE", {});
        setRows((previous) => previous.filter((row) => row.id !== edit.row.id));
        setEdit(null);
        setMessage("계정 삭제 완료");
        if (!(await load()))
          setError(
            "계정은 삭제됐지만 목록 갱신에 실패했습니다. 목록을 새로고침해주세요.",
          );
        return;
      }
      await api(`/api/staff/${edit.row.id}`, "PATCH", {
        ...body,
        action: edit.action,
      });
      setEdit(null);
      setMessage(edit.action === "rename" ? "이름 변경 완료" : "비밀번호 재설정 완료");
      await load();
    } catch (error) {
      if (edit.action === "delete") await load();
      setFormError(
        error instanceof Error ? error.message : "연결 상태를 확인해주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  async function changeStatus(row: StaffRow) {
    if (pending || refreshing || requestLock.current || row.role !== "sub_admin") return;
    requestLock.current = true;
    setStatusId(row.id);
    setStatusError(null);
    setError("");
    setMessage("");
    const next = !row.is_active;
    try {
      await api(`/api/staff/${row.id}`, "PATCH", { action: "status", is_active: next });
      setRows(previous => previous.map(item => item.id === row.id ? { ...item, is_active: next } : item));
      setMessage(next ? "활성화 완료" : "비활성화 완료");
      if (!(await load())) setError("상태는 변경됐지만 목록 갱신에 실패했습니다. 목록을 새로고침해주세요.");
    } catch (error) {
      setStatusError({ id: row.id, message: error instanceof Error ? error.message : "상태 변경에 실패했습니다. 다시 시도해주세요." });
    } finally {
      requestLock.current = false;
      setStatusId(null);
    }
  }
  const busy = pending || refreshing || statusId !== null;
  return (
    <section className={styles.panel} aria-label="직원 관리">
      <div className={styles.toolbar}>
        <h2>직원 목록</h2>
        <div className={styles.actions}>
          <Tooltip label="목록 새로고침">
            <ActionIcon size={32} variant="default" aria-label="목록 새로고침" loading={loading || refreshing} disabled={busy || loading} onClick={() => { if (busy || requestLock.current) return; setError(""); void load(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" /></svg>
            </ActionIcon>
          </Tooltip>
          <Button
            size="xs"
            disabled={busy || loading}
            onClick={() => {
              setFormError("");
              setCreating(true);
            }}
          >
            서브관리자 생성
          </Button>
        </div>
      </div>
      <Modal
        opened={creating}
        onClose={() => {
          if (!pending) setCreating(false);
        }}
        title="서브관리자 생성"
        closeButtonProps={{ "aria-label": "창 닫기", disabled: pending }}
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
      >
        <form
          className={styles.form}
          onSubmit={create}
          aria-label="서브관리자 생성"
        >
          <TextInput
            name="name"
            label="이름"
            required
            maxLength={50}
            disabled={pending}
          />
          <TextInput
            name="email"
            label="이메일"
            type="email"
            autoComplete="off"
            required
            maxLength={254}
            disabled={pending}
          />
          <PasswordInput
            name="password"
            label="초기 비밀번호"
            description="영문·숫자 포함 8~16자"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={16}
            disabled={pending}
          />
          <p className={styles.message}>
            초기 비밀번호는 별도로 전달해주세요. 최초 로그인 시 변경해야 합니다.
          </p>
          {formError && (
            <p role="alert" className={`${styles.message} ${styles.error}`}>
              {formError}
            </p>
          )}
          <div className={styles.footer}>
            <Button
              variant="default"
              disabled={pending}
              onClick={() => setCreating(false)}
            >
              취소
            </Button>
            <Button type="submit" loading={pending}>
              계정 생성
            </Button>
          </div>
        </form>
      </Modal>
      {message && <SuccessToast key={message} message={message} onClose={dismissMessage} />}
      {error && (
        <p role="alert" className={`${styles.message} ${styles.error}`}>
          {error}
        </p>
      )}
      <div className={styles.table} aria-busy={loading || refreshing}>
        {refreshing && !loading && <span role="status" className={styles.message}>직원 목록을 갱신하는 중입니다.</span>}
        {loading ? (
          <div role="status" aria-label="직원 정보를 불러오는 중입니다." className={styles.skeleton}>
            <span className={styles.message}>직원 정보를 불러오는 중입니다.</span>
            {[0, 1, 2, 3].map(row => <div className={styles.skeletonRow} key={row} aria-hidden="true">{[0, 1, 2, 3, 4].map(column => <Skeleton key={column} height={18} radius={4} />)}</div>)}
          </div>
        ) : (
          <>
            {rows.length === 0 && error ? (
              <p className={styles.message}>목록을 불러오지 못했습니다. 새로고침으로 다시 시도해주세요.</p>
            ) : rows.length === 0 ? (
              <p className={styles.message}>표시할 직원이 없습니다.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>권한</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.email}</td>
                      <td><RoleBadge role={row.role} /></td>
                      <td>
                        {row.role === "sub_admin" ? <>
                          <div className={styles.statusControl} aria-busy={statusId === row.id}>
                            <Tooltip label="비활성화하면 다음 요청부터 업무 접근이 차단됩니다.">
                              <Switch checked={row.is_active} onChange={() => void changeStatus(row)} disabled={busy} size="xs" aria-label={`${row.name} 활성 상태`} aria-describedby={statusError?.id === row.id ? `status-error-${row.id}` : undefined} />
                            </Tooltip>
                            <span>{row.is_active ? "활성" : "비활성"}</span>
                            {statusId === row.id && <Loader size={14} aria-label="상태 변경 중" />}
                          </div>
                          {statusError?.id === row.id && <p role="alert" id={`status-error-${row.id}`} className={`${styles.statusError} ${styles.error}`}>{statusError.message} 토글로 다시 시도해주세요.</p>}
                        </> : <span>{row.is_active ? "활성" : "비활성"}</span>}
                      </td>
                      <td>
                        {row.role === "sub_admin" ? (
                          <Menu
                            withinPortal
                            position="bottom-end"
                            width={184}
                            shadow="sm"
                            returnFocus
                          >
                            <Menu.Target>
                              <Tooltip label="더보기" position="top">
                              <ActionIcon
                                size={32}
                                variant="default"
                                disabled={busy}
                                ref={(node) => {
                                if (node) menuButtons.current.set(row.id, node);
                                else menuButtons.current.delete(row.id);
                              }}
                              aria-label={`${row.name} 관리 더보기`}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <circle cx="5" cy="12" r="1.6" />
                                  <circle cx="12" cy="12" r="1.6" />
                                  <circle cx="19" cy="12" r="1.6" />
                                </svg>
                              </ActionIcon>
                              </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                onClick={() => {
                                  setFormError("");
                                  lastEditId.current = row.id;
                                  setEdit({ row, action: "rename" });
                                }}
                              >
                                이름 수정
                              </Menu.Item>

                              <Menu.Item
                                onClick={() => {
                                  setFormError("");
                                  lastEditId.current = row.id;
                                  setEdit({ row, action: "reset" });
                                }}
                              >
                                비밀번호 재설정
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                onClick={() => {
                                  setFormError("");
                                  lastEditId.current = row.id;
                                  setEdit({ row, action: "delete" });
                                }}
                              >
                                삭제
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      <Modal
        opened={!!edit}
        returnFocus={false}
        onExitTransitionEnd={() => {
          if (lastEditId.current) menuButtons.current.get(lastEditId.current)?.focus();
        }}
        onClose={() => {
          if (!pending) setEdit(null);
        }}
        title={
          edit?.action === "delete"
            ? "서브관리자 삭제"
            : edit?.action === "rename"
              ? "직원 이름 수정"
              : "임시 비밀번호 설정"
        }
        closeButtonProps={{ "aria-label": "창 닫기", disabled: pending }}
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
      >
        {edit && (
          <form
            onSubmit={update}
            className={styles.form}
            aria-label="직원 정보 변경"
          >
            <p className={styles.message}>
              {edit.row.name} · {edit.row.email}
            </p>
            {edit.action === "delete" && (
              <p className={styles.message}>
                로그인 계정과 직원 정보가 영구 삭제되며 복구할 수 없습니다. 기존
                로그인 세션도 종료됩니다.
              </p>
            )}
            {edit.action === "rename" && (
              <TextInput
                label="이름"
                name="name"
                defaultValue={edit.row.name}
                required
                maxLength={50}
                disabled={pending}
              />
            )}
            {edit.action === "reset" && (
              <PasswordInput
                label="임시 비밀번호"
                name="password"
                description="영문·숫자 포함 8~16자"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={16}
                disabled={pending}
              />
            )}
            {formError && (
              <p role="alert" className={`${styles.message} ${styles.error}`}>
                {formError}
              </p>
            )}
            <div className={styles.footer}>
              <Button
                variant="default"
                disabled={pending}
                onClick={() => setEdit(null)}
              >
                취소
              </Button>
              <Button
                type="submit"
                color={edit.action === "delete" ? "red" : undefined}
                loading={pending}
              >
                {edit.action === "delete" ? "삭제" : "확인"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
