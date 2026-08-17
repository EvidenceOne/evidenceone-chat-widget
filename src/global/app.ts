import { repairHostCustomEvent } from '../utils/custom-event-repair';

/**
 * Fired on `document` (not on the component) when the host page's
 * CustomEvent constructor was found broken at bundle init — before any
 * component exists, so the element itself cannot carry it.
 * detail: { issue: 'legacy-customevent-polyfill', outcome: 'repaired' | 'unrepairable' }
 */
export const ENVIRONMENT_WARNING_EVENT = 'eoEnvironmentWarning';

/**
 * Runs once when the widget bundle initializes, before any component renders
 * or emits: hostile-host hardening lives here.
 */
export default function () {
  const outcome = repairHostCustomEvent();
  if (outcome === 'healthy') return;

  // Console noise only when the widget could NOT fix the page — that is the
  // case needing partner action. A successful repair stays out of the console
  // and is observable via the eoEnvironmentWarning event below.
  if (outcome === 'unrepairable') {
    console.warn(
      '[EvidenceOne] window.CustomEvent está quebrado nesta página (polyfill legado) e não pôde ser corrigido com segurança. ' +
        'Eventos internos do widget podem não funcionar (ex.: botões sem resposta). ' +
        'Verifique os polyfills carregados pela página e contate o suporte EvidenceOne.',
    );
  }

  try {
    document.dispatchEvent(
      new CustomEvent(ENVIRONMENT_WARNING_EVENT, {
        detail: { issue: 'legacy-customevent-polyfill', outcome },
      }),
    );
  } catch {
    // console.warn above already delivered the signal.
  }
}
