# 프로젝트 현황

최종 갱신: 2026-10-22

## 목적 및 범위

PCOME CRM 웹앱의 개발 기반을 구성한 상태입니다. 구체적인 업무 기능과 사용자·권한 정책은 아직 확정되지 않았습니다.

## 현재 구현

- Next.js App Router + TypeScript
- Mantine 공통 Provider, 브랜드 오렌지 테마, 반응형 대시보드 빈 상태
- 차콜 앱 프레임·공통 상단바와 고정 토글, PC LNB 및 모바일 Drawer 메뉴
- 헤더 우측 GitHub 저장소 링크, 브랜드 P 파비콘
- 작은 버튼 패딩·16px 메뉴 아이콘, 닫기 버튼 hover 대비
- [UI 공통 가이드](architecture/ui-guide.md): 현재 대시보드를 이후 UI의 색상·크기·간격 기준으로 사용
- LNB 200ms 전환 애니메이션·동작 줄이기 설정 지원
- Chromium Playwright E2E 테스트
- npm, ESLint, 타입 검사, 빌드 명령
- Git main 브랜치 및 Git 이모지 커밋 규칙

대시보드 UI는 사용자 최종 확인을 받아 완료했습니다. 업무 기능, 인증, 데이터베이스, API 연동은 아직 구현하지 않았습니다.

## 진입 문서

- [시스템 구조 및 코드 위치](architecture/system.md)
- [작업 절차](workflow.md)
- [기능 및 문서 색인](README.md)
- [실행 및 검증 방법](../README.md)

## 검증 현황과 알려진 제한

대시보드의 Chromium E2E 12개, 린트, 타입 검사 및 Webpack 빌드를 통과했습니다. Turbopack 빌드는 내부 포트 생성 권한 제한으로 실패했습니다. 검증 결과·수정 이력은 [작업계획](plans/dashboard-ui.md)에 기록합니다.

초기 구성 시 린트, 타입 검사 및 Webpack 빌드를 통과했습니다.
Turbopack 빌드는 당시 실행 환경의 내부 포트 생성 제한으로 실패했습니다.
이후 개발 서버의 8888 포트 실행과 사용자 접속을 확인했으며 이번 작업에서는 이미 실행 중인 개발 서버 `http://localhost:3002`를 재사용했습니다.
초기 의존성 검사에서 개발용 ESLint 의존성의 high 경고 5건이 확인되었습니다. 상세 내용은 루트 README를 참고합니다.
