"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Staff } from "@/lib/auth/types";
import { LogoutButton } from "@/components/auth/auth-forms";
import Link from "next/link";
import { Drawer, Tooltip } from "@mantine/core";
import { RoleBadge } from "@/components/common/role-badge";
import styles from "./dashboard.module.css";

function Icon({
  kind,
  size = 16,
}: {
  kind: "grid" | "users" | "menu" | "chart" | "collapse";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "grid" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      ) : kind === "users" ? (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
        </>
      ) : kind === "collapse" ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M16 9l-3 3 3 3" />
        </>
      ) : kind === "menu" ? (
        <path d="M4 6h16M4 12h16M4 18h16" />
      ) : (
        <>
          <path d="M4 4v16h16M9 15v-3M14 15V8M19 15V5" />
        </>
      )}
    </svg>
  );
}

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        P<span>′</span>
      </span>
      <div>
        <strong>
          PCOME<span> CRM</span>
        </strong>
        <small>PATRICK’S OUTCOME</small>
      </div>
    </div>
  );
}

function Navigation({
  onNavigate,
  collapsed = false,
  isAdmin,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="주 메뉴" className={styles.navigation}>
        <p className={styles.navLabel}>WORKSPACE</p>
        <Tooltip label="대시보드" disabled={!collapsed} position="right">
          <Link
            href="/"
            onClick={onNavigate}
            aria-label="대시보드"
            aria-current={pathname === "/" ? "page" : undefined}
            className={pathname === "/" ? styles.active : styles.navLink}
          >
            <Icon kind="grid" />
            <span className={styles.navText}>대시보드</span>
            {pathname === "/" && <span className={styles.activeDot} />}
          </Link>
        </Tooltip>
        {isAdmin && (
          <Tooltip label="관리자 관리" disabled={!collapsed} position="right">
            <Link
              href="/admin/staff"
              onClick={onNavigate}
              aria-label="관리자 관리"
              aria-current={pathname === "/admin/staff" ? "page" : undefined}
              className={
                pathname === "/admin/staff" ? styles.active : styles.navLink
              }
            >
              <Icon kind="users" />
              <span className={styles.navText}>관리자 관리</span>
              {pathname === "/admin/staff" && (
                <span className={styles.activeDot} />
              )}
            </Link>
          </Tooltip>
        )}
      </nav>
      <div className={styles.sidebarFooter}>
        <span className={styles.footerLine} />
        <strong>Better work. Better outcome.</strong>
        <span>PCOME CRM · 관리 워크스페이스</span>
      </div>
    </>
  );
}

export function Dashboard({
  staff,
  title = "대시보드",
  children,
}: {
  staff: Staff;
  title?: string;
  children?: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      <a href="#main-content" className={styles.skipLink}>
        본문으로 건너뛰기
      </a>
      <div className={styles.appFrame}>
        <header className={styles.appBar} aria-label="앱 공통 상단바">
          <div className={styles.desktopToggle}>
            {" "}
            <Tooltip
              label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
              position="bottom"
            >
              <button
                className={styles.collapseButton}
                aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
                aria-expanded={!collapsed}
                aria-controls="desktop-lnb"
                onClick={() => setCollapsed(!collapsed)}
              >
                <Icon kind="collapse" />
              </button>
            </Tooltip>
          </div>
          <button
            className={styles.menuButton}
            aria-label="메뉴 열기"
            aria-expanded={opened}
            aria-haspopup="dialog"
            onClick={() => setOpened(true)}
          >
            <Icon kind="menu" />
          </button>
          <span className={styles.appTitle}>
            PCOME <span>CRM</span>
          </span>
          <div className={styles.account} aria-label="로그인 계정">
            <Tooltip label={`${staff.name} · ${staff.role === "admin" ? "관리자" : "서브관리자"} · 비밀번호 변경`} position="bottom">
              <Link href="/password" className={styles.accountLink} aria-label={`${staff.name} · ${staff.role === "admin" ? "관리자" : "서브관리자"} · 비밀번호 변경`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
                <span className={styles.accountName}>{staff.name}</span>
                <span className={styles.accountRole}><RoleBadge role={staff.role} /></span>
              </Link>
            </Tooltip>
            <LogoutButton className={styles.logoutButton} errorClassName={styles.logoutError} />
          </div>
        </header>
        <aside className={styles.sidebar} id="desktop-lnb">
          <div className={styles.lnbHeader}>
            <Brand />
          </div>
          <Navigation collapsed={collapsed} isAdmin={staff.role === "admin"} />
        </aside>
        <Drawer
          opened={opened}
          onClose={() => setOpened(false)}
          title="워크스페이스 메뉴"
          size={280}
          classNames={{ content: styles.drawer, header: styles.drawerHeader }}
          closeButtonProps={{
            "aria-label": "메뉴 닫기",
            size: 32,
            iconSize: 16,
          }}
          returnFocus
          trapFocus
          closeOnEscape
          closeOnClickOutside
        >
          <Brand />
          <Navigation
            onNavigate={() => setOpened(false)}
            isAdmin={staff.role === "admin"}
          />
        </Drawer>
        <div className={styles.workspace}>
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <span className={styles.breadcrumb}>워크스페이스</span>
              <span className={styles.slash}>/</span>
              <span>{title}</span>
            </div>
          </header>
          <main id="main-content" className={styles.main} tabIndex={-1}>
            <div className={styles.pageHeading}>
              <p className={styles.eyebrow}>YOUR WORKSPACE, AT A GLANCE</p>
              <h1>
                {title}
                <span>.</span>
              </h1>
              <p className={styles.description}>
                {children
                  ? "직원 계정과 접근 권한을 관리하세요."
                  : "업무의 시작부터 다음 단계까지, 한곳에서 관리하세요."}
              </p>
            </div>
            {children ? (
              <div style={{ marginTop: 30 }}>{children}</div>
            ) : (
              <section
                className={styles.overview}
                aria-labelledby="overview-title"
              >
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 id="overview-title">워크스페이스 현황</h2>
                    <p>연결된 업무 데이터를 이곳에서 확인할 수 있습니다.</p>
                  </div>
                  <span className={styles.badge}>
                    <span />
                    데이터 연결 전
                  </span>
                </div>
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>
                    <Icon kind="chart" size={24} />
                  </div>
                  <h3>아직 연결된 업무 데이터가 없습니다</h3>
                  <p>
                    업무 데이터가 연결되면 주요 현황을 한눈에 볼 수 있습니다.
                  </p>
                  <span className={styles.emptyNote}>
                    새로운 업무를 위한 공간이 준비되어 있어요.
                  </span>
                </div>
                <div className={styles.panelFooter}>
                  <span className={styles.footerDot} />
                  실제 데이터가 연결되면 현황이 표시됩니다.
                </div>
              </section>
            )}
            <footer className={styles.pageFooter}>
              <span>© PCOME CRM</span>
              <span>더 나은 관리를 위한 시작</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
