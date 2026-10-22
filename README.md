# PCOME CRM

Next.js App Router + TypeScript + Mantine 기반 웹앱입니다.

## 개발 환경

- Node.js 24 LTS (`.nvmrc`)
- npm / `package-lock.json`
- ESLint
- `@/*` → `src/*` 경로 별칭

## 실행

```sh
npm ci
npm run dev
```

http://localhost:3000 에서 직원 로그인 화면을 확인합니다. 로그인 후 대시보드를 이용합니다.
PC LNB는 공통 상단바의 아이콘 버튼으로 접고 펼치며, 작은 화면에서는 상단 메뉴 버튼으로 엽니다.

## Supabase 환경 설정

`.env.example`을 `.env.local`로 복사하고 프로젝트 URL·Publishable key·서버 전용 Secret key를 입력합니다. Secret key에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 실제 환경 파일은 Git에서 제외됩니다.

Supabase Authentication 설정에서 공개 회원가입을 끕니다. 스키마는 `supabase/migrations/20261022051344_create_staff_auth.sql`에 있습니다. 현재 프로젝트에는 이미 적용되어 있으므로 다시 실행하지 않습니다. 다른 프로젝트는 기존 스키마를 확인한 뒤 적용합니다.

```sh
node --env-file=.env.local scripts/check-supabase.mjs
```

직원 테이블의 비로그인 접근 차단·Auth 연결·공개 회원가입 차단을 확인합니다.

## 첫 관리자 설정

관리자가 없는 환경에서만 다음 명령을 사용합니다. 현재 프로젝트의 첫 관리자는 이미 생성되어 있습니다.

```sh
node --env-file=.env.local scripts/bootstrap-admin.mjs '이메일' '이름'
```

랜덤 초기 비밀번호는 Git 제외 `.env.admin-initial.local`에 저장됩니다. 처음 로그인한 뒤 비밀번호를 변경하고 이 파일을 삭제합니다. 기존 관리자나 초기 정보 파일이 있으면 스크립트는 중단합니다.

첫 관리자 비밀번호 분실은 Supabase 프로젝트 소유자의 Auth 사용자 관리에서 복구합니다. 이메일 복구·SMTP는 이번 구현 범위에 포함하지 않습니다. 상세 정책은 [직원 인증 기능](docs/features/admin-auth.md)을 참고합니다.

## 검증 및 배포 빌드

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

## 주요 파일

- `src/app/layout.tsx`: 전역 스타일 및 Mantine Provider
- `src/app/page.tsx`: 대시보드 진입
- `src/components/dashboard/`: 대시보드 레이아웃과 반응형 스타일
- `src/theme.ts`: Mantine 테마
- `src/app/globals.css`: 전역 CSS
- `postcss.config.cjs`: Mantine PostCSS 설정

컴포넌트별 스타일은 CSS Modules를 사용합니다.
Mantine 연동 가이드: https://mantine.dev/guides/next/

## 환경별 참고

현재 Codex 실행 환경에서는 Turbopack 내부 포트 생성이 제한될 수 있습니다.
이 경우 `npm run build -- --webpack`으로 빌드할 수 있습니다.

초기 설치의 `npm audit` 결과 개발용 ESLint 의존성(braces 경로)에서
high 경고 5건이 확인되었습니다. 제안된 자동 수정은 `eslint-config-next`를
14.x로 낮추므로 적용하지 않았습니다.

## 프로젝트 문서

기능 기획, 작업계획 및 구현 현황은 [문서 색인](docs/README.md)에서 확인합니다.
기본 절차는 기획·완료 기준 확정 → 작업계획·테스트 시나리오 확정 → 개발 → 자동 테스트 → 실제 브라우저 검증 → 코드 리뷰 → 문서 반영 → 사용자 확인 → 커밋 대상 최종 리뷰 → 커밋 순서로 진행합니다.

오타·일부 UI 조정·영향이 제한된 기존 기능 보완은 수정 범위를 요약한 뒤 간소 절차로 진행합니다. 테스트·리뷰·사용자 확인·커밋 규칙은 유지합니다. 상세 기준은 [작업 절차](docs/workflow.md)를 따릅니다.

## UI 자동 테스트

```sh
npx playwright install chromium
npm run test:e2e
```

기본적으로 Webpack 개발 서버를 8888 포트에 실행합니다. 이미 다른 포트에 프로젝트 서버가 있다면 재사용합니다.

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3002 npm run test:e2e
```

Chromium에서 빈 상태, 1440·768·390px 반응형, PC LNB 접기·펼치기, 모바일 메뉴·포커스, 브랜드 색상 및 콘솔·네트워크 오류를 검증합니다.

인증 테스트에는 `.env.local`의 Supabase 설정과 서버 관리 키가 필요합니다. 테스트는 `pcome-e2e-` 접두사의 임시 Auth 계정과 staff 행을 생성하고 종료 시 해당 계정만 삭제합니다. 실제 관리자·직원 계정은 삭제하지 않습니다. 세션·테스트 비밀번호는 Git 제외 `tests/.auth/`에 잠시 저장하며 정상 종료 시 정리합니다. 테스트 중단으로 파일이 남았다면 테스트 계정을 확인하고 정리한 후 다시 실행합니다.

인증·직원 관리 성공 및 실패 흐름, 직접 API·DB 권한 우회 차단, 계정 생성 보상 처리를 함께 검증합니다.

동시에 테스트를 실행할 때는 인증 상태와 결과 경로를 분리할 수 있습니다. 각 실행에 별도의 임시 경로를 지정합니다.

```sh
PLAYWRIGHT_AUTH_DIR=/private/tmp/pcome-delete-auth PLAYWRIGHT_BASE_URL=http://localhost:8888 npm run test:e2e -- --output=/private/tmp/pcome-delete-final-results
```

## 순수 함수 테스트

```sh
npm run test:unit
```

비밀번호 검증 함수의 경계값 6개를 환경 파일·서버·브라우저·원격 계정 준비 없이 확인합니다.
`test:e2e`에서는 해당 파일을 제외합니다. 전체 검증이 필요한 작업에서는 두 명령을 함께 실행합니다.
변경 영향별 검증·재실행·종료 기준은 [작업 절차](docs/workflow.md)를 따릅니다.
