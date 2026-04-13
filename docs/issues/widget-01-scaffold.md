# Issue 01: Project Scaffold

## Description
Bootstrap the StencilJS project using the official CLI, then add the root `<evidenceone-chat>` component with its inline button and wire the drawer skeleton. After this issue the component renders a button in plain HTML and opens/closes an empty drawer.

## Dependencies
- None

## Bootstrap Command

Run this in the repo root:

```bash
npm init stencil
```

When prompted:
- Type: **component**
- Project name: `evidenceone-chat` (generates the namespace used in `stencil.config.ts`)

This generates `package.json`, `stencil.config.ts`, `tsconfig.json`, `src/components/`, and test setup. Then:

```bash
npm install
npm install marked dompurify
npm install --save-dev @types/dompurify
```

Update `package.json` after init:
- Set `"name": "@evidenceone/chat-widget"`
- Set `"files": ["dist/"]`
- Add `"prepublishOnly": "npm run build && npm audit --audit-level=high && npm test"`

## Files to Create/Modify (after bootstrap)

### New Files
- `src/components/evidenceone-chat/evidenceone-chat.tsx` (replace generated stub)
- `src/components/evidenceone-chat/evidenceone-chat.css`
- `src/components/eo-drawer/eo-drawer.tsx`
- `src/components/eo-drawer/eo-drawer.css`

## Implementation Details

### package.json
```json
{
  "name": "@evidenceone/chat-widget",
  "version": "0.0.1",
  "description": "EvidenceOne Case Brasil chat as a web component",
  "main": "dist/index.cjs.js",
  "module": "dist/index.js",
  "es2015": "dist/esm/index.mjs",
  "es2017": "dist/esm/index.mjs",
  "jsnext:main": "dist/esm/index.mjs",
  "types": "dist/types/index.d.ts",
  "collection": "dist/collection/collection-manifest.json",
  "collection:main": "dist/collection/index.js",
  "unpkg": "dist/evidenceone-chat/evidenceone-chat.esm.js",
  "files": ["dist/"],
  "scripts": {
    "build": "stencil build",
    "start": "stencil build --dev --watch --serve",
    "test": "stencil test --spec",
    "test.watch": "stencil test --spec --watchAll",
    "prepublishOnly": "npm run build && npm audit --audit-level=high && npm test"
  },
  "dependencies": {
    "marked": "^12.0.0",
    "dompurify": "^3.0.0"
  },
  "devDependencies": {
    "@stencil/core": "^4.0.0",
    "@types/dompurify": "^3.0.0"
  }
}
```

### stencil.config.ts
```typescript
import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'evidenceone-chat',
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements',
    },
    {
      type: 'docs-readme',
    },
    {
      type: 'www',
      serviceWorker: null,
    },
  ],
  testing: {
    browserHeadless: 'new',
  },
};
```

### `<evidenceone-chat>` Root Component

**Purpose:** The tag partners place in their HTML. Renders an inline button. Manages drawer state.

**Props:**
```typescript
// Required
@Prop() apiKey: string;
@Prop() apiUrl: string;
@Prop() doctorEmail: string;
@Prop() doctorName: string;
@Prop() doctorCrm: string;
@Prop() doctorPhone: string;

// Optional
@Prop() doctorSpecialty?: string;
@Prop() newSession: boolean = false;
@Prop() hideButton: boolean = false;
```

**State:**
```typescript
@State() isOpen: boolean = false;
```

**Events:**
```typescript
@Event() eoReady: EventEmitter<{ sessionId: string }>;
@Event() eoError: EventEmitter<{ code: string; message: string }>;
@Event() eoClose: EventEmitter<void>;
```

**Methods:**
```typescript
@Method() async show(): Promise<void> { this.isOpen = true; }
@Method() async hide(): Promise<void> { this.isOpen = false; }
```

**componentWillLoad:** Validate required props and log error if missing.

**Render:**
```tsx
render() {
  return (
    <Host>
      {!this.hideButton && (
        <button class="eo-trigger-btn" onClick={() => this.isOpen = true}>
          Consultar EvidenceOne
        </button>
      )}
      <eo-drawer
        isOpen={this.isOpen}
        onEoDrawerClose={() => {
          this.isOpen = false;
          this.eoClose.emit();
        }}
      >
        {/* Chat content — added in later issues */}
      </eo-drawer>
    </Host>
  );
}
```

### `<eo-drawer>` Component

**Purpose:** Fixed overlay panel that slides in from the right.

**Props:**
```typescript
@Prop() isOpen: boolean = false;
```

**Events:**
```typescript
@Event() eoDrawerClose: EventEmitter<void>;
```

**Key behavior:**
- Watches `isOpen` via `@Watch('isOpen')` to add/remove `overflow: hidden` on `document.body`
- ESC key listener attached on `componentDidLoad`, removed on `disconnectedCallback`
- Click on backdrop fires `eoDrawerClose`
- Slide-in animation: CSS transform translateX(100%) → translateX(0) with ≤300ms transition

**Render:**
```tsx
render() {
  return (
    <Host>
      <div
        class={{ 'eo-backdrop': true, 'eo-backdrop--open': this.isOpen }}
        onClick={() => this.eoDrawerClose.emit()}
      />
      <div class={{ 'eo-drawer': true, 'eo-drawer--open': this.isOpen }}>
        <slot />
      </div>
    </Host>
  );
}
```

**CSS:**
- `.eo-backdrop`: `position: fixed; inset: 0; z-index: 999998; background: rgba(0,0,0,0.4); opacity: 0; pointer-events: none; transition: opacity 200ms`
- `.eo-backdrop--open`: `opacity: 1; pointer-events: auto`
- `.eo-drawer`: `position: fixed; top: 0; right: 0; height: 100%; width: 400px; z-index: 999999; transform: translateX(100%); transition: transform 280ms ease-out; background: #fff`
- `.eo-drawer--open`: `transform: translateX(0)`
- `@media (max-width: 767px)`: `.eo-drawer { width: 100%; }`

## Acceptance Criteria
- [ ] `npm run build` passes with no TypeScript errors
- [ ] `<evidenceone-chat>` renders an inline button in plain HTML
- [ ] Clicking button opens drawer from right in ≤300ms
- [ ] Drawer is 400px wide on desktop, fullscreen on mobile (<768px)
- [ ] ESC key closes drawer
- [ ] Clicking backdrop closes drawer
- [ ] X button inside drawer closes drawer
- [ ] Missing required props logs error to console
- [ ] `show()` and `hide()` methods work programmatically
- [ ] `hide-button` prop hides the trigger button
- [ ] Host page layout/scroll is not affected

## Testing Notes
- Run `/test-component` to create `test/index.html` and serve it
- Verify button renders inline (not fixed position)
- Open DevTools → verify Shadow DOM is active on `<evidenceone-chat>` and `<eo-drawer>`
- Resize viewport to 360px — verify drawer fills screen
