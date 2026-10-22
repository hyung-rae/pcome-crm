# 프로젝트 현황

최종 갱신: 2026-10-22

## 목적 및 범위

PCOME CRM 웹앱의 개발 기반과 단일 지점 직원 인증·관리자 관리를 구현했습니다.

헬스장 한 지점의 회원 관리 시스템을 목표로 하며 상품·결제는 추후 고려합니다. [ERD](architecture/erd.md)는 사용자 확인을 받았습니다. 이메일·비밀번호 로그인, 관리자의 서브관리자 생성·수정·활성 상태 변경·임시 비밀번호 재설정, 최초 비밀번호 변경을 구현했습니다. [Supabase 연결](architecture/supabase.md)과 staff·RLS를 적용했으며 회원 테이블은 미구현입니다.

## 현재 구현

- Next.js App Router + TypeScript
- Mantine 공통 Provider, 브랜드 오렌지 테마, 반응형 대시보드 빈 상태
- 차콜 앱 프레임·공통 상단바와 고정 토글, PC LNB 및 모바일 Drawer 메뉴
- 헤더 우측 로그인 계정·권한 배지·로그아웃, 브랜드 P 파비콘
- 작은 버튼 패딩·16px 메뉴 아이콘, 닫기 버튼 hover 대비
- [UI 공통 가이드](architecture/ui-guide.md): 현재 대시보드를 이후 UI의 색상·크기·간격 기준으로 사용
- LNB 200ms 전환 애니메이션·동작 줄이기 설정 지원
- Chromium Playwright E2E 테스트
- npm, ESLint, 타입 검사, 빌드 명령
- Git main 브랜치 및 Git 이모지 커밋 규칙

대시보드 UI는 사용자 최종 확인을 받아 완료했습니다. [직원 인증·관리](features/admin-auth.md)는 구현·검증·리뷰 후 사용자 커밋 지시로 완료 처리했습니다. 회원 관리·상품·결제·배포는 후속 범위입니다.

## 진입 문서

- [시스템 구조 및 코드 위치](architecture/system.md)
- [작업 절차](workflow.md)
- [기능 및 문서 색인](README.md)
- [실행 및 검증 방법](../README.md)

## 검증 현황과 알려진 제한

이 섹션은 최신 요약만 유지합니다. 작업별 검증 명령·결과·수정 이력은 각 [작업계획](plans/README.md)에 있습니다.

- 대시보드·직원 인증·관리·삭제, 관리자 관리 UI, 로딩·직원 목록 조작·토스트 작업은 구현·검증·리뷰 후 사용자 커밋 지시로 완료했습니다.
- 최신 검증: [로딩·직원 목록 조작 작업](plans/loading-staff-controls.md)의 마지막 전체 실행 55개 테스트(현재 테스트 수 56개), 린트·타입 검사·Webpack 빌드, Chromium 세 화면 크기(1440·768·390px) 통과. [최종 커밋 리뷰](plans/admin-auth.md)에서 비밀정보 포함·문서 링크 오류 0건.
- Supabase 보안·성능 자문 지적은 없고 테스트 계정은 정리했습니다.
- 미검증: 자연 세션 만료 장시간 대기, Firefox·Safari·실물 모바일, SMTP, 배포.
- Turbopack 빌드는 실행 환경의 내부 포트 생성 제한으로 실패해 Webpack 빌드로 검증합니다.
- 개발용 ESLint 의존성 high 경고 5건은 루트 README에 기록했습니다. 개발 서버 실행·포트도 루트 README를 참고합니다.
