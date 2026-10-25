import type { GameState, Rect } from './engine';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface TrailPoint {
  x: number;
  y: number;
}

const FALLBACK_PALETTE = { brand: '#2cc5dd', brandDark: '#0d8896', brandLight: '#a5e9f0' };
let palette = FALLBACK_PALETTE;
const GRAVITY = 700;
const TRAIL_LENGTH = 14;

// Lit les tokens de marque une fois au montage ; valeurs de repli si absents (jsdom).
export function loadPalette() {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  palette = {
    brand: read('--color-brand-400', FALLBACK_PALETTE.brand),
    brandDark: read('--color-brand-600', FALLBACK_PALETTE.brandDark),
    brandLight: read('--color-brand-200', FALLBACK_PALETTE.brandLight),
  };
}

export function spawnParticles(list: Particle[], rect: Rect, random: () => number = Math.random) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const colors = [palette.brand, palette.brandLight, '#ffffff', '#f87171'];
  for (let i = 0; i < 12; i++) {
    const angle = random() * Math.PI * 2;
    const speed = 60 + random() * 220;
    list.push({
      x: cx + (random() - 0.5) * rect.w * 0.6,
      y: cy + (random() - 0.5) * rect.h * 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      life: 0.6,
      max: 0.6,
      size: 2 + random() * 3,
      color: colors[Math.floor(random() * colors.length)],
    });
  }
}

export function updateParticles(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function pushTrail(trail: TrailPoint[], x: number, y: number) {
  trail.push({ x, y });
  if (trail.length > TRAIL_LENGTH) trail.shift();
}

function drawPaddle(ctx: CanvasRenderingContext2D, paddle: GameState['paddle']) {
  const x = paddle.x - paddle.w / 2;
  const y = paddle.y - paddle.h / 2;
  const gradient = ctx.createLinearGradient(x, y, x + paddle.w, y);
  gradient.addColorStop(0, palette.brandDark);
  gradient.addColorStop(1, palette.brand);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, paddle.w, paddle.h, paddle.h / 2);
  } else {
    ctx.rect(x, y, paddle.w, paddle.h);
  }
  ctx.fill();
}

function drawBricks(ctx: CanvasRenderingContext2D, bricks: GameState['bricks']) {
  ctx.save();
  ctx.strokeStyle = palette.brand;
  ctx.fillStyle = palette.brand;
  ctx.lineWidth = 1.5;
  for (const { rect, alive } of bricks) {
    if (!alive) continue;
    const x = rect.x - 2;
    const y = rect.y - 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, rect.w + 4, rect.h + 4, 6);
    } else {
      ctx.rect(x, y, rect.w + 4, rect.h + 4);
    }
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  trail: TrailPoint[],
  particles: Particle[],
  reduced: boolean,
) {
  ctx.clearRect(0, 0, game.width, game.height);
  drawBricks(ctx, game.bricks);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(p.life / p.max, 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  if (!reduced) {
    trail.forEach((point, i) => {
      const k = (i + 1) / trail.length;
      ctx.globalAlpha = k * 0.45;
      ctx.fillStyle = palette.brand;
      ctx.beginPath();
      ctx.arc(point.x, point.y, game.ball.r * k, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  drawPaddle(ctx, game.paddle);

  ctx.save();
  ctx.shadowColor = palette.brand;
  ctx.shadowBlur = reduced ? 0 : 16;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(game.ball.x, game.ball.y, game.ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
