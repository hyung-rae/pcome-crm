# 시스템 구조

최종 갱신: 2026-10-22
상태: 기본 대시보드 UI 구현 완료

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

데이터베이스, 인증, 외부 API와 영속 저장소는 아직 없습니다.
기능 기획 확정 후 도입 시 이 문서와 관련 세부 문서를 갱신합니다.

## 관련 문서

- [프로젝트 현황](../overview.md)
- [실행·검증](../../README.md)
