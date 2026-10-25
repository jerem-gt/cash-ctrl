import { beforeEach, describe, expect, it } from 'vitest';

import { classify, collectBricks, type CollectOptions, isBrickRectValid } from './bricks';
import type { Rect } from './engine';

const VIEWPORT = { width: 1000, height: 800 };

function setRect(el: Element, rect: Rect) {
  el.getBoundingClientRect = () => ({
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    right: rect.x + rect.w,
    bottom: rect.y + rect.h,
    x: rect.x,
    y: rect.y,
    toJSON: () => ({}),
  });
}

const box = (x = 100, y = 100, w = 120, h = 30): Rect => ({ x, y, w, h });

function collect(options: CollectOptions = {}) {
  return collectBricks({ viewport: VIEWPORT, isTopmost: () => true, ...options });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('collectBricks', () => {
  it("retient l'élément le plus externe et ignore ses descendants", () => {
    document.body.innerHTML = '<button id="b"><span>Valider</span></button>';
    setRect(document.getElementById('b')!, box());
    setRect(document.querySelector('span')!, box());
    const result = collect();
    expect(result).toHaveLength(1);
    expect(result[0].el.id).toBe('b');
  });

  it('garde les descendants quand le parent est trop grand', () => {
    document.body.innerHTML = '<li id="parent"><span id="child">Texte</span></li>';
    setRect(document.getElementById('parent')!, box(0, 0, 900, 100));
    setRect(document.getElementById('child')!, box(10, 90));
    const result = collect();
    expect(result.map((r) => r.el.id)).toEqual(['child']);
  });

  it('exclut ce qui sort du viewport ou touche la zone de la raquette ou du HUD', () => {
    document.body.innerHTML =
      '<button id="ok">a</button><button id="out">b</button><button id="low">c</button><button id="tiny">d</button><button id="hud">e</button>';
    setRect(document.getElementById('hud')!, box(100, 40));
    setRect(document.getElementById('ok')!, box(100, 100));
    setRect(document.getElementById('out')!, box(950, 100));
    setRect(document.getElementById('low')!, box(100, 700));
    setRect(document.getElementById('tiny')!, box(100, 100, 10, 30));
    expect(collect().map((r) => r.el.id)).toEqual(['ok']);
  });

  it('exclut les éléments trop grands sauf les graphiques', () => {
    document.body.innerHTML =
      '<p id="p">Texte</p><div class="recharts-wrapper" id="c"><svg class="recharts-surface"></svg></div>';
    setRect(document.getElementById('p')!, box(0, 0, 700, 50));
    setRect(document.getElementById('c')!, box(0, 100, 700, 300));
    const result = collect();
    expect(result.map((r) => r.el.id)).toEqual(['c']);
    expect(result[0].category).toBe('chart');
  });

  it('ignore les éléments vides et [data-budget-breaker-ignore]', () => {
    document.body.innerHTML =
      '<span id="empty">   </span><div data-budget-breaker-ignore><button id="x">X</button></div><button id="y">Y</button>';
    for (const id of ['empty', 'x', 'y']) setRect(document.getElementById(id)!, box());
    expect(collect().map((r) => r.el.id)).toEqual(['y']);
  });

  it('ignore les éléments masqués selon isTopmost', () => {
    document.body.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    setRect(document.getElementById('a')!, box());
    setRect(document.getElementById('b')!, box(300, 100));
    const result = collect({ isTopmost: (el) => el.id === 'b' });
    expect(result.map((r) => r.el.id)).toEqual(['b']);
  });

  it('exclut les briques sous topInset (bas du HUD mesuré)', () => {
    document.body.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    setRect(document.getElementById('a')!, box(100, 100));
    setRect(document.getElementById('b')!, box(300, 200));
    expect(collect({ topInset: 150 }).map((r) => r.el.id)).toEqual(['b']);
  });

  it('plafonne le nombre de briques', () => {
    document.body.innerHTML = Array.from(
      { length: 20 },
      (_, i) => `<button id="b${i}">${i}</button>`,
    ).join('');
    document
      .querySelectorAll('button')
      .forEach((b, i) => setRect(b, box(10 + (i % 5) * 150, 10 + Math.floor(i / 5) * 50)));
    expect(collect({ max: 7 })).toHaveLength(7);
  });

  it('tronque le label à 28 caractères et compacte les espaces', () => {
    document.body.innerHTML =
      '<button id="a">  Un   libellé    vraiment extrêmement long ici </button>';
    setRect(document.getElementById('a')!, box());
    const { label } = collect()[0];
    expect(label).toHaveLength(28);
    expect(label.endsWith('…')).toBe(true);
    expect(label.startsWith('Un libellé vraiment')).toBe(true);
  });

  it('utilise la première cellule hors montant et date pour une ligne', () => {
    document.body.innerHTML =
      '<table><tbody><tr id="r"><td>12 oct. 2026</td><td>Courses Carrefour</td><td>-45,20 €</td></tr></tbody></table>';
    setRect(document.getElementById('r')!, box(100, 100, 500, 30));
    const result = collect();
    expect(result[0].category).toBe('row');
    expect(result[0].label).toBe('Courses Carrefour');
  });

  it('utilise le montant lui-même comme label', () => {
    document.body.innerHTML = '<span id="m">1 234 €</span>';
    setRect(document.getElementById('m')!, box());
    const result = collect();
    expect(result[0].category).toBe('amount');
    expect(result[0].label).toBe('1 234 €');
  });
});

describe('isBrickRectValid', () => {
  it('accepte une brique dans la zone de jeu', () => {
    expect(isBrickRectValid(box(), VIEWPORT, 80)).toBe(true);
  });

  it.each([
    ['rect nul', { x: 0, y: 0, w: 0, h: 0 }],
    ['sous le HUD', box(100, 40)],
    ['hors écran', box(950, 100)],
    ['dans la zone raquette', box(100, 700)],
  ])('refuse %s', (_name, rect) => {
    expect(isBrickRectValid(rect, VIEWPORT, 80)).toBe(false);
  });
});

describe('classify', () => {
  function make(html: string): Element {
    document.body.innerHTML = html;
    return document.body.firstElementChild!;
  }

  it.each([
    ['<a href="/accounts/3">Livret</a>', 'account'],
    ['<a href="/reports">Rapports</a>', 'nav'],
    ['<button>Ok</button>', 'button'],
    ['<input value="x" />', 'button'],
    ['<h2>Titre</h2>', 'heading'],
    ['<div role="row">x</div>', 'row'],
    ['<div class="recharts-wrapper"></div>', 'chart'],
    ['<div><svg class="recharts-surface"></svg></div>', 'chart'],
    ['<span>12,50 €</span>', 'amount'],
    ['<span>Bonjour</span>', 'generic'],
  ])('classe %s en %s', (html, expected) => {
    expect(classify(make(html))).toBe(expected);
  });

  it('classe un tr en row', () => {
    document.body.innerHTML = '<table><tbody><tr><td>a</td></tr></tbody></table>';
    expect(classify(document.querySelector('tr')!)).toBe('row');
  });
});
