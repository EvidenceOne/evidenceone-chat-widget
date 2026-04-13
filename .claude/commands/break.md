---
description: Break a spec into executable issues
argument-hint: @SPEC-[feature-name].md
---

# Break

Instructions: $ARGUMENTS

Break a feature specification into individual, executable issues.

## Process

1. **Read the spec thoroughly**
   - Understand all components needed
   - Note dependencies between components
   - Identify the implementation order

2. **Read project context**
   - Check `.claude/CLAUDE.md` for project patterns
   - Review `.claude/skills/` for relevant patterns
   - Understand existing component structure

3. **Create issue files**
   - One file per logical unit of work
   - Follow dependency order
   - Include all details needed for execution

## Output Structure

Create issues in `docs/issues/` folder:

```
docs/issues/
├── [feature]-01-types-and-utils.md
├── [feature]-02-component-a.md
├── [feature]-03-component-b.md
├── [feature]-04-integration.md
└── [feature]-05-polish.md
```

## Issue File Template

```markdown
# Issue: [Clear Title]

## Description
[What this issue accomplishes]

## Dependencies
- [ ] Issue X must be completed first
- [ ] Requires types from issue Y

## Files to Create/Modify

### New Files
- `src/path/to/NewFile.tsx`

### Modified Files
- `src/path/to/ExistingFile.tsx` - [what changes]

## Implementation Details

### [Component/Function Name]

**Purpose:** [What it does]

**Props/Parameters:**
```typescript
interface Props {
  prop: Type;
}
```

**Implementation Notes:**
- Note 1
- Note 2

## Styling
```css
/* CSS classes to use */
.component { }
```

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Works on mobile
- [ ] Shadow DOM isolates styles

## Testing Notes
- How to manually test this
- Edge cases to verify
```

## Breaking Guidelines

1. **Atomic Issues**
   - Each issue should be completable in one session
   - Should result in working (even if partial) functionality
   - Avoid issues that break existing functionality mid-way

2. **Dependency Order**
   - Types and utils first
   - Then independent components
   - Then dependent components
   - Integration last
   - Polish/refinement at the end

3. **Clear Boundaries**
   - One component per issue (unless tightly coupled)
   - Shared utilities in their own issue
   - Integration/wiring as separate issue

4. **Self-Contained**
   - Each issue has all info needed to implement
   - Include code snippets, interfaces, styling
   - Reference relevant spec sections

## Example Breakdown

For a feature with: ComponentA, ComponentB, shared utils, and integration:

```
Issue 1: Types & Utils
  - Create types file
  - Create utility functions
  - No visual changes yet

Issue 2: ComponentA
  - Implement ComponentA
  - Can be tested in isolation
  - Uses types from Issue 1

Issue 3: ComponentB  
  - Implement ComponentB
  - Uses types from Issue 1
  - Independent of ComponentA

Issue 4: Integration
  - Wire ComponentA and ComponentB into page
  - Update existing components to use new ones
  - Remove deprecated code

Issue 5: Polish
  - Refine animations
  - Mobile testing fixes
  - Accessibility improvements
```

## After Breaking

1. **Review the issues** - Ensure order makes sense
2. **Check dependencies** - No circular dependencies
3. **Verify completeness** - All spec items covered
4. **Note any questions** - Flag unclear requirements
