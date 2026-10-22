# Supabase 연결 설정

- 최종 갱신: 2026-10-22
- 상태: 앱 Auth·Data API 연동 및 staff 적용 완료
- 관련 기획: [로그인 및 관리자 관리](../planning/admin-auth.md)

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
