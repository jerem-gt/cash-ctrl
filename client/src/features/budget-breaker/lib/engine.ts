export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Brick {
  id: number;
  rect: Rect;
  alive: boolean;
}

export type GameStatus = 'serve' | 'playing' | 'won' | 'lost';

export interface GameState {
  width: number;
  height: number;
  ball: { x: number; y: number; vx: number; vy: number; r: number };
  // x = centre, y = centre vertical
  paddle: { x: number; y: number; w: number; h: number };
  bricks: Brick[];
  lives: number;
  status: GameStatus;
  speed: number;
  baseSpeed: number;
  aliveCount: number;
}

export type GameEvent =
  | { type: 'brick'; id: number }
  | { type: 'wall' }
  | { type: 'paddle' }
  | { type: 'lifeLost' }
  | { type: 'won' }
  | { type: 'lost' };

export interface CreateGameOptions {
  width: number;
  height: number;
  bricks: Rect[];
}

const MAX_DT = 1 / 30;
const BALL_RADIUS = 8;
const PADDLE_HEIGHT = 12;
const PADDLE_BOTTOM_OFFSET = 40;
const MAX_PADDLE_ANGLE = (60 * Math.PI) / 180;
const SPEED_GAIN = 0.03;
const SPEED_CAP = 2;
export const INITIAL_LIVES = 3;

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const toRect = (r: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Rect => ({
  x: r.left,
  y: r.top,
  w: r.width,
  h: r.height,
});

const computeBaseSpeed = (width: number, height: number) =>
  clamp(Math.min(width, height) * 0.75, 380, 620);

const computePaddleWidth = (width: number) => clamp(width * 0.18, 80, 140);

function currentSpeed(state: GameState): number {
  const broken = state.bricks.length - state.aliveCount;
  return Math.min(state.baseSpeed * (1 + SPEED_GAIN * broken), state.baseSpeed * SPEED_CAP);
}

function rescaleVelocity(state: GameState, speed: number) {
  const { ball } = state;
  const norm = Math.hypot(ball.vx, ball.vy);
  state.speed = speed;
  if (norm === 0) return;
  ball.vx = (ball.vx / norm) * speed;
  ball.vy = (ball.vy / norm) * speed;
}

function placeBallOnPaddle(state: GameState) {
  const { ball, paddle } = state;
  ball.x = paddle.x;
  ball.y = paddle.y - paddle.h / 2 - ball.r;
  ball.vx = 0;
  ball.vy = 0;
}

export function createGame({ width, height, bricks }: CreateGameOptions): GameState {
  const baseSpeed = computeBaseSpeed(width, height);
  const state: GameState = {
    width,
    height,
    ball: { x: width / 2, y: 0, vx: 0, vy: 0, r: BALL_RADIUS },
    paddle: {
      x: width / 2,
      y: height - PADDLE_BOTTOM_OFFSET,
      w: computePaddleWidth(width),
      h: PADDLE_HEIGHT,
    },
    bricks: bricks.map((rect, id) => ({ id, rect: { ...rect }, alive: true })),
    lives: INITIAL_LIVES,
    status: 'serve',
    speed: baseSpeed,
    baseSpeed,
    aliveCount: bricks.length,
  };
  placeBallOnPaddle(state);
  return state;
}

export function movePaddle(state: GameState, x: number) {
  const half = state.paddle.w / 2;
  state.paddle.x = clamp(x, half, state.width - half);
  if (state.status === 'serve') placeBallOnPaddle(state);
}

export function launch(state: GameState, random: () => number = Math.random) {
  if (state.status !== 'serve') return;
  const angle = (random() - 0.5) * 0.5;
  state.status = 'playing';
  state.ball.vx = state.speed * Math.sin(angle);
  state.ball.vy = -state.speed * Math.cos(angle);
}

export function resize(state: GameState, width: number, height: number, bricks: Rect[]) {
  state.width = width;
  state.height = height;
  state.baseSpeed = computeBaseSpeed(width, height);
  state.paddle.y = height - PADDLE_BOTTOM_OFFSET;
  state.paddle.w = computePaddleWidth(width);
  for (const brick of state.bricks) {
    const rect = bricks.at(brick.id);
    if (rect !== undefined) brick.rect = { ...rect };
  }
  const half = state.paddle.w / 2;
  state.paddle.x = clamp(state.paddle.x, half, width - half);
  const speed = currentSpeed(state);
  if (state.status === 'serve') {
    state.speed = speed;
    placeBallOnPaddle(state);
    return;
  }
  rescaleVelocity(state, speed);
  state.ball.x = clamp(state.ball.x, state.ball.r, width - state.ball.r);
  state.ball.y = clamp(state.ball.y, state.ball.r, height);
}

// Retire une brique devenue invalide (sans dégât) ; 'won' quand c'était la dernière.
export function removeBrick(state: GameState, id: number): GameEvent[] {
  const brick = state.bricks.at(id);
  if (!brick?.alive) return [];
  brick.alive = false;
  state.aliveCount -= 1;
  const inPlay = state.status === 'serve' || state.status === 'playing';
  if (state.aliveCount === 0 && inPlay) {
    state.status = 'won';
    return [{ type: 'won' }];
  }
  return [];
}

function hitsRect(ball: GameState['ball'], rect: Rect): boolean {
  const nx = clamp(ball.x, rect.x, rect.x + rect.w);
  const ny = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  return dx * dx + dy * dy <= ball.r * ball.r;
}

function collideBrick(state: GameState, brick: Brick) {
  const { ball } = state;
  const { rect } = brick;
  const overlapX = Math.min(ball.x + ball.r, rect.x + rect.w) - Math.max(ball.x - ball.r, rect.x);
  const overlapY = Math.min(ball.y + ball.r, rect.y + rect.h) - Math.max(ball.y - ball.r, rect.y);
  if (overlapX < overlapY) {
    const fromLeft = ball.x < rect.x + rect.w / 2;
    ball.vx = fromLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
    ball.x += fromLeft ? -overlapX : overlapX;
  } else {
    const fromTop = ball.y < rect.y + rect.h / 2;
    ball.vy = fromTop ? -Math.abs(ball.vy) : Math.abs(ball.vy);
    ball.y += fromTop ? -overlapY : overlapY;
  }
}

function collideWalls(state: GameState): boolean {
  const { ball, width } = state;
  let hit = false;
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    hit = true;
  } else if (ball.x + ball.r > width) {
    ball.x = width - ball.r;
    ball.vx = -Math.abs(ball.vx);
    hit = true;
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    hit = true;
  }
  return hit;
}

function collidePaddle(state: GameState): boolean {
  const { ball, paddle } = state;
  if (ball.vy <= 0) return false;
  const top = paddle.y - paddle.h / 2;
  const bottom = paddle.y + paddle.h / 2;
  const left = paddle.x - paddle.w / 2;
  const right = paddle.x + paddle.w / 2;
  const within =
    ball.x + ball.r >= left &&
    ball.x - ball.r <= right &&
    ball.y + ball.r >= top &&
    ball.y <= bottom;
  if (!within) return false;
  const offset = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
  const angle = offset * MAX_PADDLE_ANGLE;
  ball.vx = state.speed * Math.sin(angle);
  ball.vy = -state.speed * Math.cos(angle);
  ball.y = top - ball.r;
  return true;
}

function loseLife(state: GameState, events: GameEvent[]) {
  state.lives -= 1;
  events.push({ type: 'lifeLost' });
  if (state.lives <= 0) {
    state.status = 'lost';
    events.push({ type: 'lost' });
    return;
  }
  state.status = 'serve';
  placeBallOnPaddle(state);
}

function collideBricks(state: GameState, events: GameEvent[]) {
  for (const brick of state.bricks) {
    if (!brick.alive || !hitsRect(state.ball, brick.rect)) continue;
    collideBrick(state, brick);
    brick.alive = false;
    state.aliveCount -= 1;
    events.push({ type: 'brick', id: brick.id });
    rescaleVelocity(state, currentSpeed(state));
    if (state.aliveCount === 0) {
      state.status = 'won';
      events.push({ type: 'won' });
    }
    return;
  }
}

function substep(state: GameState, dt: number, events: GameEvent[]) {
  const { ball } = state;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (collideWalls(state)) events.push({ type: 'wall' });
  if (collidePaddle(state)) events.push({ type: 'paddle' });
  collideBricks(state, events);
  if (state.status === 'playing' && ball.y - ball.r > state.height) loseLife(state, events);
}

export function step(state: GameState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status !== 'playing') return events;
  const clamped = clamp(dt, 0, MAX_DT);
  const distance = Math.hypot(state.ball.vx, state.ball.vy) * clamped;
  const count = Math.max(1, Math.ceil(distance / state.ball.r));
  const sub = clamped / count;
  for (let i = 0; i < count && state.status === 'playing'; i++) {
    substep(state, sub, events);
  }
  return events;
}
