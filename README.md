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

http://localhost:3000 에서 대시보드를 확인합니다.
PC LNB는 공통 상단바의 아이콘 버튼으로 접고 펼치며, 작은 화면에서는 상단 메뉴 버튼으로 엽니다.

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
