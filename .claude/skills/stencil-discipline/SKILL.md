---
name: stencil-discipline
description: StencilJS component pattern, Shadow DOM rules, CSS conventions, Functional Core, and markdown rendering for evidenceone-chat-widget
---

# Stencil Discipline

## Component File Structure

Every StencilJS component follows this exact order:

```typescript
@Component({ tag: 'eo-component-name', shadow: true, styleUrl: 'eo-component-name.css' })
export class EoComponentName {
  // 1. @Prop
  // 2. @State
  // 3. @Event
  // 4. @Element
  // 5. Lifecycle (componentWillLoad, componentDidLoad, disconnectedCallback)
  // 6. @Method (public API)
  // 7. Private methods
  // 8. render()
}
```

**Shadow DOM is mandatory on every component.** No exceptions. `shadow: true` always.

Each component lives in its own folder:
```
src/components/eo-my-component/
├── eo-my-component.tsx
└── eo-my-component.css
```

## Service Pattern

Services are plain TypeScript classes — NOT StencilJS components. Instantiated once by the root component, passed down as props or via a simple reference.

```typescript
export class AuthService {
  private apiUrl: string;
  private apiKey: string;
  private token: string | null = null;

  constructor(apiUrl: string, apiKey: string) { ... }

  // Static = pure logic (Functional Core)
  static isTokenExpired(token: string): boolean { ... }

  // Instance = I/O
  async register(doctor: DoctorData): Promise<void> { ... }
  async createSession(crm: string): Promise<SessionResponse> { ... }
}
```

## Functional Core Discipline

| Has side effect? | Pattern |
|-----------------|---------|
| Needs fetch / DOM / storage | `async` instance method |
| Validation / calculation / decision | `static` pure method |

Never put I/O inside a static method. Never put business logic inside an async fetch wrapper.

## CSS Rules

- Vanilla CSS only — no Tailwind, no CSS-in-JS, no SASS.
- One `.css` file per component, co-located in the same folder.
- Shadow DOM isolates everything — no naming collision risk.
- Use CSS custom properties for any theming exposed to partners.
- Brand colors defined as CSS variables:

```css
--eo-green: #51C878;
--eo-dark: #1d1d1b;
--eo-white: #FFFFFF;
--eo-gray-100: #F5F5F5;
--eo-gray-200: #E5E5E5;
--eo-gray-500: #888888;
--eo-gray-800: #333333;
```

## Markdown Rendering

Always pipe through both libraries. Never inject unsanitized HTML.

```typescript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function renderMarkdown(text: string): string {
  const rawHtml = marked.parse(text) as string;
  return DOMPurify.sanitize(rawHtml);
}
```

`marked` removed `{ sanitize: true }` in v4+. DOMPurify is the XSS layer. Both are required.

## Partner-Exposed CSS Vars

Only these two vars are exposed on the host element — everything else is locked:

```css
:host {
  --eo-button-color: #51C878;
  --eo-button-text-color: #FFFFFF;
}
```

## Key Constraints

- `shadow: true` on every component — no exceptions
- Separate `.css` file per component — no inline styles
- All UI text in **Brazilian Portuguese**
- Never use `localStorage`, `sessionStorage`, `cookies`, or `IndexedDB`
- `apiUrl` is a required prop — no default value ever
