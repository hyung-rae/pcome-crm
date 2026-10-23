# Supabase 연결 설정

- 최종 갱신: 2026-10-23
- 상태: 서비스 종료·연동 해제 준비. 아래는 기존 연결·적용 기록이며 현재 원격 상태는 미확인
- 관련 기획: [로그인 및 관리자 관리](../planning/admin-auth.md)

## 종료 및 재개

전체 테이블 구조·권한·함수·빈 DB 초기 설정·재연결 순서는 [서비스 종료 준비 및 재연결 명세](service-recovery.md)에 보관합니다. 이번 문서 작업에서 원격 연결 해제·삭제는 수행하지 않았습니다. 새 프로젝트에서는 마이그레이션 3개를 순서대로 적용하며, 아래 기존 프로젝트의 검증 결과를 새 환경의 검증 결과로 간주하지 않습니다.

## 프로젝트

- 이름: pcome-crm
- 프로젝트 ID: ligmwstlapvwaxovhgny
- API URL: https://ligmwstlapvwaxovhgny.supabase.co
- 리전: ap-south-1 (사용자가 생성한 프로젝트의 현재 설정)
- 사용자 지정: 무료 플랜 사용. 실제 과금 플랜은 이번 점검에서 별도로 확인하지 않았다.
- 기존 hyung-rae's Project는 사용하지 않는다.

## 로컬 설정

루트 `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, 서버 전용 `SUPABASE_SECRET_KEY`를 설정했다. 키 값은 문서에 기록하지 않는다. `.env*`는 `.gitignore`에 따라 Git에서 제외되며 빈 설정 양식 `.env.example`만 추적한다. 서버 관리 키는 브라우저에 노출하지 않는다.

## 검증과 제한

- Supabase 커넥터에서 프로젝트 ACTIVE_HEALTHY 확인
- 초기 public 스키마 조회 시 테이블 없음. 후속 로그인 작업에서 staff 생성
- 읽기 전용 SQL `select 1 as connection_ok;` 결과 1 확인
- 앱 공개 키의 Data API·Auth 연결과 비로그인 staff 접근 차단 확인
- 서버 관리 키 연결과 관리자·서브관리자 인증·권한 테스트 완료
- 사용자가 공개 회원가입 차단을 저장했고 Auth 설정 API에서 disable_signup=true 확인
- 원격 이력 버전 20261022051344(create_staff_auth)와 저장소 SQL 파일 일치. 보안·성능 자문 지적 없음
- SDK·SSR 쿠키 인증·staff·RLS 구현과 검증은 [기능 문서](../features/admin-auth.md), [작업계획](../plans/admin-auth.md)을 참고한다.
- 키는 Git 제외 파일에만 저장했다. 사용자 최종 확인 전이며 커밋하지 않았다.

서브관리자 삭제 API는 기존 서버 관리 키·세션 폐기 트리거와 auth.users→staff FK를 재사용한다. 테스트에서 생성한 계정만 삭제하여 Auth·staff 동시 제거와 기존 토큰 접근 거부를 검증한다. 운영 계정을 테스트 삭제하지 않으며 별도 마이그레이션은 없다.

2026-10-22 사용자 커밋 지시로 인증·직원 관리 구현을 최종 승인·완료 처리했다. 이전 확인 대기/미커밋 기록은 당시 검증 이력이다.

## 수업 시간표 마이그레이션 (2026-10-22)

- 사용자 승인 후 Supabase MCP `apply_migration`으로 `20261022085919_create_class_schedule`을 적용했다. 원격에 저장된 SQL의 MD5가 저장소 파일과 일치함을 확인했다.
- 확장 `btree_gist` 1.7을 `extensions` 스키마에 설치했다.
- 적용 후 확인: 새 테이블 3개 RLS 활성, `authenticated`는 SELECT만, `anon`은 권한 없음, RPC는 `service_role`만 실행 가능. 기존 staff 데이터는 그대로이고 `is_instructor` 기본값은 false다.
- 보안 자문: 새 지적 없음(기존 Auth '유출 비밀번호 검사 꺼짐' 경고 1건 유지). 성능 자문은 INFO만 있다. 새 인덱스가 아직 쓰이지 않았다는 것과, `created_by`·`class_type_id` FK에 인덱스가 없다는 것이다. 수업 종류는 삭제하지 않고 직원 삭제도 드물어서, 단일 지점 규모에서는 그대로 둔다.
- E2E는 같은 프로젝트에서 실행 태그가 붙은 수업 종류와 임시 강사 계정만 만들고 정리한다. 운영 데이터를 넣기 전에는 운영·테스트 프로젝트를 분리할 것을 권장한다.
- 리뷰 수정 보정 마이그레이션 `20261022093926_fix_class_schedule_following`(함수만 교체, 테이블·데이터 변경 없음)을 사용자 승인 후 적용했다. 원격 SQL MD5가 저장소 파일과 일치하고, 새 함수 `class_drop_series`·바뀐 `class_fill_series`도 `service_role`만 실행할 수 있다. 보안 자문 새 지적 없음.
- 로컬에 Postgres·Docker·Supabase CLI가 없어서, SQL은 Git 제외 경로 `.omc/research/class-schedule-pglite/`의 PGlite 정책 테스트로 사전 검증했다.
