# 프로젝트 문서 색인

새 작업은 이 문서부터 읽습니다. 문서는 현재 구현을 이해하는 출발점이며, 수정 시 관련 소스와 실제 동작을 확인합니다.

서비스 종료·연동 해제 준비 중입니다(2026-10-23). 실제 원격 종료 여부는 미확인입니다. 복구 시 [서비스 종료 준비 및 재연결 명세](architecture/service-recovery.md)를 먼저 확인합니다.

## 읽는 순서

1. [프로젝트 현황](overview.md)
2. [작업 및 문서 관리 절차](workflow.md)
3. 해당 기능의 기획·작업계획·기능 문서
4. 영향받는 시스템 구조·결정 기록

## 문서 위치

| 디렉토리 | 역할 |
|---|---|
| [planning/](planning/README.md) | 기능별 기획, 사용자와 합의한 요구사항 |
| [plans/](plans/README.md) | 기획에 따른 구현 순서와 진행·검증 기록 |
| [features/](features/README.md) | 구현된 기능의 현재 동작과 관련 코드 위치 |
| [architecture/](architecture/README.md) | 공통 구조, 데이터, 시스템 간 연결 |
| [decisions/](decisions/README.md) | 주요 기술·정책 선택의 이유 |
| [templates/](templates/README.md) | 문서 작성 양식 |

## 기능 목록

구현된 UI와 진행 중인 기능의 관련 문서를 아래에 연결합니다. 직원 인증·관리를 Supabase에 연결했으며 회원 업무 데이터는 후속 범위입니다.

| 기능 ID | 기능 | 기획 | 작업계획 | 현재 기능 문서 | 상태 |
|---|---|---|---|---|---|
| dashboard-ui | 기본 대시보드 UI | [기획](planning/dashboard-ui.md) | [계획](plans/dashboard-ui.md) | [기능 문서](features/dashboard-ui.md) | 완료 |
| admin-auth | 로그인 및 관리자 관리·Supabase 연결 | [기획](planning/admin-auth.md) | [계획](plans/admin-auth.md) | [기능 문서](features/admin-auth.md) | 완료 |
| staff-delete | 서브관리자 삭제 | [기획](planning/staff-delete.md) | [계획](plans/staff-delete.md) | [직원 관리](features/admin-auth.md) | 완료 |
| staff-ui | 관리자 관리 UI 개선 | [기획](planning/staff-ui.md) | [계획](plans/staff-ui.md) | [직원 관리](features/admin-auth.md) | 완료 |
| loading-staff-controls | 로딩·직원 목록 조작 개선 | [기획](planning/loading-staff-controls.md) | [계획](plans/loading-staff-controls.md) | [직원 관리](features/admin-auth.md) · [대시보드](features/dashboard-ui.md) | 완료 |
| class-schedule | 그룹수업 시간표 관리 | [기획](planning/class-schedule.md) | [계획](plans/class-schedule.md) | [기능 문서](features/class-schedule.md) | 완료 |
| dashboard-charts | 대시보드 수업 차트 | [기획](planning/dashboard-charts.md) | [계획](plans/dashboard-charts.md) | [대시보드](features/dashboard-ui.md) | 완료 |

현재 공통 기반은 [시스템 구조](architecture/system.md)에 기록되어 있습니다.

Supabase 프로젝트와 로컬 환경 설정·검증 범위는 [Supabase 연결 설정](architecture/supabase.md)을 참고합니다.

단일 지점의 직원·회원 기본정보 구조는 [ERD](architecture/erd.md)에 정리합니다. 상품·결제는 추후 범위이며 staff와 수업 시간표 테이블을 생성했습니다.

UI 작업 시 [UI 공통 가이드](architecture/ui-guide.md)의 색상·크기·간격·상태 기준을 따릅니다.
