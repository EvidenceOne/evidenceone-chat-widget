import { describe, expect, it, vi } from 'vitest';

// Stencil decorators are compile-time constructs — stub them so the component
// class instantiates as a plain TS class. Unlike the other component tests,
// `h` builds a minimal node tree here: the point of widget-14 is the *copy*
// each audience sees, so the rendered output has to be inspectable.
vi.mock('@stencil/core', () => {
  const noopDecorator = () => () => undefined;
  return {
    Component: noopDecorator,
    Prop: noopDecorator,
    State: noopDecorator,
    Event: noopDecorator,
    Element: noopDecorator,
    Watch: noopDecorator,
    Method: noopDecorator,
    Listen: noopDecorator,
    Host: 'host',
    h: (tag: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
      tag,
      props: props ?? {},
      children,
    }),
    Fragment: 'fragment',
  };
});

import { EoConsent } from './eo-consent';

interface VNode {
  tag: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

function isVNode(value: unknown): value is VNode {
  return typeof value === 'object' && value !== null && 'tag' in value && 'children' in value;
}

/** Flattens the rendered tree into its visible text, JSX-style (children joined). */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isVNode(node)) return node.children.map(textOf).join('');
  return '';
}

function findAll(node: unknown, match: (n: VNode) => boolean): VNode[] {
  const found: VNode[] = [];
  const walk = (current: unknown) => {
    if (Array.isArray(current)) return current.forEach(walk);
    if (!isVNode(current)) return;
    if (match(current)) found.push(current);
    current.children.forEach(walk);
  };
  walk(node);
  return found;
}

function render(reconsent: boolean) {
  const cmp = new EoConsent();
  cmp.reconsent = reconsent;
  return { cmp, tree: cmp.render() as unknown };
}

/** The two checkbox inputs, in DOM order: [mandatory terms, optional comms]. */
function checkboxes(tree: unknown): VNode[] {
  return findAll(tree, (n) => n.props.class === 'eo-check-input');
}

function primaryButton(tree: unknown): VNode {
  return findAll(tree, (n) =>
    typeof n.props.class === 'string' && n.props.class.includes('eo-consent-btn--primary'),
  )[0];
}

describe('eo-consent — first acceptance vs. re-collection copy (widget-14)', () => {
  it('a first-time user is asked for the aceite', () => {
    const { tree } = render(false);
    const desc = findAll(tree, (n) => n.props.id === 'eo-consent-desc')[0];

    expect(textOf(desc)).toBe('Para usar o EvidenceOne, precisamos do seu aceite.');
  });

  it('a user who accepted an older version is told the terms were revised', () => {
    const { tree } = render(true);
    const desc = findAll(tree, (n) => n.props.id === 'eo-consent-desc')[0];

    expect(textOf(desc)).toBe(
      'Nossos termos passaram por uma pequena revisão. Confirme abaixo para continuar usando o EvidenceOne.',
    );
  });

  it('keeps the same title on both variants', () => {
    for (const reconsent of [false, true]) {
      const { tree } = render(reconsent);
      const title = findAll(tree, (n) => n.props.id === 'eo-consent-title')[0];

      expect(textOf(title)).toBe('Antes de começar');
    }
  });

  it('carries the v2.0 optional copy (personalized ads) on both variants', () => {
    for (const reconsent of [false, true]) {
      const { tree } = render(reconsent);

      expect(textOf(tree)).toContain(
        'Aceito receber anúncios personalizados de acordo com meus interesses e novidades exclusivas sobre o EvidenceOne',
      );
      expect(textOf(tree)).not.toContain('novidades e melhorias');
    }
  });
});

describe('eo-consent — the optional box is never prefilled (widget-14)', () => {
  it('both checkboxes start unchecked, re-collection included', () => {
    for (const reconsent of [false, true]) {
      const { cmp, tree } = render(reconsent);

      expect(cmp.termsChecked).toBe(false);
      expect(cmp.commsChecked).toBe(false);
      expect(checkboxes(tree).map((c) => c.props.checked)).toEqual([false, false]);
    }
  });

  it('"Continuar" stays disabled until the mandatory box is checked', () => {
    const { cmp } = render(true);
    expect(primaryButton(cmp.render() as unknown).props.disabled).toBe(true);

    cmp.commsChecked = true;
    expect(primaryButton(cmp.render() as unknown).props.disabled).toBe(true);

    cmp.termsChecked = true;
    expect(primaryButton(cmp.render() as unknown).props.disabled).toBe(false);
  });
});

describe('eo-consent — optional consent is recorded either way', () => {
  function accept(cmp: EoConsent) {
    const emit = vi.fn();
    cmp.eoConsentAccept = { emit } as unknown as typeof cmp.eoConsentAccept;
    (cmp as unknown as { handleContinue: () => void }).handleContinue();
    return emit;
  }

  it('emits comms: false when the optional box is left untouched', () => {
    const { cmp } = render(true);
    cmp.termsChecked = true;

    expect(accept(cmp)).toHaveBeenCalledWith({ comms: false });
  });

  it('emits comms: true when the optional box is checked', () => {
    const { cmp } = render(true);
    cmp.termsChecked = true;
    cmp.commsChecked = true;

    expect(accept(cmp)).toHaveBeenCalledWith({ comms: true });
  });

  it('does not emit while the mandatory box is unchecked', () => {
    const { cmp } = render(false);
    cmp.commsChecked = true;

    expect(accept(cmp)).not.toHaveBeenCalled();
  });
});
