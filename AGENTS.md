<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 작업 시작

- 새 작업은 `docs/README.md`, `docs/overview.md`, `docs/workflow.md`와 관련 기능 문서를 먼저 읽습니다. 작업 절차·검증·리뷰·생략 승인·커밋 기준의 원문은 `docs/workflow.md`입니다.
- 문서는 상단의 상태·현재 요약을 먼저 읽고, 완료된 기획·작업계획의 상세 이력은 필요한 구간만 `rg`·`sed -n`으로 읽습니다. 같은 문서를 작업 중 반복해서 전체 로드하지 않습니다.
- 문서만으로 코드 동작을 단정하지 말고 변경 대상 소스와 필요한 검증을 확인합니다.

## 핵심 규칙 요약

- 새 기능, 사용자 흐름·업무 정책·권한·데이터 구조 변경은 기본 절차(기획 확정 → 작업계획 확정 → 개발)입니다. 오타·일부 UI 조정·영향이 제한된 버그·작은 보완은 “작은 수정으로 보고 간소 절차로 진행하겠습니다”라고 알린 뒤 진행합니다.
- 간소 절차의 검증·리뷰·문서 범위는 `docs/workflow.md`의 `간소 절차 기준`을 따릅니다: 연속 조정은 마지막에 1회 검증, 시각 확인 1개 화면 기본, 커밋 직전 리뷰 1회, 기능 문서만 갱신. 권한·결제·데이터 처리에 영향이 있으면 적용하지 않습니다.
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
