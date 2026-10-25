import type { Rect } from './engine';

export type BrickCategory =
  'account' | 'button' | 'nav' | 'chart' | 'row' | 'amount' | 'heading' | 'generic';

export interface CollectedBrick {
  el: HTMLElement;
  rect: Rect;
  category: BrickCategory;
  label: string;
}

export interface CollectOptions {
  root?: ParentNode;
  viewport?: { width: number; height: number };
  isTopmost?: (el: Element, x: number, y: number) => boolean;
  max?: number;
}

export const DAMAGE_BY_CATEGORY: Record<BrickCategory, number> = {
  account: 500,
  chart: 300,
  amount: 150,
  heading: 100,
  row: 80,
  nav: 60,
  button: 40,
  generic: 20,
};

const CANDIDATES =
  'a, button, h1, h2, h3, h4, tr, [role="row"], li, label, input, select, textarea, img, .recharts-wrapper, td, th, p, span';
const IGNORE = '[data-budget-breaker-ignore]';
const PADDLE_ZONE = 120;
// Bande masquée par le HUD du jeu.
export const HUD_ZONE = 80;
const LABEL_MAX = 28;
const AMOUNT_MAX_LENGTH = 24;
const DEFAULT_MAX = 120;

function defaultIsTopmost(el: Element, x: number, y: number): boolean {
  if (typeof document.elementFromPoint !== 'function') return true;
  const hit = document.elementFromPoint(x, y);
  return hit !== null && (hit === el || el.contains(hit));
}

const compact = (s: string) => s.replaceAll(/\s+/g, ' ').trim();

function truncate(s: string): string {
  return s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s;
}

function isFormField(el: Element): boolean {
  return el.matches('input, select, textarea');
}

function textOf(el: Element): string {
  if (isFormField(el)) {
    const field = el as HTMLInputElement;
    return compact(el.getAttribute('aria-label') ?? (field.value || field.placeholder || ''));
  }
  if (el.tagName === 'IMG') return compact(el.getAttribute('alt') ?? '');
  return compact(el.textContent ?? '');
}

function hasContent(el: Element): boolean {
  if (el.matches('img, input, select, textarea, svg')) return true;
  if (compact(el.textContent ?? '') !== '') return true;
  return el.querySelector('svg, img, input') !== null;
}

export function classify(el: Element): BrickCategory {
  if (el.matches('.recharts-wrapper') || el.querySelector('svg.recharts-surface') !== null) {
    return 'chart';
  }
  if (el.matches('a[href^="/accounts/"]')) return 'account';
  if (el.matches('tr, [role="row"]')) return 'row';
  if (el.matches('h1, h2, h3, h4')) return 'heading';
  if (el.matches('button, input, select, textarea')) return 'button';
  if (el.matches('a')) return 'nav';
  const text = compact(el.textContent ?? '');
  if (text.includes('€') && text.length <= AMOUNT_MAX_LENGTH) return 'amount';
  return 'generic';
}

const NUMERIC = /^[-+−]?[\d\s.,]+$/;
const DATE_LIKE = /^\d{1,2}[\s/.-]+[\p{L}\d]{2,9}\.?[\s/.-]*\d{0,4}$/u;

function isAmountOrDate(text: string): boolean {
  return text.includes('€') || NUMERIC.test(text) || DATE_LIKE.test(text);
}

function rowLabel(el: Element): string {
  const cells = [...el.querySelectorAll('td, th, [role="cell"], [role="gridcell"]')]
    .map((c) => compact(c.textContent ?? ''))
    .filter((s) => s !== '');
  const preferred = cells.find((s) => !isAmountOrDate(s));
  return truncate(preferred ?? textOf(el));
}

export function labelOf(el: Element, category: BrickCategory): string {
  if (category === 'row') return rowLabel(el);
  return truncate(textOf(el));
}

function fitsSize(rect: Rect, category: BrickCategory, vw: number, vh: number): boolean {
  if (rect.w < 16 || rect.h < 10) return false;
  const maxW = category === 'chart' ? 0.95 * vw : 0.6 * vw;
  const maxH = category === 'chart' ? 0.6 * vh : 0.35 * vh;
  return rect.w <= maxW && rect.h <= maxH;
}

function inPlayZone(rect: Rect, vw: number, vh: number): boolean {
  return (
    rect.x >= 0 && rect.y >= HUD_ZONE && rect.x + rect.w <= vw && rect.y + rect.h < vh - PADDLE_ZONE
  );
}

function evenlySpaced<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}

export function collectBricks(options: CollectOptions = {}): CollectedBrick[] {
  const {
    root = document,
    viewport = { width: globalThis.innerWidth, height: globalThis.innerHeight },
    isTopmost = defaultIsTopmost,
    max = DEFAULT_MAX,
  } = options;
  const kept = new Set<Element>();
  const result: CollectedBrick[] = [];

  for (const el of root.querySelectorAll<HTMLElement>(CANDIDATES)) {
    let covered = false;
    for (let p = el.parentElement; p !== null; p = p.parentElement) {
      if (kept.has(p)) {
        covered = true;
        break;
      }
    }
    if (covered || el.closest(IGNORE) !== null) continue;

    const r = el.getBoundingClientRect();
    const rect: Rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    if (!inPlayZone(rect, viewport.width, viewport.height) || !hasContent(el)) continue;
    const category = classify(el);
    if (!fitsSize(rect, category, viewport.width, viewport.height)) continue;
    if (!isTopmost(el, rect.x + rect.w / 2, rect.y + rect.h / 2)) continue;

    kept.add(el);
    result.push({ el, rect, category, label: labelOf(el, category) });
  }
  return evenlySpaced(result, max);
}
