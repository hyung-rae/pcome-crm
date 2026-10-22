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
