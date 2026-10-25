import { describe, expect, it } from 'vitest';

import {
  clamp,
  createGame,
  type GameEvent,
  type GameState,
  launch,
  movePaddle,
  type Rect,
  removeBrick,
  resize,
  step,
  toRect,
} from './engine';

const W = 800;
const H = 600;
const FAR_BRICK: Rect = { x: 10, y: 10, w: 40, h: 20 };

function playing(bricks: Rect[] = [FAR_BRICK]): GameState {
  const state = createGame({ width: W, height: H, bricks });
  state.status = 'playing';
  return state;
}

function runUntil(state: GameState, type: GameEvent['type'], maxSteps = 600): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const events = step(state, 1 / 60);
    all.push(...events);
    if (events.some((e) => e.type === type)) break;
  }
  return all;
}

describe('createGame', () => {
  it('place la raquette au centre, la balle dessus, en attente de lancement', () => {
    const state = createGame({ width: W, height: H, bricks: [FAR_BRICK] });
    expect(state.paddle.x).toBe(W / 2);
    expect(state.paddle.y).toBe(H - 40);
    expect(state.paddle.w).toBe(140);
    expect(state.status).toBe('serve');
    expect(state.lives).toBe(3);
    expect(state.ball.x).toBe(W / 2);
    expect(state.ball.y).toBeLessThan(state.paddle.y);
    expect(state.bricks).toHaveLength(1);
    expect(state.bricks[0].alive).toBe(true);
  });

  it('borne la largeur de raquette et la vitesse de base', () => {
    const small = createGame({ width: 200, height: 300, bricks: [] });
    expect(small.paddle.w).toBe(80);
    expect(small.baseSpeed).toBe(380);
    const big = createGame({ width: 3000, height: 2000, bricks: [] });
    expect(big.paddle.w).toBe(140);
    expect(big.baseSpeed).toBe(620);
  });
});

describe('movePaddle / launch', () => {
  it("borne la raquette dans l'écran et fait suivre la balle en serve", () => {
    const state = createGame({ width: W, height: H, bricks: [FAR_BRICK] });
    movePaddle(state, -500);
    expect(state.paddle.x).toBe(state.paddle.w / 2);
    expect(state.ball.x).toBe(state.paddle.x);
    movePaddle(state, 5000);
    expect(state.paddle.x).toBe(W - state.paddle.w / 2);
  });

  it('lance la balle vers le haut avec un angle injecté', () => {
    const state = createGame({ width: W, height: H, bricks: [FAR_BRICK] });
    launch(state, () => 1);
    expect(state.status).toBe('playing');
    expect(state.ball.vy).toBeLessThan(0);
    expect(state.ball.vx).toBeGreaterThan(0);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(state.speed);
  });

  it('ne relance pas une balle déjà en jeu', () => {
    const state = playing();
    state.ball.vx = 1;
    state.ball.vy = 2;
    launch(state, () => 0);
    expect(state.ball.vx).toBe(1);
  });
});

describe('step', () => {
  it('ne fait rien hors du statut playing', () => {
    const state = createGame({ width: W, height: H, bricks: [FAR_BRICK] });
    expect(step(state, 0.016)).toEqual([]);
  });

  it('rebondit sur le mur gauche, droit et haut', () => {
    const left = playing();
    Object.assign(left.ball, { x: 5, y: 300, vx: -300, vy: 0 });
    expect(step(left, 0.02)).toContainEqual({ type: 'wall' });
    expect(left.ball.vx).toBeGreaterThan(0);

    const right = playing();
    Object.assign(right.ball, { x: W - 5, y: 300, vx: 300, vy: 0 });
    step(right, 0.02);
    expect(right.ball.vx).toBeLessThan(0);

    const top = playing();
    Object.assign(top.ball, { x: 400, y: 5, vx: 0, vy: -300 });
    step(top, 0.02);
    expect(top.ball.vy).toBeGreaterThan(0);
  });

  it('perd une vie en bas et remet la balle en serve', () => {
    const state = playing();
    movePaddle(state, 60);
    Object.assign(state.ball, { x: 700, y: H - 20, vx: 0, vy: 400 });
    const events = runUntil(state, 'lifeLost');
    expect(events).toContainEqual({ type: 'lifeLost' });
    expect(state.lives).toBe(2);
    expect(state.status).toBe('serve');
    expect(state.ball.x).toBe(state.paddle.x);
  });

  it('passe en lost à 0 vie', () => {
    const state = playing();
    state.lives = 1;
    movePaddle(state, 60);
    Object.assign(state.ball, { x: 700, y: H - 20, vx: 0, vy: 400 });
    const events = runUntil(state, 'lost');
    expect(events).toContainEqual({ type: 'lost' });
    expect(state.status).toBe('lost');
    expect(state.lives).toBe(0);
  });

  it('casse une brique et réfléchit la balle', () => {
    const state = playing([{ x: 380, y: 100, w: 40, h: 20 }, FAR_BRICK]);
    Object.assign(state.ball, { x: 400, y: 200, vx: 0, vy: -state.speed });
    const events = runUntil(state, 'brick');
    expect(events).toContainEqual({ type: 'brick', id: 0 });
    expect(state.bricks[0].alive).toBe(false);
    expect(state.ball.vy).toBeGreaterThan(0);
    expect(state.status).toBe('playing');
  });

  it('réfléchit sur le côté quand la balle touche le flanc', () => {
    const state = playing([{ x: 400, y: 100, w: 40, h: 100 }, FAR_BRICK]);
    Object.assign(state.ball, { x: 300, y: 150, vx: state.speed, vy: 0 });
    runUntil(state, 'brick');
    expect(state.ball.vx).toBeLessThan(0);
  });

  it('renvoie la balle vers la droite quand elle touche le bord droit de la raquette', () => {
    const state = playing();
    const { paddle } = state;
    Object.assign(state.ball, {
      x: paddle.x + paddle.w / 2 - 5,
      y: paddle.y - 20,
      vx: 0,
      vy: state.speed,
    });
    const events = runUntil(state, 'paddle');
    expect(events).toContainEqual({ type: 'paddle' });
    expect(state.ball.vx).toBeGreaterThan(0);
    expect(state.ball.vy).toBeLessThan(0);
  });

  it('renvoie la balle droit vers le haut au centre de la raquette', () => {
    const state = playing();
    Object.assign(state.ball, {
      x: state.paddle.x,
      y: state.paddle.y - 20,
      vx: 0,
      vy: state.speed,
    });
    runUntil(state, 'paddle');
    expect(Math.abs(state.ball.vx)).toBeLessThan(1);
    expect(state.ball.vy).toBeLessThan(0);
  });

  it('gagne quand la dernière brique est cassée', () => {
    const state = playing([{ x: 380, y: 100, w: 40, h: 20 }]);
    Object.assign(state.ball, { x: 400, y: 200, vx: 0, vy: -state.speed });
    const events = runUntil(state, 'won');
    expect(events).toContainEqual({ type: 'won' });
    expect(state.status).toBe('won');
  });

  it('ne traverse pas une brique fine avec un gros dt', () => {
    const state = playing([{ x: 380, y: 330, w: 40, h: 2 }, FAR_BRICK]);
    Object.assign(state.ball, { x: 400, y: 400, vx: 0, vy: -3000 });
    const events = step(state, 10);
    expect(events).toContainEqual({ type: 'brick', id: 0 });
  });

  it('accélère de 3 % par brique cassée', () => {
    const state = playing([{ x: 380, y: 100, w: 40, h: 20 }, FAR_BRICK, { ...FAR_BRICK, x: 100 }]);
    Object.assign(state.ball, { x: 400, y: 200, vx: 0, vy: -state.speed });
    runUntil(state, 'brick');
    expect(state.speed).toBeCloseTo(state.baseSpeed * 1.03);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(state.speed);
  });

  it('plafonne la vitesse à 2x la base', () => {
    const bricks = Array.from({ length: 100 }, (_, i) => ({ ...FAR_BRICK, x: 10 + i }));
    bricks[0] = { x: 380, y: 100, w: 40, h: 20 };
    const state = playing(bricks);
    state.aliveCount = 50;
    Object.assign(state.ball, { x: 400, y: 200, vx: 0, vy: -state.speed });
    runUntil(state, 'brick');
    expect(state.speed).toBeCloseTo(state.baseSpeed * 2);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(state.baseSpeed * 2);
  });
});

describe('resize', () => {
  it('met à jour les dimensions, la raquette et les rects des briques', () => {
    const state = createGame({ width: W, height: H, bricks: [FAR_BRICK] });
    resize(state, 400, 700, [{ x: 1, y: 2, w: 30, h: 15 }]);
    expect(state.width).toBe(400);
    expect(state.height).toBe(700);
    expect(state.paddle.y).toBe(660);
    expect(state.bricks[0].rect).toEqual({ x: 1, y: 2, w: 30, h: 15 });
    expect(state.ball.x).toBe(state.paddle.x);
  });

  it('remet la balle dans le terrain et ajuste la vitesse en jeu', () => {
    const state = playing();
    Object.assign(state.ball, { x: 790, y: 300, vx: 100, vy: -100 });
    resize(state, 400, 600, [FAR_BRICK]);
    expect(state.ball.x).toBeLessThanOrEqual(400 - state.ball.r);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(state.baseSpeed);
  });
});

describe('removeBrick', () => {
  const TWO: Rect[] = [FAR_BRICK, { x: 100, y: 10, w: 40, h: 20 }];

  it("retire une brique sans dégât ni victoire tant qu'il en reste", () => {
    const state = playing(TWO);
    expect(removeBrick(state, 0)).toEqual([]);
    expect(state.bricks[0].alive).toBe(false);
    expect(state.aliveCount).toBe(1);
    expect(state.status).toBe('playing');
  });

  it('déclenche la victoire quand la dernière brique est retirée', () => {
    const state = playing(TWO);
    removeBrick(state, 0);
    expect(removeBrick(state, 1)).toEqual([{ type: 'won' }]);
    expect(state.status).toBe('won');
  });

  it('ignore une brique déjà morte ou inconnue', () => {
    const state = playing(TWO);
    removeBrick(state, 0);
    expect(removeBrick(state, 0)).toEqual([]);
    expect(removeBrick(state, 9)).toEqual([]);
    expect(state.aliveCount).toBe(1);
  });
});

describe('clamp / toRect', () => {
  it('borne une valeur', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('convertit un DOMRect en Rect', () => {
    expect(toRect({ left: 1, top: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
});
