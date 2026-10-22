<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 커밋 규칙

앞으로 커밋할 때 다음 형식을 사용합니다.

```text
이모지 타입(범위): 변경 내용
```

- 제목은 한글로 작성합니다. 타입과 범위는 영문을 사용합니다.
- 범위는 선택 사항입니다. 생략하면 `이모지 타입: 변경 내용`으로 작성합니다.
- 한 커밋에는 한 가지 목적만 포함합니다.
- 제목 끝에 마침표를 붙이지 않습니다.
- 변경 이유에 대한 추가 설명이 필요하면 빈 줄 뒤 본문에 작성합니다.

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

예: `✨ feat(auth): 로그인 기능 추가`

## 작업 및 문서 관리

- 새 작업을 시작할 때 `docs/README.md`, `docs/overview.md`, `docs/workflow.md`와 관련 기능 문서를 먼저 읽습니다.
- 기능 요청은 기획 문서 초안부터 작성하고 사용자와 논의하며 완성합니다.
- 사용자와 기획을 확정한 후 작업계획을 작성하고, 작업계획도 확정한 후 개발합니다. 확정 전에는 기능 코드를 구현하지 않습니다.
- 범위나 동작 변경이 필요하면 먼저 논의하고 관련 기획·계획에 반영합니다.
- 작업 완료에는 실제 구현을 설명하는 기능 문서, 영향받는 구조·결정 문서, 문서 색인·현황 갱신을 포함합니다.
- 이후 작업에서 문서로 전체 맥락을 파악하고 관련 코드만 확인할 수 있도록 실제 경로, 동작, 정책, 데이터, 검증 결과와 제한을 남깁니다.
- 문서만으로 코드 동작을 단정하지 말고 변경 대상 소스와 필요한 검증을 확인합니다.
- 상세 절차와 양식은 `docs/workflow.md`, `docs/templates/`를 따릅니다.

## 개발 후 검증

- 코드 개발이 끝나면 기능에 맞는 테스트 코드를 작성하고 실행합니다.
- 린트·타입 검사·빌드와 관련 테스트를 확인한 후, 로컬 서버를 실행하여 실제 브라우저에서 주요 사용자 흐름과 예외 동작을 검증합니다.
- 콘솔 오류·실패한 네트워크 요청과 화면 변경 시 관련 화면 크기도 확인합니다.
- 실패 사항을 수정하고 재검증하며, 명령·시나리오·결과·미검증 항목을 작업계획과 관련 기능 문서에 반영합니다.
- 테스트 도구 도입이 필요하면 개발 전 작업계획에 포함합니다. 상세 절차는 `docs/workflow.md`를 따릅니다.

## 추가 합의 사항

- 기획 완료 기준은 테스트 가능하게 작성하고, 개발 전 작업계획에서 성공·실패 테스트 시나리오를 확정합니다.
- 큰 기능은 사용자가 확인할 수 있는 작은 단위로 나눕니다.
- 개발 중 기획 변경은 영향과 추가 작업을 설명하고 사용자와 합의한 후 진행합니다.
- 자동 테스트와 브라우저 검증 후 코드 리뷰를 수행하고, 발견한 문제를 수정·재검증한 뒤 문서를 반영합니다.
- 검증·리뷰·문서 반영이 끝나면 사용자 확인 대기로 보고합니다. 사용자 최종 확인 후 완료 처리하고 커밋합니다. 별도로 지정한 사용자 커밋 지시는 우선합니다.
- 작은 수정은 기존 문서를 갱신하고, 새 기능이나 사용자 흐름·정책 변경에는 별도 기획·계획을 작성합니다.
- 배포는 필요할 때 별도 절차를 합의합니다.

## 커밋 직전 최종 리뷰

- 모든 커밋 전에 실제 커밋 대상 diff와 새 파일 내용을 리뷰합니다. 개발 후 코드 리뷰를 했어도 최종 변경분을 확인합니다.
- 요구사항 누락, 버그·회귀, 권한·데이터 처리, 테스트 누락, 문서 불일치, 무관한 파일과 비밀정보 포함 여부를 확인합니다.
- 발견한 문제는 수정·재검증·재리뷰합니다. 사용자 확인 후 동작·범위 변경은 다시 확인받습니다.
- 리뷰 결과는 작업계획에 남기며 별도 계획이 없는 작은 수정은 완료 보고에 남깁니다. 해결되지 않은 중대한 문제가 있으면 커밋하지 않고 알립니다.
- 최종 커밋 내용이 리뷰한 변경분과 일치하는지 확인합니다.
