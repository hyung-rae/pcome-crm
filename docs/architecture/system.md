# 시스템 구조

최종 갱신: 2026-10-22
상태: 기본 대시보드와 직원 인증·관리자 관리 구현

## 구성

Next.js App Router와 TypeScript를 사용합니다. UI는 Mantine이며 PostCSS 프리셋을 연결했습니다.
`@/*` 경로 별칭은 `src/*`를 가리킵니다. Node.js 24와 npm을 사용합니다.

## 코드 지도

| 경로 | 책임 |
|---|---|
| `src/app/layout.tsx` | 한국어 HTML, 메타데이터, Mantine 스타일·Provider·색상 스크립트 |
| `src/app/icon.svg`, `src/app/favicon.ico` | 브랜드 P 파비콘(SVG·ICO), Next.js 자동 메타데이터 |
| `src/app/page.tsx` | `/` 대시보드 진입 |
| `src/components/dashboard/` | 공통 레이아웃, PC LNB 접기·펼치기, 모바일 Drawer, 빈 상태 및 CSS Modules |
| `tests/dashboard.spec.ts`, `playwright.config.ts` | Chromium E2E 검증 |
| `src/app/globals.css` | 전역 배경·여백 스타일 |
| `src/theme.ts` | 클라이언트 테마: 오렌지 brand 주색, md 반경, 시스템 글꼴 |
| `next.config.ts` | Mantine 패키지 import 최적화 |
| `postcss.config.cjs` | Mantine PostCSS 및 반응형 breakpoint 변수 |
| `package.json` | 실행·검증 명령 및 의존성 |

## 화면 및 테마

후속 UI 작업은 [UI 공통 가이드](ui-guide.md)를 따른다. 사용자가 현재 대시보드의 색상·크기·모양을 공통 기준으로 지정했다. `AGENTS.md`에도 가이드 확인 및 기존 패턴 재사용 규칙을 기록했다.

루트 레이아웃에서 MantineProvider와 ColorSchemeScript를 연결합니다.
기본 색상 모드는 light이며, 컴포넌트별 스타일은 CSS Modules를 사용합니다.
현재 `/`는 차콜 앱 프레임·공통 상단바 안에 LNB와 밝은 본문을 가진 대시보드 빈 상태를 표시합니다. 토글은 공통 상단바에 고정됩니다. 프레임은 화면 높이에 맞추며 상단바·LNB는 프레임 기준 배치, 본문 영역만 내부 스크롤됩니다.
992px 이상에서 PC LNB를 248px↔88px로 접고 펼치며, 작은 화면에서는 Mantine Drawer를 사용합니다. 상태는 클라이언트 메모리에서만 관리합니다. Drawer portal에는 색상 변수와 포커스 스타일을 별도로 제공합니다. 상세 동작과 검증은 [대시보드 기능 문서](../features/dashboard-ui.md)를 참고합니다.

## 데이터 및 외부 연동

Supabase Auth·Postgres를 연결했다. public.staff에 직원 정보와 역할·활성 상태를 저장한다. src/proxy.ts에서 쿠키 세션을 갱신하고 각 보호 페이지·API에서 Auth getUser와 RLS를 통한 활성 직원 조회로 권한을 확인한다. 서버 관리 키는 src/lib/supabase/admin.ts에서만 사용한다. 회원·상품·결제 테이블은 아직 없다.

[Supabase 설정](supabase.md), [ERD](erd.md), [직원 인증 기능](../features/admin-auth.md)에 실제 데이터·정책·코드 지도를 기록한다.

생성된 .archify 소스 스냅샷과 tests/.auth는 앱 타입 검사·린트 대상에서 제외한다. 다른 작업이 만든 산출물 내용은 이 작업에서 수정하지 않는다.

## 관련 문서

- [프로젝트 현황](../overview.md)
- [실행·검증](../../README.md)

관리자 관리 UI: 생성은 버튼에서 Modal로 열고 행별 조작은 Mantine Menu portal로 표시한다. 폼 오류와 목록 조회 오류는 별도 상태로 관리한다. `src/app/globals.css`의 `--crm-form-control-height: 40px`를 인증·직원 폼 CSS가 공유한다. 상세 동작은 [직원 인증·관리](../features/admin-auth.md), 검증은 [UI 개선 계획](../plans/staff-ui.md)을 참고한다.

공통 상단바 계정 UI: `dashboard.tsx`가 staff 이름·역할을 표시하고 `/password` 링크·LogoutButton을 제공한다. 이전 GitHub/WORKSPACE 우측 장식과 내부 헤더 중복 계정 영역은 제거했다. 직원 더보기는 ActionIcon(32px)/SVG(16px)와 Tooltip/Menu 조합이다.

로딩·공통 알림: `src/app/loading.tsx` → `components/common/page-loading.tsx`, 메뉴/계정 Link → `link-loading.tsx`(Next useLinkStatus). 공통 권한 배지는 `role-badge.tsx`, 직원 관리 성공 알림은 `success-toast.tsx` portal을 사용한다. 직원 상태 변경은 기존 PATCH API를 재사용하고 클라이언트가 요청 중 충돌·중복 제출을 차단한다. 서버 권한·DB 구조는 변경하지 않는다.
