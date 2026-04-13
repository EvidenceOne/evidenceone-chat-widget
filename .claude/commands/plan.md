---
description: Create an implementation plan from an issue
argument-hint: @docs/issues/[issue-file].md
---

# Plan

Instructions: $ARGUMENTS

Given an issue, create an implementation plan:

1. Read the issue file provided
2. Read `docs/specs/spec-evidenceone-chat-widget.md` for full context
3. Read `CLAUDE.md` for architecture and code discipline rules
4. Identify which files need to be created or modified
5. Break down into ordered steps, each step producing a testable result
6. For each step, specify:
   - File(s) to create/modify
   - What the code should do (behavioral, not prescriptive)
   - How to validate it works (build, test, manual check)
7. Output the plan as a numbered checklist

## Rules

- Follow the component pattern from CLAUDE.md (Props → State → Events → Lifecycle → Methods → Render)
- Follow Functional Core discipline (static for pure, instance for I/O)
- Every component must have `shadow: true`
- CSS in separate .css file per component
- Services are plain TypeScript, not StencilJS components
- Never use localStorage/sessionStorage
- All UI text in Brazilian Portuguese
