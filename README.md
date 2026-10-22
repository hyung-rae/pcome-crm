# PCOME CRM

헬스장 단일 지점의 직원 인증·관리와 회원 관리 업무를 위한 웹앱입니다.
현재 직원 인증·관리자 관리, 대시보드 기반, 그룹수업 시간표까지 구현했으며, 회원 업무 기능은 아직 구현하지 않았습니다.

운영 주소: [pcome-crm.vercel.app](https://pcome-crm.vercel.app/)

## 현재 구현된 기능

| 기능 | 현재 동작 |
|---|---|
| 직원 로그인·로그아웃 | Supabase Auth 이메일·비밀번호 인증. 공개 회원가입 없음 |
| 접근 제어 | 활성 직원만 업무 화면 접근, 관리자만 직원 관리 가능. 서버·API·DB RLS에서 권한 검사 |
| 비밀번호 변경 | 현재 비밀번호 확인, 최초·임시 비밀번호 로그인 후 변경 강제 |
| 직원 관리 | 관리자 계정으로 서브관리자 생성·이름 수정·비활성화/재활성화·임시 비밀번호 재설정·영구 삭제 |
| 그룹수업 시간표 | `/classes`에서 수업 종류 관리, 단발·매주 반복 수업 등록, 주간 그리드·모바일 목록, 이 회차만/이후 전체 수정·휴강·삭제, 같은 강사 시간 겹침 차단. 관리자가 직원에게 강사 표시 |
| 대시보드 | 업무 데이터 연결 전 빈 상태, 로그인 계정·역할 표시, PC 접이식 메뉴·모바일 Drawer |
| UI | Mantine 공통 테마, 반응형 화면, 직원 목록 새로고침·행별 관리 메뉴, 처리 상태·성공 알림 |

회원 정보·상품·회원권·결제 기능과 관련 테이블, 회원 수업 예약·출석, 공개 회원가입, 이메일 비밀번호 복구·SMTP는 미구현입니다.
관리자 추가·권한 승격·관리자 삭제 UI는 제공하지 않습니다. 직원 데이터는 `public.staff`, 이메일·비밀번호는 Supabase Auth가 관리합니다.
자세한 정책은 [직원 인증·관리](docs/features/admin-auth.md), [그룹수업 시간표](docs/features/class-schedule.md), [대시보드](docs/features/dashboard-ui.md)를 참고하세요.

## 개발 환경 및 시작

- Node.js 24 LTS (`.nvmrc`), npm / `package-lock.json`
- Next.js 16 App Router, React 19, TypeScript, Mantine 9
- Supabase Auth·Postgres, CSS Modules, ESLint, Playwright

```sh
git clone https://github.com/hyung-rae/pcome-crm.git
cd pcome-crm
nvm use
npm ci
cp .env.example .env.local
```

`nvm`을 쓰지 않는 경우 Node.js 24를 직접 설치합니다. 아래 환경변수·DB·첫 관리자 설정을 마친 뒤 실행합니다.

```sh
npm run dev
```

[localhost:3000](http://localhost:3000)에서 로그인합니다. 최초 로그인 시 비밀번호 변경 후 대시보드로 이동합니다.
기존 프로젝트에 참여하는 개발자는 소유자에게 접근 권한과 개발용 환경을 전달받으세요. 별도 환경을 만드는 경우 아래 초기 설정을 수행합니다.

## 필수 환경변수

저장소 루트의 `.env.local`에 다음 **3개**를 등록합니다. 값은 모두 같은 Supabase 프로젝트에서 가져옵니다.

| 변수 | 가져올 값 | 용도·노출 범위 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트의 Project URL | Auth·Data API 연결, 브라우저 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 프로젝트 API Keys의 Publishable key | 일반 사용자 인증·RLS 적용 접근, 브라우저 공개 가능 |
| `SUPABASE_SECRET_KEY` | 같은 프로젝트 API Keys의 Secret key | 서버의 직원·Auth 관리 작업 전용. 브라우저 노출 금지 |

변수명만 포함한 양식은 [.env.example](.env.example)에 있습니다. 서버 키에 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.
`.env.local`, `.env.admin-initial.local`, 테스트 로그인 정보는 Git 제외 대상입니다. 실제 값은 README·코드·커밋에 기록하지 않습니다.
환경변수 변경 후 개발 서버를 재시작하세요. 공개 변수는 빌드에 반영되므로 배포 환경에서는 새 빌드가 필요합니다.

### 새 Supabase 프로젝트 준비

1. 개발용 Supabase 프로젝트를 생성하고 위 3개 값을 설정합니다. 운영 DB와 분리된 프로젝트 사용을 권장합니다.
2. Supabase Authentication에서 공개 회원가입을 끕니다. 계정은 관리자만 생성합니다.
3. 새 DB에 [마이그레이션 SQL](supabase/migrations/20261022051344_create_staff_auth.sql)을 Supabase SQL Editor 등으로 적용합니다. `staff` 테이블·RLS·세션 관련 함수와 트리거를 함께 준비합니다. 기존 프로젝트에는 이미 적용되어 있으므로 재실행하지 마세요.
4. 연결과 공개 가입 차단을 확인합니다.

```sh
node --env-file=.env.local scripts/check-supabase.mjs
```

프로젝트별 연결 정보와 구조는 [Supabase 연결 설정](docs/architecture/supabase.md), [ERD](docs/architecture/erd.md)를 참고하세요.

### 첫 관리자 생성

관리자가 없는 새 환경에서 한 번만 실행합니다. 환경변수가 의도한 프로젝트를 가리키는지 먼저 확인하세요.

```sh
node --env-file=.env.local scripts/bootstrap-admin.mjs 'admin@example.com' '관리자 이름'
```

초기 로그인 정보는 소유자만 읽고 쓸 수 있는 `.env.admin-initial.local`에 저장됩니다.
처음 로그인해 비밀번호를 변경한 후 해당 파일을 삭제하세요. 기존 관리자나 초기 정보 파일이 있으면 스크립트는 중단합니다.
기존 운영 프로젝트에는 관리자가 생성되어 있으므로 다시 실행할 필요가 없습니다.
관리자 비밀번호 분실은 Supabase 프로젝트 소유자가 Auth 사용자 관리에서 복구해야 합니다. 앱의 이메일 복구 기능은 없습니다.

## 검증 명령

| 명령 | 용도 |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Next.js 타입 생성 + TypeScript 검사 |
| `npm run test:unit` | 비밀번호 검증 경계값·수업 날짜·입력 검증(14개). 환경변수·브라우저·DB 불필요 |
| `npm run test:e2e` | 실제 Supabase 연동 인증·직원 관리·권한·반응형 UI 검증 |
| `npm run build` | 운영 빌드 |
| `npm start` | 빌드한 운영 서버 실행 |

### E2E 실행

개발·테스트용 Supabase를 가리키는 `.env.local`을 준비합니다.

```sh
npx playwright install chromium
npm run test:e2e
```

기본적으로 Webpack 개발 서버를 8888 포트에 실행합니다. 이미 실행 중인 서버를 사용할 때:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3002 npm run test:e2e
```

테스트는 `pcome-e2e-` 접두사의 임시 Auth 계정과 직원 행을 생성·삭제합니다. 테스트용으로 분리된 DB에서 실행하세요.
세션·비밀번호는 Git 제외 `tests/.auth/`에 잠시 저장하고 정상 종료 시 정리합니다. 중단된 실행의 계정과 파일은 확인 후 정리해야 합니다.
동시 실행 시 `PLAYWRIGHT_AUTH_DIR`와 Playwright의 `--output`을 각기 다른 임시 경로로 지정하세요.
전체 검증은 단위 테스트와 E2E를 모두 실행합니다. Firefox·Safari·실물 모바일과 자연 세션 만료 장시간 대기는 미검증입니다.

## CI와 Vercel 배포

[GitHub Actions CI](.github/workflows/ci.yml)는 PR, `main` push 및 수동 실행에서 Node.js 24로 다음을 순서대로 검사합니다.

```text
npm ci → lint → typecheck → test:unit → build --webpack
```

CI에는 Supabase 키나 Vercel 토큰을 등록할 필요가 없습니다. DB와 연결하는 E2E는 별도 로컬 검증이며 이 워크플로에 포함하지 않습니다.
CI 빌드는 배포 가능 여부를 검사하며 실제 DB 연결·로그인 성공까지 보장하지 않습니다.

Vercel의 Git 연동이 배포를 담당합니다. 운영 브랜치 `main` push는 Production, 다른 브랜치는 프로젝트의 Git 설정에 따라 Preview로 배포됩니다.
새로 이 저장소를 가져간 경우 본인의 Vercel 프로젝트로 Git 저장소를 연결하고 다음을 설정하세요.

- Framework: Next.js, Root Directory: 저장소 루트, Node.js: 24.x
- Environment Variables: 위 3개 변수를 Production에 등록
- Preview를 사용한다면 별도 테스트 Supabase의 3개 변수를 Preview에도 등록
- 환경변수를 추가·변경한 경우 새 배포 실행

Preview에 운영 DB 값을 등록하면 Preview의 직원 수정·삭제도 운영 데이터에 반영됩니다.
배포 후 로그인·비밀번호 변경·직원 목록 조회·로그아웃을 확인하세요. 최초 관리자 생성이나 DB 마이그레이션은 자동 배포에서 실행하지 않습니다.

**이 워크플로 추가만으로 CI 실패 시 병합·운영 배포가 차단되지는 않습니다.** GitHub의 `main` 브랜치 Ruleset/보호 규칙에서 PR을 요구하고 `Checks` 검사를 필수로 지정해야 합니다.
직접 push도 제한해야 병합 전 검증을 지킬 수 있습니다. Vercel에서도 CI 완료 전 운영 반영을 차단하려면 별도의 Deployment Checks 설정이 필요합니다.
현재 파일에는 CI 정의만 포함하며 원격 보호 규칙·Deployment Checks는 변경하지 않습니다.

공식 안내: [Vercel Git 연동](https://vercel.com/docs/git), [Deployment Checks](https://vercel.com/docs/deployment-checks).

## 주요 코드 및 문서

| 경로 | 역할 |
|---|---|
| `src/app/` | 로그인·비밀번호·대시보드·관리자 화면, API 라우트 |
| `src/components/` | 인증·직원 관리·공통 레이아웃 UI |
| `src/lib/auth/` | 세션·권한·입력 검증·직원 생성 처리 |
| `src/lib/supabase/` | 공개·SSR·서버 전용 Supabase 클라이언트 |
| `src/proxy.ts` | 세션 갱신·쿠키 전달 |
| `supabase/migrations/` | DB 스키마·RLS·함수·트리거 |
| `scripts/` | 연결 검사·첫 관리자 생성 |
| `tests/` | 단위·E2E 테스트 |

`@/*`는 `src/*` 별칭입니다. UI 변경은 [UI 공통 가이드](docs/architecture/ui-guide.md)를 따릅니다.
기획·작업계획·기능별 설명은 [문서 색인](docs/README.md), 협업·검증·커밋 기준은 [작업 절차](docs/workflow.md)를 참고하세요.

### 환경별 참고

Codex 실행 환경에서 Turbopack 내부 포트 생성이 제한될 수 있어 `npm run build -- --webpack`으로 검증합니다. CI도 같은 빌드 방식을 사용합니다.
초기 설치 당시 개발용 ESLint 의존성에서 high 경고 5건이 확인되었습니다. 자동 수정은 `eslint-config-next`를 14.x로 낮추므로 적용하지 않았습니다. 현재 취약점 상태는 별도 확인이 필요합니다.
