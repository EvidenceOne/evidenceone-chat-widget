---
description: Execute an implementation plan step by step
argument-hint: @docs/issues/[issue-file].md
---

# Execute

Instructions: $ARGUMENTS

1. Read the issue file (and its `/plan` output if one exists)
2. Consult skills before implementing:
   - `stencil-discipline` — component pattern, Shadow DOM, CSS, Functional Core, markdown rendering
   - `sse-protocol` — auth flow, SSE events, token handling (for services/streaming work)
   - `tdd` — apply for services, pure functions, and state logic (not for component rendering)
3. Implement following the issue spec
4. Validate:
   - `npm run build` passes with no TypeScript errors
   - Component renders correctly (create `test/index.html` if needed — see CLAUDE.md Testing section)
5. Update `docs/issues/status.md` — mark issue `completed`

If a decision isn't covered by the issue or skills, document it as a comment and proceed with the most pragmatic option.
