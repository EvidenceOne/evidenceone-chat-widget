import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { Config } from '@stencil/core';
import type { Plugin } from 'rollup';

/**
 * Brand-integrity build hook (L4b).
 *
 * Computes SHA-256 of the LOGO_SVG string and the canonical trigger label
 * (`BRAND_TRIGGER_TEXT`), then replaces the `__INJECTED_AT_BUILD__` placeholders
 * inside src/utils/integrity.ts at bundle time. The widget verifies these
 * hashes at runtime in componentDidLoad and refuses to authenticate on
 * mismatch.
 *
 * Source of truth: src/assets/logo.ts. If LOGO_SVG or the trigger text
 * changes there, the hash regenerates automatically on the next build —
 * no manual update required.
 */
function brandIntegrity(): Plugin {
  return {
    name: 'evidenceone-brand-integrity',
    renderChunk(code) {
      const hasLogo = code.includes('__INJECT_LOGO_HASH__');
      const hasTrigger = code.includes('__INJECT_TRIGGER_HASH__');
      if (!hasLogo && !hasTrigger) return null;

      const logoSource = readFileSync(resolvePath(__dirname, 'src/assets/logo.ts'), 'utf8');
      const logoMatch = logoSource.match(/export const LOGO_SVG = `([\s\S]*?)`;/);
      if (!logoMatch) {
        this.error('brand-integrity: could not extract LOGO_SVG from src/assets/logo.ts');
      }
      const logoSvg = logoMatch![1];
      const triggerText = 'Consultar EvidenceOne';

      const next = code
        .replace(/__INJECT_LOGO_HASH__/g, sha256Hex(logoSvg))
        .replace(/__INJECT_TRIGGER_HASH__/g, sha256Hex(triggerText));

      return { code: next, map: null };
    },
  };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export const config: Config = {
  namespace: 'evidenceone-chat',
  rollupPlugins: {
    after: [brandIntegrity()],
  },
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      externalRuntime: false,
    },
    {
      type: 'docs-readme',
    },
    {
      type: 'www',
      serviceWorker: null, // disable service workers
    },
  ],
};
