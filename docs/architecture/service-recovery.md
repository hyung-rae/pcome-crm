# 서비스 종료 준비 및 재연결 명세

- 최종 갱신: 2026-10-23
- 상태: 서비스 종료를 위한 문서화 완료 · 사용자 커밋 지시로 최종 확인
- 기준: 저장소의 마이그레이션·앱 소스·CI와 기존 연결 기록. 이번 작업에서는 원격 프로젝트·배포·DB 상태를 조회하거나 변경하지 않았다.
- 실제 연결 해제·프로젝트 삭제는 이 문서 작성으로 수행되지 않는다. 아래 과거 식별자는 현재 서비스 가용성을 보장하지 않는다.

## 보관 범위와 복구 한계

앱 코드와 Supabase 의존성은 재연결을 위해 유지한다. Supabase 없이 인증·직원 관리·수업 시간표를 사용할 수 있는 오프라인 모드는 없다. Vercel은 호스팅이며 DB와 Auth는 Supabase에 있다.

2026-10-23 사용자 결정: **기존 계정·수업 데이터는 백업하지 않는다.** 코드와 DB 구조·설정만 보관하며, 재개 시 빈 DB에 구조·권한·함수·트리거를 재생성하고 첫 관리자부터 새로 등록한다. 회원·상품·회원권·결제·예약·출석 테이블은 구현되지 않았다. [ERD](erd.md)의 members는 설계안이다.

## 과거 연결과 런타임

| 항목 | 보관된 값 또는 기준 |
|---|---|
| Supabase 이름 / 프로젝트 ID | pcome-crm / `ligmwstlapvwaxovhgny` |
| 과거 API URL | `https://ligmwstlapvwaxovhgny.supabase.co` |
| 과거 리전 | `ap-south-1` (기존 문서 기록, 이번 원격 확인 없음) |
| 과거 Vercel 주소 | `https://pcome-crm.vercel.app` (재사용 가능 여부 미확인) |
| 저장소 / 운영 브랜치 | `hyung-rae/pcome-crm` / `main` |
| 런타임 | Node.js 24, npm, Next.js 16.4.2, React 19.3.0, Mantine 9 |
| Supabase SDK | `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0 |
| 정확한 의존성 재현 | [package-lock.json](../../package-lock.json), `npm ci` |

Vercel의 프로젝트 ID·소유 팀·커스텀 도메인·실제 빌드 명령·리전·보호 규칙은 저장소에서 확인할 수 없다. 재연결 시 새로 확인한다. 로컬 `.vercel/`은 Git 제외이므로 보관 명세로 의존하지 않는다.

## 환경변수 및 인증 설정

[.env.example](../../.env.example)의 세 변수는 모두 같은 프로젝트 값을 사용한다.

| 변수 | 책임 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth·Data API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 공개 가능, 사용자 세션·RLS 접근 |
| `SUPABASE_SECRET_KEY` | 서버 전용 직원·Auth 관리 및 수업 RPC 호출 |

키·비밀번호·세션은 문서나 Git에 저장하지 않는다. 새 프로젝트에는 새 키를 발급하고 로컬·Vercel에 다시 등록한다. 공개 변수 변경 후에는 새 빌드가 필요하다.

- 이메일·비밀번호 인증, 공개 회원가입 비활성화가 필수다. 앱 관리자 또는 최초 관리자 스크립트로 계정을 생성한다.
- 공개 가입 차단은 DB 마이그레이션만으로 복원되지 않는 Auth 설정이다.
- 이메일 비밀번호 복구·SMTP·소셜 로그인은 구현하지 않았다. Auth Site URL·Redirect URLs·비밀번호 정책 등 원격 설정의 전체 스냅샷은 없으므로 새 운영 URL과 실제 요구에 맞게 확인한다.
- Auth 사용자와 `staff.id`의 UUID가 같아야 한다. 새 계정은 최초 관리자 스크립트와 앱 직원 생성 기능으로 만든다. 기존 세션은 이관하지 않는다.

## 스키마 복구 원본과 적용 순서

빈 Supabase DB에서 아래 SQL 전체를 **순서대로 각 1회** 적용한다. 이미 데이터가 있는 DB는 적용 이력과 구조부터 대조하며 초기 SQL을 재실행하지 않는다. SQL Editor로 적용하면 마이그레이션 이력이 자동 등록된다고 가정하지 말고 적용 파일·시각을 별도로 기록한다.

| 순서 | SQL 원본 | 역할 | SHA-256 |
|---|---|---|---|
| 1 | [20261022051344_create_staff_auth.sql](../../supabase/migrations/20261022051344_create_staff_auth.sql) | 직원·RLS·세션 검증·세션 폐기 | `a458085ea88e64f7e6b80b9331d612f982e644f4cffb5aa5194caaa1fadca389` |
| 2 | [20261022085919_create_class_schedule.sql](../../supabase/migrations/20261022085919_create_class_schedule.sql) | 강사 표시·수업 3개 테이블·제약·RPC·트리거 | `e47a879ffe5e15176cec29f8712afb070e917192f78a91e7c8976b8d2af08ede` |
| 3 | [20261022093926_fix_class_schedule_following.sql](../../supabase/migrations/20261022093926_fix_class_schedule_following.sql) | 반복 이후 전체 변경·상태 유지·과거 회차 보존 보정 | `54275f63935e6e1cf95661ffe4677bd46beeaeb4a27de1e1ca67e568d5f8e36b` |

첫 SQL의 `private` 스키마와 Supabase 기본 `auth`·`extensions` 스키마가 기반이다. 두 번째 SQL은 `extensions.btree_gist`를 준비한다(기존 원격 기록 버전 1.7). 일반 PostgreSQL에 SQL만 적용하는 방식은 Supabase Auth·역할·JWT 함수가 없어 동일하게 동작하지 않는다.

## 실제 테이블 구조

다음은 SQL 원본의 열·기본값·제약이다. `staff.is_instructor`는 두 번째 마이그레이션에서 추가된다. PRIMARY KEY는 NULL을 허용하지 않으며, 그 외 열은 `not null`이 없으면 NULL을 허용한다. 상세 함수 구현과 최종 동작은 위 SQL 세 파일이 원본이다.

### public.staff

```sql
id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  role text not null check (role in ('admin', 'sub_admin')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  credentials_reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_instructor boolean not null default false -- 두 번째 마이그레이션에서 추가
```

### public.class_types

```sql
id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 30 and name = btrim(name)),
  default_capacity integer not null check (default_capacity between 1 and 100),
  default_duration_minutes integer not null
    check (default_duration_minutes between 10 and 240 and default_duration_minutes % 5 = 0),
  color text not null
    check (color in ('orange', 'red', 'pink', 'violet', 'blue', 'teal', 'green', 'yellow')),
  is_active boolean not null default true,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
```

### public.class_series

```sql
id uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references public.class_types(id) on delete restrict,
  instructor_id uuid references public.staff(id) on delete set null,
  weekdays smallint[] not null
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  start_time time not null
    check (date_part('second', start_time) = 0 and date_part('minute', start_time)::int % 5 = 0),
  duration_minutes integer not null
    check (duration_minutes between 10 and 240 and duration_minutes % 5 = 0),
  capacity integer not null check (capacity between 1 and 100),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  cancelled_from date,
  generated_until date,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_part('epoch', start_time) + duration_minutes * 60 <= 86400)
```

### public.class_sessions

```sql
id uuid primary key default gen_random_uuid(),
  series_id uuid references public.class_series(id) on delete cascade,
  occurrence_date date,
  class_type_id uuid not null references public.class_types(id) on delete restrict,
  instructor_id uuid references public.staff(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 100),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'deleted')),
  is_modified boolean not null default false,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at - starts_at between interval '10 minutes' and interval '240 minutes'),
  -- A class may end at midnight but never continues into the next day.
  check (((ends_at - interval '1 microsecond') at time zone 'Asia/Seoul')::date
    = (starts_at at time zone 'Asia/Seoul')::date),
  check ((series_id is null) = (occurrence_date is null)),
  check (status <> 'deleted' or series_id is not null),
  unique (series_id, occurrence_date),
  constraint class_sessions_no_instructor_overlap exclude using gist (
    instructor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled' and instructor_id is not null)
```

### 관계·인덱스·업무 규칙

- `staff.id → auth.users.id`: ON DELETE CASCADE. Auth 삭제 시 직원 프로필 삭제.
- 모든 `created_by`와 강사 `instructor_id → staff.id`: ON DELETE SET NULL. 수업 기록은 남는다.
- `class_type_id → class_types.id`: ON DELETE RESTRICT. 종류는 삭제 UI 대신 활성 상태로 관리한다.
- `class_sessions.series_id → class_series.id`: ON DELETE CASCADE. 최종 보정 함수는 필요한 과거 회차를 단발로 분리해 보존한 뒤 규칙을 제거한다.
- `class_types_active_name`: 활성 종류에만 `lower(name)` 유일 인덱스.
- `class_sessions_starts_at`, `class_sessions_instructor(instructor_id, starts_at)`, `class_series_instructor`: 조회 인덱스. PK·UNIQUE·제외 제약의 인덱스도 생성된다.
- 강사 겹침: `class_sessions_no_instructor_overlap` GiST 제외 제약. `scheduled`이며 강사가 있는 회차만 검사하고 `[시작, 종료)`라 맞닿은 시간은 허용한다.
- 시간 기준은 Asia/Seoul, 반복 요일은 ISO 월요일 1~일요일 7. 미래 1년까지 회차를 미리 생성한다. 조회·변경 API가 확장 RPC를 호출하며 별도 Cron은 구현되어 있지 않다.
- 반복 한 회차 삭제는 `deleted`로 보관해 재생성을 막는다. 단발 삭제는 행 제거. 지난 회차는 서버에서 수정하지 못하게 한다.

## RLS·서버 권한·DB 함수

| 대상 | 정책 |
|---|---|
| public 4개 테이블 | 모두 RLS 활성. anon 권한 없음. authenticated는 SELECT만, service_role은 CRUD |
| staff_read_self | 자신의 활성 직원 행 + `auth.sessions`에 존재하는 JWT session_id 확인 |
| class_types_read / class_series_read / class_sessions_read | 위 직원 RLS를 통과하고 must_change_password=false인 직원만 조회 |
| 직원 관리 API | 서버 requireStaff의 admin 검사 후 관리 클라이언트 사용 |
| 수업 API | 활성·비밀번호 변경 완료 직원 확인 후 관리 클라이언트로 쓰기. admin/sub_admin 모두 편집 가능 |
| 강사 표시 변경 | 관리자만 허용 |
| public 수업 RPC | PUBLIC·anon·authenticated 실행 권한 회수, service_role만 실행 |

관리 키는 RLS를 우회하므로 서버의 사용자·권한 검사를 반드시 유지한다. RPC의 p_actor는 호출자가 검증해 전달하는 직원 UUID이며, 일반 사용자가 직접 호출하도록 권한을 열면 안 된다.

| public RPC | 책임 |
|---|---|
| class_extend_series() | 반복 회차 1년 범위 확장 |
| class_create(...) | 단발/반복 등록, 범위·강사·종류·겹침 검사 |
| class_update(...) | one/following 수정, 반복 분리·상태 보존 |
| class_set_status(...) | one/following 휴강·휴강 취소 |
| class_delete(...) | one/following 삭제, 과거 회차 보존 |
| class_upcoming_counts() | 강사별 미래 회차 수 |

정확한 인자 타입·기본값·반환값은 SQL 원본을 따른다. `class_create/update/set_status/delete`는 JSONB 결과, `class_extend_series`는 void, `class_upcoming_counts`는 instructor_id UUID·sessions bigint 행 목록을 반환한다.

private 함수와 트리거도 복구해야 한다.

- private 함수 목록: `class_at`, `class_conflicts`, `class_drop_series`, `class_editable`, `class_extend`, `class_fill_series`, `class_horizon`, `class_instructor_usable`, `class_lock`, `class_reader`, `class_result`, `class_rule_dates`, `class_today`, `class_type_usable`, `staff_release_classes`, `staff_revoke_reset_sessions`, `staff_session_valid`, `staff_updated_at`.
- `staff_updated_at`: staff·수업 3개 테이블 갱신 시 updated_at 변경.
- `staff_revoke_reset_sessions`: credentials_reset_at 변경 시 해당 사용자의 auth.sessions 제거.
- `staff_release_classes`: 비활성화·강사 해제 시 미래 수업·유효 반복 규칙의 강사를 NULL로 변경.
- 수업 쓰기는 advisory transaction lock `724050101`로 직렬화한다. 세션 검증·세션 폐기·강사 제외 함수는 SECURITY DEFINER와 고정 search_path를 사용한다. private 스키마 권한과 함수별 EXECUTE 제한을 원본 그대로 복구한다.

## 앱 연결 지점

| 소스 | 역할 |
|---|---|
| [config.ts](../../src/lib/supabase/config.ts) | 공개 URL·키 검증 |
| [server.ts](../../src/lib/supabase/server.ts) | SSR 쿠키 사용자 클라이언트 |
| [admin.ts](../../src/lib/supabase/admin.ts) | server-only 관리 키 클라이언트 |
| [session.ts](../../src/lib/auth/session.ts) | Auth getUser·staff 조회, 페이지·API 권한 검사 |
| [proxy.ts](../../src/proxy.ts) | 세션 갱신, 쿠키 전달, private/no-store |
| [API](../../src/app/api/) | 인증·직원·수업 요청 처리 |
| [rpc.ts](../../src/lib/classes/rpc.ts) | 수업 RPC 호출·DB 결과 → 앱 오류 변환 |
| [연결 검사](../../scripts/check-supabase.mjs) / [관리자 생성](../../scripts/bootstrap-admin.mjs) | 새 환경 연결 확인·최초 계정 준비 |

주요 페이지는 /login, /password, /, /classes, /admin/staff다. 상세 정책은 [직원 인증](../features/admin-auth.md)·[수업 시간표](../features/class-schedule.md)를 참고한다.

## 연결 해제 전 보관 및 종료 순서

아래는 실행 기록이 아닌 종료 체크리스트다. 사용자 결정에 따라 데이터 백업 단계는 포함하지 않는다.

1. Git에 앱·마이그레이션·잠금 파일·본 문서를 보관한다. 삭제 직전 원격 마이그레이션 이력과 저장소의 차이가 없는지 확인한다.
2. 기존 Auth 계정과 public 테이블 데이터는 백업·이관하지 않는다. 보관 대상은 코드·마이그레이션·설정 명세다.
3. Vercel 프로젝트의 Git 연결·운영 브랜치·빌드 설정·도메인·환경변수 이름과 적용 환경·보호 설정을 별도로 기록한다. 키 값은 비밀 저장소에서 관리한다.
4. Vercel의 공개 서비스와 자동 배포를 중지하거나 프로젝트 연결을 해제한다. Git 연결 해제만으로 기존 배포 URL이 없어졌다고 판단하지 말고 공개 접근 중단도 확인한다. 커스텀 도메인이 있다면 DNS도 정리한다.
5. 실제 종료 작업 시 Supabase의 일시 중지 또는 삭제를 수행한다. 프로젝트 삭제 후 재연결은 같은 프로젝트 복구가 아닌 새 프로젝트 재구축이 될 수 있다.
6. 종료 후 로컬 .env.local·.env.admin-initial.local·tests/.auth/·.vercel/의 기존 연결·자격 정보를 정리한다. 보관할 비밀정보는 먼저 안전한 저장소로 옮긴다. 과거 키는 새 서비스에 재사용하지 않는다.

## 재연결 실행 순서

1. Node.js 24와 `npm ci`로 의존성을 복구한다. 기존 환경 파일을 덮어쓰지 말고 [.env.example](../../.env.example)을 기준으로 준비한다.
2. 새 Supabase 프로젝트를 만든다. 공개 회원가입을 끄고 URL·Publishable key·서버 Secret key를 같은 프로젝트에서 발급한다.
3. 빈 DB에 위 마이그레이션 3개를 순서대로 적용한다. 4개 테이블·RLS·btree_gist·트리거·RPC 실행 권한을 확인한다.
4. 빈 DB에서 아래 최초 관리자 스크립트를 1회 실행한다. 기존 데이터는 복원하지 않으며 직원·수업은 새로 등록한다.

```sh
node --env-file=.env.local scripts/check-supabase.mjs
node --env-file=.env.local scripts/bootstrap-admin.mjs 'admin@example.com' '관리자 이름'
npm run dev
```

5. 최초 로그인 후 비밀번호를 변경하고 .env.admin-initial.local을 삭제한다. 로그인·직원 관리·강사 지정·수업 생성·반복 변경·겹침 차단·로그아웃을 확인한다.
6. `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build -- --webpack`을 실행한다. 별도 테스트 DB로 `npm run test:e2e`를 실행한다. E2E는 실제 임시 계정·데이터를 생성·삭제하므로 운영 DB에 자동 실행하지 않는다.
7. Vercel에 Git 저장소를 연결하고 Next.js·저장소 루트·Node.js 24.x를 설정한다. 기본 npm 빌드를 사용하며 필요 시 검증된 Webpack 빌드 명령을 지정한다. Production에 세 변수를 등록하고 Preview에는 별도 테스트 DB를 연결한다.
8. 운영 브랜치 main·배포 URL·필요한 도메인과 보호 규칙을 확인하고 배포한다. 새 프로젝트는 과거 vercel.app 주소를 보장하지 않는다. 공개 변수 변경은 재배포한다. 운영 로그인·비밀번호 변경·직원 목록·수업 시간표·로그아웃을 확인한다.

[GitHub Actions](../../.github/workflows/ci.yml)는 PR/main push/수동 실행에 설치·린트·타입·단위·Webpack 빌드를 수행한다. Supabase 키·Vercel 토큰이 필요 없으며 E2E·DB 마이그레이션·관리자 생성·배포를 수행하지 않는다. GitHub 필수 Checks와 Vercel Deployment Checks는 원격에서 별도로 확인한다.

## 이번 문서 작업의 검증

저장소 SQL·서버 권한 코드·환경변수 양식·CI와 내용을 대조하고 변경 문서의 로컬 링크·공백·diff를 확인했다. 문서만 변경하여 앱 테스트·빌드·브라우저 검증은 대상이 아니다. 원격 DB와 Vercel 설정의 최신성, 실제 종료·재배포는 미검증이다. 데이터 백업·복원은 사용자 결정으로 범위에서 제외한다.

2026-10-23 커밋 직전 최종 리뷰: 문서 6개를 검토해 백업 미수행·빈 DB 재시작 기준, 마이그레이션 순서, 소스와의 일치, 비밀정보 미포함을 확인했다. 문서 오타와 NULL 허용 설명을 보정했으며 로컬 링크·SQL 해시·공백 검사를 통과했다.
