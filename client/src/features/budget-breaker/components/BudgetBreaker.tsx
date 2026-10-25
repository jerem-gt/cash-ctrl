import { Heart, X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button, IconButton } from '@/components/ui';
import { lockBodyScroll, nextEscapeOrder, pushEscape } from '@/components/ui/escapeStack';
import { fmt } from '@/lib/format';

import { animateBrick, prefersReducedMotion } from '../lib/animate';
import {
  collectBricks,
  type CollectedBrick,
  DAMAGE_BY_CATEGORY,
  isBrickRectValid,
} from '../lib/bricks';
import {
  clamp,
  createGame,
  type GameEvent,
  type GameState,
  type GameStatus,
  INITIAL_LIVES,
  launch as launchBall,
  movePaddle,
  removeBrick,
  resize as resizeGame,
  step,
  toRect,
} from '../lib/engine';
import { pickHitMessage, pickLifeLostMessage } from '../lib/messages';
import { readBest, type RunOutcome, settleRun } from '../lib/record';
import {
  drawFrame,
  loadPalette,
  type Particle,
  pushTrail,
  spawnParticles,
  type TrailPoint,
  updateParticles,
} from '../lib/render';
import { setRemainingRatio } from '../store';

const INTRO_MS = 700;
const RESTORE_MS = 1000;
const RESTORE_REDUCED_MS = 300;
const KEY_SPEED = 900;
const BUBBLE_GAP_MS = 1200;
const BUBBLE_TTL_MS = 2600;
const MAX_FRAME_DT = 0.1;
const HUD_MARGIN = 8;
const SCROLL_KEYS = new Set(['pageup', 'pagedown', 'home', 'end', 'arrowup', 'arrowdown']);

type Phase = 'intro' | 'playing' | 'empty';
type Timer = ReturnType<typeof setTimeout>;

interface Hud {
  lives: number;
  damage: number;
  status: GameStatus;
}

interface Bubble {
  id: number;
  text: string;
  x: number;
  y: number;
  centered: boolean;
}

interface EndResult {
  outcome: 'won' | 'lost';
  damage: number;
  newRecord: boolean;
}

interface Props {
  onClose: () => void;
}

function schedule(timers: Set<Timer>, fn: () => void, ms: number): Timer {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}

function bubbleStyle(b: Bubble): CSSProperties {
  const w = globalThis.innerWidth;
  const h = globalThis.innerHeight;
  if (b.centered) return { left: w / 2, top: h / 2, transform: 'translate(-50%, -50%)' };
  const left = clamp(b.x, 135, Math.max(w - 135, 135));
  const below = b.y < 140;
  return {
    left,
    top: below ? b.y + 32 : b.y - 32,
    transform: `translate(-50%, ${below ? '0' : '-100%'})`,
  };
}

const pixelRatio = () => globalThis.devicePixelRatio || 1;

function CenterCard({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center text-content shadow-2xl">
        {children}
      </div>
    </div>
  );
}

export default function BudgetBreaker({ onClose }: Readonly<Props>) {
  const { t } = useTranslation('game');
  const [phase, setPhase] = useState<Phase>('intro');
  const [hud, setHud] = useState<Hud>({ lives: INITIAL_LIVES, damage: 0, status: 'serve' });
  const [best, setBest] = useState(readBest);
  const [end, setEnd] = useState<EndResult | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [escapeOrder] = useState(nextEscapeOrder);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const topInsetRef = useRef<number | undefined>(undefined);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const bricksRef = useRef<CollectedBrick[]>([]);
  const animsRef = useRef<Animation[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const keysRef = useRef({ left: false, right: false });
  const timersRef = useRef(new Set<Timer>());
  const bubbleTimerRef = useRef<Timer | undefined>(undefined);
  const bubbleSeqRef = useRef(0);
  const lastBubbleRef = useRef(Number.NEGATIVE_INFINITY);
  const lastFrameRef = useRef<number | null>(null);
  const damageRef = useRef(0);
  const playTimeRef = useRef(0);
  const settledRef = useRef(false);
  const busyRef = useRef(false);
  const reducedRef = useRef(false);

  const tRef = useRef(t);
  const onCloseRef = useRef(onClose);
  const actionsRef = useRef<ReturnType<typeof buildActions> | null>(null);

  function showBubble(text: string, x: number, y: number, centered: boolean) {
    bubbleSeqRef.current += 1;
    setBubble({ id: bubbleSeqRef.current, text, x, y, centered });
    clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = schedule(timersRef.current, () => setBubble(null), BUBBLE_TTL_MS);
  }

  function settle(): RunOutcome {
    const current = { newRecord: false, best: readBest() };
    if (settledRef.current) return current;
    settledRef.current = true;
    const outcome = settleRun(damageRef.current, playTimeRef.current);
    setBest(outcome.best);
    return outcome;
  }

  function syncCanvas() {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const dpr = pixelRatio();
    canvas.width = Math.round(globalThis.innerWidth * dpr);
    canvas.height = Math.round(globalThis.innerHeight * dpr);
  }

  function handleBrick(game: GameState, id: number, now: number) {
    const brick = bricksRef.current.at(id);
    if (brick === undefined) return;
    const rect = game.bricks[id].rect;
    const anim = animateBrick(brick.el, reducedRef.current);
    if (anim !== null) animsRef.current.push(anim);
    if (!reducedRef.current) spawnParticles(particlesRef.current, rect);
    damageRef.current += DAMAGE_BY_CATEGORY[brick.category];
    setRemainingRatio(game.aliveCount / game.bricks.length);
    setHud((h) => ({ ...h, damage: damageRef.current }));
    if (now - lastBubbleRef.current >= BUBBLE_GAP_MS) {
      lastBubbleRef.current = now;
      const text = pickHitMessage(tRef.current, brick.category, brick.label);
      showBubble(text, rect.x + rect.w / 2, rect.y + rect.h / 2, false);
    }
  }

  function handleEvents(game: GameState, events: GameEvent[], now: number) {
    let changed = false;
    for (const event of events) {
      if (event.type === 'brick') {
        handleBrick(game, event.id, now);
      } else if (event.type === 'lifeLost') {
        changed = true;
        lastBubbleRef.current = now;
        showBubble(pickLifeLostMessage(tRef.current), 0, 0, true);
      } else if (event.type === 'won' || event.type === 'lost') {
        changed = true;
        const outcome = settle();
        setEnd({ outcome: event.type, damage: damageRef.current, newRecord: outcome.newRecord });
        setBubble(null);
      }
    }
    if (changed) setHud((h) => ({ ...h, lives: game.lives, status: game.status }));
  }

  function measureTopInset() {
    const rect = hudRef.current?.getBoundingClientRect();
    topInsetRef.current =
      rect === undefined || rect.height === 0 ? undefined : rect.bottom + HUD_MARGIN;
    return topInsetRef.current;
  }

  function startRound() {
    const root = rootRef.current;
    const previousVisibility = root?.style.visibility ?? '';
    if (root !== null) root.style.visibility = 'hidden';
    const bricks = collectBricks({ topInset: measureTopInset() });
    if (root !== null) root.style.visibility = previousVisibility;

    busyRef.current = false;
    keysRef.current = { left: false, right: false };
    settledRef.current = false;
    damageRef.current = 0;
    playTimeRef.current = 0;
    particlesRef.current = [];
    trailRef.current = [];
    lastBubbleRef.current = Number.NEGATIVE_INFINITY;
    bricksRef.current = bricks;
    animsRef.current = [];
    setRemainingRatio(1);
    setEnd(null);
    setBubble(null);
    setHud({ lives: INITIAL_LIVES, damage: 0, status: 'serve' });
    if (bricks.length === 0) {
      gameRef.current = null;
      setPhase('empty');
      return;
    }
    gameRef.current = createGame({
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      bricks: bricks.map((b) => b.rect),
    });
    setPhase('playing');
  }

  function restoreAll(done: () => void) {
    const anims = animsRef.current;
    animsRef.current = [];
    setRemainingRatio(1);
    if (anims.length === 0) {
      done();
      return;
    }
    setRefunding(true);
    setBubble(null);
    for (const a of anims) a.reverse();
    schedule(
      timersRef.current,
      () => {
        for (const a of anims) a.cancel();
        setRefunding(false);
        done();
      },
      reducedRef.current ? RESTORE_REDUCED_MS : RESTORE_MS,
    );
  }

  function closeGame() {
    if (busyRef.current) return;
    busyRef.current = true;
    settle();
    restoreAll(() => onCloseRef.current());
  }

  function replay() {
    if (busyRef.current) return;
    busyRef.current = true;
    restoreAll(startRound);
  }

  function launch() {
    const game = gameRef.current;
    if (game === null || busyRef.current || game.status !== 'serve') return;
    launchBall(game);
    setHud((h) => ({ ...h, status: 'playing' }));
  }

  function moveTo(x: number) {
    const game = gameRef.current;
    if (game !== null && !busyRef.current) movePaddle(game, x);
  }

  function handleResize() {
    syncCanvas();
    const game = gameRef.current;
    if (game === null) return;
    const rects = bricksRef.current.map((b, i) =>
      game.bricks[i].alive ? toRect(b.el.getBoundingClientRect()) : game.bricks[i].rect,
    );
    resizeGame(game, globalThis.innerWidth, globalThis.innerHeight, rects);
    dropInvalidBricks(game);
  }

  function dropInvalidBricks(game: GameState) {
    if (busyRef.current) return;
    const viewport = { width: globalThis.innerWidth, height: globalThis.innerHeight };
    const topInset = measureTopInset();
    const events: GameEvent[] = [];
    for (const brick of game.bricks) {
      if (!brick.alive) continue;
      const el = bricksRef.current.at(brick.id)?.el;
      if (el?.isConnected !== true || !isBrickRectValid(brick.rect, viewport, topInset)) {
        events.push(...removeBrick(game, brick.id));
      }
    }
    setRemainingRatio(game.aliveCount / game.bricks.length);
    handleEvents(game, events, performance.now());
  }

  function tick(now: number) {
    const previous = lastFrameRef.current;
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, MAX_FRAME_DT);
    lastFrameRef.current = now;
    const game = gameRef.current;
    if (game === null) return;
    if (!busyRef.current) {
      const dir = Number(keysRef.current.right) - Number(keysRef.current.left);
      if (dir !== 0) movePaddle(game, game.paddle.x + dir * KEY_SPEED * dt);
      if (game.status === 'playing') {
        playTimeRef.current += dt;
        handleEvents(game, step(game, dt), now);
      }
    }
    if (game.status === 'playing' && !reducedRef.current) {
      pushTrail(trailRef.current, game.ball.x, game.ball.y);
    } else {
      trailRef.current = [];
    }
    updateParticles(particlesRef.current, dt);
    const ctx = ctxRef.current;
    if (ctx === null) return;
    const dpr = pixelRatio();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(ctx, game, trailRef.current, particlesRef.current, reducedRef.current);
  }

  function onKey(e: KeyboardEvent, down: boolean) {
    const key = e.key.toLowerCase();
    if (down && SCROLL_KEYS.has(key)) {
      e.preventDefault();
      return;
    }
    const isLeft = key === 'arrowleft' || key === 'a';
    const isRight = key === 'arrowright' || key === 'd';
    // Le relâchement passe toujours, même occupé, pour ne pas bloquer une touche.
    if (!down) {
      if (isLeft) keysRef.current.left = false;
      if (isRight) keysRef.current.right = false;
      return;
    }
    if (busyRef.current) return;
    if (isLeft) {
      keysRef.current.left = true;
      e.preventDefault();
    } else if (isRight) {
      keysRef.current.right = true;
      e.preventDefault();
    } else if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      launch();
    }
  }

  function buildActions() {
    return { startRound, closeGame, handleResize, tick, onKey, syncCanvas, settle };
  }

  useEffect(() => {
    tRef.current = t;
    onCloseRef.current = onClose;
    actionsRef.current = buildActions();
  });

  useEffect(() => {
    const root = rootRef.current;
    const timers = timersRef.current;
    reducedRef.current = prefersReducedMotion();
    loadPalette();
    const unlock = lockBodyScroll();
    const release = pushEscape({
      onEscape: () => actionsRef.current?.closeGame(),
      order: escapeOrder,
    });
    root?.focus();
    try {
      ctxRef.current = canvasRef.current?.getContext('2d') ?? null;
    } catch {
      ctxRef.current = null;
    }
    actionsRef.current?.syncCanvas();

    const preventWheel = (e: WheelEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => actionsRef.current?.onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => actionsRef.current?.onKey(e, false);
    const onResize = () => actionsRef.current?.handleResize();
    const onBlur = () => {
      keysRef.current = { left: false, right: false };
    };
    root?.addEventListener('wheel', preventWheel, { passive: false });
    globalThis.addEventListener('keydown', onKeyDown);
    globalThis.addEventListener('keyup', onKeyUp);
    globalThis.addEventListener('resize', onResize);
    globalThis.addEventListener('blur', onBlur);

    schedule(timers, () => actionsRef.current?.startRound(), INTRO_MS);
    let raf = 0;
    const loop = (now: number) => {
      actionsRef.current?.tick(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      // Démontage externe : enregistre la partie (no-op au double montage StrictMode).
      if (playTimeRef.current > 0) actionsRef.current?.settle();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const a of animsRef.current) a.cancel();
      animsRef.current = [];
      setRemainingRatio(1);
      busyRef.current = false;
      lastFrameRef.current = null;
      root?.removeEventListener('wheel', preventWheel);
      globalThis.removeEventListener('keydown', onKeyDown);
      globalThis.removeEventListener('keyup', onKeyUp);
      globalThis.removeEventListener('resize', onResize);
      globalThis.removeEventListener('blur', onBlur);
      release();
      unlock();
    };
  }, [escapeOrder]);

  useEffect(() => {
    if (end !== null) replayRef.current?.focus();
  }, [end]);

  const playing = phase === 'playing' && hud.status === 'playing' && end === null;
  const showHint = phase === 'playing' && hud.status === 'serve' && end === null && !refunding;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      tabIndex={-1}
      data-budget-breaker-ignore
      className={`fixed inset-0 z-[100] touch-none select-none outline-none ${
        playing ? 'pointer-fine:cursor-none' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        onPointerMove={(e) => moveTo(e.clientX)}
        onPointerDown={(e) => moveTo(e.clientX)}
        onClick={launch}
      />

      {phase === 'intro' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 px-6 text-center text-white">
          <p className="font-display text-4xl font-bold">{t('title')}</p>
          <p className="text-base text-white/80">{t('subtitle')}</p>
        </div>
      )}

      {phase === 'empty' && (
        <CenterCard>
          <p>{t('empty')}</p>
          <Button variant="primary" onClick={closeGame}>
            {t('quit')}
          </Button>
        </CenterCard>
      )}

      {phase !== 'empty' && (
        <div
          ref={hudRef}
          aria-hidden={phase === 'intro' ? true : undefined}
          className={`pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2 ${
            phase === 'intro' ? 'invisible' : ''
          }`}
        >
          <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-1 rounded-2xl bg-sidebar-bg/90 px-4 py-2 text-sm text-sidebar-fg shadow-xl ring-1 ring-white/10 backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span
                role="img"
                aria-label={t('lives_label', { count: hud.lives })}
                className="flex items-center gap-0.5"
              >
                {Array.from({ length: INITIAL_LIVES }, (_, i) => (
                  <Heart
                    key={i}
                    className={`h-4 w-4 ${i < hud.lives ? 'fill-current text-danger-on-dark' : 'text-white/25'}`}
                  />
                ))}
              </span>
              <span>
                {t('damage')} <strong className="tabular-nums">{fmt(hud.damage)}</strong>
              </span>
              <span className="text-white/70">
                {t('best')} <strong className="tabular-nums">{fmt(best)}</strong>
              </span>
              <IconButton
                size="sm"
                label={t('close')}
                onClick={closeGame}
                className="text-white/60! hover:bg-white/10! hover:text-white!"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <p className="text-center text-xs text-white/50">
              <span className="hidden md:inline">{t('controls')}</span>
              <span className="md:hidden">{t('controls_short')}</span>
            </p>
          </div>
        </div>
      )}

      {showHint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit max-w-[90vw] rounded-full bg-sidebar-bg/90 px-4 py-1.5 text-center text-sm text-sidebar-fg shadow-lg">
          <span className="hidden md:inline">{t('serve_hint')}</span>
          <span className="md:hidden">{t('serve_hint_short')}</span>
        </p>
      )}

      {bubble !== null && (
        <div
          key={bubble.id}
          role="status"
          style={bubbleStyle(bubble)}
          className="bb-pop pointer-events-none absolute z-10 w-max max-w-[260px] rounded-2xl bg-sidebar-bg px-3 py-2 text-sm leading-snug text-sidebar-fg shadow-xl ring-1 ring-white/10"
        >
          {bubble.text}
        </div>
      )}

      {refunding && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[90vw] -translate-y-1/2 rounded-2xl bg-sidebar-bg px-5 py-3 text-center text-sidebar-fg shadow-2xl ring-1 ring-white/10"
        >
          {t('refund')}
        </p>
      )}

      {end !== null && !refunding && (
        <CenterCard>
          <p className="font-display text-lg font-semibold">{t(end.outcome)}</p>
          <p className="text-sm text-content-secondary">
            {t('damage')} <strong className="tabular-nums">{fmt(end.damage)}</strong>
            {' · '}
            {t('best')} <strong className="tabular-nums">{fmt(best)}</strong>
          </p>
          {end.newRecord && <p className="font-semibold text-success">{t('new_record')}</p>}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button ref={replayRef} variant="primary" onClick={replay}>
              {t('replay')}
            </Button>
            <Button onClick={closeGame}>{t('quit')}</Button>
          </div>
        </CenterCard>
      )}
    </div>,
    document.body,
  );
}
