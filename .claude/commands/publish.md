---
description: Pre-publish checklist and publish to NPM
---

# Publish

Pre-publish checklist and publish to NPM:

1. Run `/review` — all items must be OK (no VIOLATIONS)
2. Run `/build` — must PASS
3. Verify version in package.json is bumped:
   - `npm version patch` for bug fixes
   - `npm version minor` for new features
   - `npm version major` for breaking prop/event changes
4. Verify CHANGELOG.md is updated (if exists)
5. Verify README.md has current examples
6. Run `npm pack --dry-run` — check that only `dist/`, `package.json`, `README.md` are included
7. Confirm: `npm publish --access public`

Post-publish:
- Verify CDN is accessible: `https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js`
- Test installation in a fresh project: `npm install @evidenceone/chat-widget`
