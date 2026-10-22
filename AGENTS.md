<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 작업 시작

- 새 작업은 `docs/README.md`, `docs/overview.md`, `docs/workflow.md`와 관련 기능 문서를 먼저 읽습니다. 작업 절차·검증·리뷰·생략 승인·커밋 기준의 원문은 `docs/workflow.md`입니다.
- 문서는 상단의 상태·현재 요약을 먼저 읽고, 완료된 기획·작업계획의 상세 이력은 필요한 구간만 `rg`·`sed -n`으로 읽습니다. 같은 문서를 작업 중 반복해서 전체 로드하지 않습니다.
- 문서만으로 코드 동작을 단정하지 말고 변경 대상 소스와 필요한 검증을 확인합니다.

## 프로젝트 빠른 파악

- PCOME CRM은 헬스장 단일 지점의 CRM입니다. 현재 직원 인증·관리와 대시보드 기반을 구현했습니다. 설치·인수인계 안내는 [README](README.md), 최신 기능 상태는 [문서 색인](docs/README.md)과 관련 기능 문서를 참고합니다.
- 구현됨: 이메일·비밀번호 로그인/로그아웃, 활성 직원 접근 제어, 관리자 전용 서브관리자 생성·이름 수정·활성 상태 변경·임시 비밀번호 재설정·영구 삭제, 최초·임시 비밀번호 변경 강제, 반응형 대시보드와 공통 메뉴·알림.
- 미구현: 회원 정보·상품·회원권·결제와 해당 테이블, 공개 회원가입, 이메일 비밀번호 복구·SMTP. 관리자 추가·권한 승격·관리자 삭제 UI도 없습니다. 미구현 기능을 기존 동작으로 가정하지 않습니다.
- 직원 프로필은 `public.staff`, 이메일·비밀번호는 Supabase Auth에서 관리합니다. UI에서 메뉴를 숨기는 것만으로 권한 검증을 대신하지 않습니다. 서버·API·RLS의 기존 접근 제어를 함께 확인합니다.
- 주요 경로: `/login`, `/password`, `/`, `/admin/staff`. 비로그인·비활성 직원은 업무 화면에 접근할 수 없고 비밀번호 변경 강제 상태는 업무 화면 진입 전에 처리합니다.

## 개발 환경과 코드 위치

- Node.js 24 (`.nvmrc`), npm (`package-lock.json`), Next.js 16 App Router, React 19, TypeScript, Mantine 9, Supabase Auth·Postgres를 사용합니다. 다른 패키지 관리자의 잠금 파일을 추가하지 않습니다.
- 처음 준비할 때 `nvm use` 또는 Node.js 24 설치 → `npm ci` → 환경 설정 → `npm run dev` 순서로 실행합니다. 기본 앱 주소는 `http://localhost:3000`입니다.
- `@/*`는 `src/*` 별칭이며 컴포넌트 스타일은 CSS Modules를 사용합니다.

| 경로 | 역할 |
|---|---|
| `src/app/` | 페이지와 API Route Handlers |
| `src/components/auth/`, `src/components/staff/`, `src/components/dashboard/` | 인증·직원 관리·대시보드 UI |
| `src/lib/auth/` | 세션·권한·입력 검증·직원 생성 처리 |
| `src/lib/supabase/` | 공개 설정·SSR 쿠키 클라이언트·서버 전용 관리 클라이언트 |
| `src/proxy.ts` | 세션 갱신과 쿠키 전달 |
| `src/theme.ts`, `src/app/globals.css` | 공통 테마·스타일 |
| `supabase/migrations/` | DB 스키마·RLS·함수·트리거 |
| `scripts/` | Supabase 연결 검사·첫 관리자 생성 |
| `tests/`, `playwright*.config.ts` | 단위 테스트·실제 Supabase 연동 E2E |
| `.github/workflows/ci.yml` | GitHub Actions 검증 |

## 환경변수와 DB 초기 설정

루트의 [.env.example](.env.example)을 기준으로 `.env.local`을 준비합니다. 기존 파일이 있으면 덮어쓰지 않습니다. 다음 세 값은 모두 같은 Supabase 프로젝트의 값이어야 합니다.

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL. 공개 가능한 연결 주소 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 일반 사용자 Auth·RLS 접근용 Publishable key. 브라우저 공개 가능 |
| `SUPABASE_SECRET_KEY` | 서버 전용 직원·Auth 관리 Secret key. 브라우저 노출 금지 |

- 실제 키·비밀번호·세션을 출력·응답·문서·커밋에 포함하지 않습니다. Secret key에 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 컴포넌트로 전달하지 않습니다.
- `.env.local`, `.env.admin-initial.local`, `tests/.auth/`, `.vercel/`은 Git 제외 대상입니다. 자격 증명이 없을 때 임의의 값으로 실제 연결 성공을 주장하지 않습니다.
- 기존 프로젝트의 마이그레이션과 첫 관리자는 이미 준비되어 있습니다. 새 환경에만 공개 회원가입 비활성화 → `supabase/migrations/20261022051344_create_staff_auth.sql` 적용 → 연결 검사 → 첫 관리자 생성을 수행합니다. 변경 전 대상 DB와 적용 이력을 확인하며 기존 DB에 초기화를 반복하지 않습니다.
- 연결 검사: `node --env-file=.env.local scripts/check-supabase.mjs`.
- 첫 관리자 생성: `node --env-file=.env.local scripts/bootstrap-admin.mjs 'admin@example.com' '관리자 이름'`. 관리자가 없는 새 환경에서만 실행합니다. 초기 정보는 `.env.admin-initial.local`에 저장되며 첫 로그인·비밀번호 변경 후 삭제합니다.
- 운영·개발·테스트 DB를 구분합니다. 상세 설정·복구 정책은 [README](README.md)와 [Supabase 설정](docs/architecture/supabase.md)을 따릅니다. 환경변수 변경 후 개발 서버를 재시작하고 배포 환경은 새로 빌드합니다.

## 검증 및 CI·배포 지침

- 검증 범위의 원문은 [작업 절차](docs/workflow.md)입니다. 다음 명령 설명이 변경 영향별 검증 기준을 대체하지 않습니다.
- 정적 검사: `npm run lint`, `npm run typecheck`.
- 순수 함수 테스트: `npm run test:unit`. 환경 파일·브라우저·DB 없이 비밀번호 검증 경계값을 확인합니다.
- 운영 빌드: `npm run build`. 실행 환경에서 Turbopack 내부 포트 생성이 제한되면 `npm run build -- --webpack`을 사용합니다. 빌드 후 `npm start`로 실행합니다.
- E2E: 테스트용 Supabase를 가리키는 `.env.local` 준비 → `npx playwright install chromium` → `npm run test:e2e`. 기본 Webpack 서버는 8888 포트이며 기존 서버는 `PLAYWRIGHT_BASE_URL`로 지정합니다.
- E2E는 실제 임시 Auth 계정·staff 행을 생성·삭제합니다. 테스트 대상 프로젝트를 먼저 확인하고 운영 DB 대상으로 자동 실행하지 않습니다. 중단 후 잔여 계정·`tests/.auth/`를 확인하며 실제 직원 계정을 정리 대상으로 취급하지 않습니다. 동시 실행은 `PLAYWRIGHT_AUTH_DIR`와 `--output`을 분리합니다.
- 전체 검증에는 단위 테스트와 E2E가 모두 필요합니다. CI 통과만으로 실제 로그인·DB·브라우저 흐름 검증을 완료했다고 보고하지 않습니다.
- GitHub Actions는 PR·`main` push·수동 실행에서 Node.js 24로 설치·린트·타입 검사·단위 테스트·Webpack 빌드를 수행합니다. 이 CI에는 Supabase 키·Vercel 토큰이 필요 없으며 E2E는 포함하지 않습니다.
- Vercel Git 연동이 배포를 담당합니다. `main` push가 운영 배포를 유발할 수 있으므로 push 전 사용자 지시와 대상 브랜치를 확인합니다. 커밋·push·배포 권한을 서로 같은 것으로 간주하지 않습니다.
- Vercel Production에는 필수 환경변수 세 개가 필요합니다. Preview를 사용할 때는 테스트용 Supabase 값을 별도로 등록합니다. Preview에 운영 DB를 연결하면 직원 변경·삭제도 운영에 반영됩니다.
- CI 파일만으로 병합·운영 반영이 차단되지는 않습니다. GitHub Ruleset/브랜치 보호의 PR·필수 `Checks` 설정과 Vercel Deployment Checks는 별도 원격 설정이며 적용 여부를 확인하기 전 활성화됐다고 보고하지 않습니다.
- DB 마이그레이션·첫 관리자 생성은 자동 배포 단계에 넣지 않습니다. 배포 후 로그인·비밀번호 변경·직원 목록·로그아웃을 확인합니다. 원격에서 실행하지 않은 검증은 미실행으로 기록합니다.
- 기능·환경·명령이 바뀌면 README와 이 문서의 해당 요약도 함께 갱신해 불일치를 방지합니다.

## 핵심 규칙 요약

- 새 기능, 사용자 흐름·업무 정책·권한·데이터 구조 변경은 기본 절차(기획 확정 → 작업계획 확정 → 개발)입니다. 오타·일부 UI 조정·영향이 제한된 버그·작은 보완은 “작은 수정으로 보고 간소 절차로 진행하겠습니다”라고 알린 뒤 진행합니다.
- 간소 절차의 검증·리뷰·문서 범위는 `docs/workflow.md`의 `간소 절차 기준`을 따릅니다: 연속 조정 중에는 변경 파일 린트만(동작 변경 시 해당 E2E spec만) 하고 E2E·시각 확인은 사용자 확인 완료·커밋 지시 때 일괄 1회, 시각 확인 1개 화면 기본, 커밋 직전 리뷰 1회, 기능 문서만 갱신. 권한·결제·데이터 처리에 영향이 있으면 적용하지 않습니다.
- 합의된 기준보다 줄이는 테스트·리뷰 생략은 사용자의 명시적 승인이 필요합니다.
- 사용자 최종 확인 전에는 커밋하지 않습니다. 사용자가 별도로 지정한 커밋 지시는 우선합니다.

## UI 일관성

- UI 작업 전 `docs/architecture/ui-guide.md`를 읽고 현재 대시보드의 색상·크기·간격·모서리·동작을 공통 기준으로 사용합니다.
- 브랜드 오렌지·차콜·밝은 본문의 조합과 작은 버튼 패딩·16px 조작 아이콘을 유지합니다. 임의로 새로운 테마나 큰 버튼 스타일을 도입하지 않습니다.
- 기존 테마·레이아웃·컴포넌트를 우선 재사용하고, 새 유형의 UI는 가이드의 가장 가까운 패턴을 따릅니다.
- 공통 기준을 바꾸려면 사용자와 합의한 뒤 가이드와 관련 구현을 함께 갱신합니다.

## 커밋 규칙

`이모지 타입(범위): 변경 내용` 형식을 사용합니다. 예: `✨ feat(auth): 로그인 기능 추가`

- 제목은 한글, 타입과 범위는 영문입니다. 범위는 선택이며 생략하면 `이모지 타입: 변경 내용`입니다.
- 한 커밋에는 한 가지 목적만 포함하고 제목 끝에 마침표를 붙이지 않습니다. 추가 설명은 빈 줄 뒤 본문에 씁니다.

| 이모지 | 타입 | 용도 |
|---|---|---|
| ✨ | feat | 새 기능 |
| 🐛 | fix | 버그 수정 |
| ♻️ | refactor | 코드 구조 개선 |
| 💄 | style | UI·스타일 변경 |
| 📝 | docs | 문서 수정 |
| ✅ | test | 테스트 추가·수정 |
| 🔧 | chore | 개발환경·설정 변경 |
| 📦 | deps | 의존성 추가·업데이트 |
| ⚡️ | perf | 성능 개선 |
| 🚑️ | hotfix | 긴급 수정 |
