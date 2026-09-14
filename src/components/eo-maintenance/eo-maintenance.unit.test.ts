import { describe, expect, it, vi } from 'vitest';

// Stencil decorators are compile-time constructs — stub them so the component
// class instantiates as a plain TS class, with `h` building a minimal node
// tree so the rendered copy and button state are inspectable (as in eo-consent).
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

import { EoMaintenance } from './eo-maintenance';

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

function findByClass(node: unknown, className: string): VNode {
  let found: VNode | undefined;
  const walk = (current: unknown) => {
    if (found) return;
    if (Array.isArray(current)) return current.forEach(walk);
    if (!isVNode(current)) return;
    if (current.props.class === className) {
      found = current;
      return;
    }
    current.children.forEach(walk);
  };
  walk(node);
  if (!found) throw new Error(`no node with class "${className}"`);
  return found;
}

function render(checking: boolean) {
  const cmp = new EoMaintenance();
  cmp.checking = checking;
  const emit = vi.fn();
  cmp.eoMaintenanceRetry = { emit } as unknown as typeof cmp.eoMaintenanceRetry;
  return { emit, tree: cmp.render() as unknown };
}

function click(button: VNode) {
  (button.props.onClick as () => void)();
}

describe('eo-maintenance — copy', () => {
  it('tells the doctor the service is temporarily unavailable', () => {
    const { tree } = render(false);

    expect(textOf(findByClass(tree, 'eo-maintenance-title'))).toBe('Estamos em manutenção');
    expect(textOf(findByClass(tree, 'eo-maintenance-text'))).toBe(
      'O EvidenceOne está temporariamente indisponível. Tente novamente mais tarde.',
    );
  });
});

describe('eo-maintenance — retry', () => {
  it('"Tentar novamente" asks the parent to re-check availability', () => {
    const { tree, emit } = render(false);
    const button = findByClass(tree, 'eo-maintenance-retry');

    expect(textOf(button)).toBe('Tentar novamente');
    click(button);

    expect(emit).toHaveBeenCalledOnce();
  });

  it('shows the in-flight check on the button and ignores further clicks', () => {
    const { tree, emit } = render(true);
    const button = findByClass(tree, 'eo-maintenance-retry');

    expect(textOf(button)).toBe('Verificando…');
    expect(button.props['aria-busy']).toBe('true');
    expect(button.props['aria-disabled']).toBe('true');
    click(button);

    expect(emit).not.toHaveBeenCalled();
  });
});
