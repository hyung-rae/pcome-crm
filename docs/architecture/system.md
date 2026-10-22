# 시스템 구조

최종 갱신: 2026-10-22
상태: 초기 기반 구현

## 구성

Next.js App Router와 TypeScript를 사용합니다. UI는 Mantine이며 PostCSS 프리셋을 연결했습니다.
`@/*` 경로 별칭은 `src/*`를 가리킵니다. Node.js 24와 npm을 사용합니다.

## 코드 지도

| 경로 | 책임 |
|---|---|
| `src/app/layout.tsx` | 한국어 HTML, 메타데이터, Mantine 스타일·Provider·색상 스크립트 |
| `src/app/page.tsx` | `/` 시작 페이지 |
| `src/app/globals.css` | 전역 배경·여백 스타일 |
| `src/theme.ts` | 클라이언트 테마: 파란 주색, md 반경, 시스템 글꼴 |
| `next.config.ts` | Mantine 패키지 import 최적화 |
| `postcss.config.cjs` | Mantine PostCSS 및 반응형 breakpoint 변수 |
| `package.json` | 실행·검증 명령 및 의존성 |

## 화면 및 테마

루트 레이아웃에서 MantineProvider와 ColorSchemeScript를 연결합니다.
기본 색상 모드는 light이며, 컴포넌트별 스타일은 CSS Modules를 사용합니다.
현재 `/`는 환경 구성 완료 안내만 표시합니다.

## 데이터 및 외부 연동

데이터베이스, 인증, 외부 API와 영속 저장소는 아직 없습니다.
기능 기획 확정 후 도입 시 이 문서와 관련 세부 문서를 갱신합니다.

## 관련 문서

- [프로젝트 현황](../overview.md)
- [실행·검증](../../README.md)
