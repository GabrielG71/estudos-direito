// A sala em pixel art: parede, piso, móveis e o boneco da matéria passeando.
// Usa a arte procedural (src/art). A cena é desenhada em resolução nativa (11x7 tiles) e ampliada pelo CSS
// (image-rendering: pixelated). Um único laço (requestAnimationFrame) anima todas as cenas na tela.
import {
  TILE, appearanceFromSeed, characterSprite, drawFloor, drawWallFace, drawWallTop, furnitureSprites,
  hash32, poseFrameCount, poseFrameDuration,
  type Appearance, type Dir, type FurnitureKind, type HeldItem, type Pose,
} from './art';
import { shade } from './art/core/color';

const COLS = 11;
const ROWS = 7; // 2 de parede + 5 de piso
const W = COLS * TILE;
const H = ROWS * TILE;
const FPS = 12;

/** Peças do cenário: [tipo, variante, x do centro em tiles, linha de baixo em tiles]. Parede: linha = base da parede. */
const MOVEIS: [FurnitureKind, string | undefined, number, number][] = [
  ['clock', undefined, 5.5, 2],
  ['window', undefined, 7, 2],
  ['poster', 'rocket', 10.5, 2],
  ['plant_tall', 'ficus', 0.5, 3],
  ['bookshelf', undefined, 2.5, 3],
  ['binder_shelf', undefined, 4, 3],
  ['desk', 'wood', 9, 4],
  ['plant_small', 'succulent', 10.5, 3.7],
];
const PASSEIO = { x0: 20, x1: W - 20, y: 6.4 * TILE }; // faixa livre do piso, na frente dos móveis

export function aparencia(id: string, cor: string): Appearance {
  const seed = hash32(id);
  const a = appearanceFromSeed(seed);
  return { ...a, top: cor, topAccent: a.topAccent === cor ? '#f4f4f0' : a.topAccent };
}

function fundo(id: string, cor: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const seed = hash32(id);
  const parede = { base: '#f6f0e5', trim: shade(cor, -0.1), pattern: 'plain' as const };
  drawFloor(ctx, 'carpet', 0, 2 * TILE, W, H - 2 * TILE, { seed, tint: shade(cor, 0.38), tint2: shade(cor, 0.32) });
  drawWallFace(ctx, 0, 0, W, parede);
  drawWallTop(ctx, 0, 0, W, 4, parede);
  // Profundidade: quem tem a base mais abaixo é desenhado depois.
  for (const [kind, variant, cx, bottom] of [...MOVEIS].sort((a, b) => a[3] - b[3])) {
    const s = furnitureSprites(kind, variant, seed).base;
    ctx.drawImage(s.canvas, Math.round(cx * TILE - s.ax), Math.round(bottom * TILE - s.ay));
  }
  return c;
}

interface Cena { parar(): void; estudando(v: boolean): void }

type Atividade = { pose: Pose; held: HeldItem; ms: number };
const IDLES: Atividade[] = [
  { pose: 'stand', held: 'none', ms: 3000 },
  { pose: 'read', held: 'book', ms: 5000 },
  { pose: 'drink', held: 'coffee', ms: 3000 },
  { pose: 'stretch', held: 'none', ms: 2500 },
  { pose: 'stand', held: 'none', ms: 2000 },
];

interface Estado {
  x: number;
  dir: Dir;
  pose: Pose;
  held: HeldItem;
  ate: number; // fim da atividade parada (ms)
  alvo: number | null; // destino quando andando
}

const cenas = new Set<{ tick(t: number): void }>();
let raf = 0;
let ultimo = 0;

function loop(t: number): void {
  raf = cenas.size && !document.hidden ? requestAnimationFrame(loop) : 0;
  if (t - ultimo < 1000 / FPS) return;
  ultimo = t;
  for (const c of cenas) c.tick(t);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !raf && cenas.size) raf = requestAnimationFrame(loop);
});

/** Monta a sala dentro do canvas e passa a animá-la até `parar()`. */
export function criarCena(canvas: HTMLCanvasElement, sala: { id: string; cor: string }): Cena {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const bg = fundo(sala.id, sala.cor);
  const look = aparencia(sala.id, sala.cor);
  const rnd = (() => { let s = hash32(sala.id) || 1; return () => ((s = Math.imul(s, 1664525) + 1013904223 >>> 0) / 4294967296); })();
  const st: Estado = { x: PASSEIO.x0 + rnd() * (PASSEIO.x1 - PASSEIO.x0), dir: 'down', pose: 'stand', held: 'none', ate: 0, alvo: null };
  let estudando = false;
  let anterior = 0;

  const desenhar = (t: number) => {
    ctx.drawImage(bg, 0, 0);
    const n = poseFrameCount(st.pose);
    const frame = Math.floor(t / poseFrameDuration(st.pose)) % n;
    const s = characterSprite({ appearance: look, dir: st.dir, pose: st.pose, frame, held: st.held });
    ctx.drawImage(s.canvas, Math.round(st.x - s.ax), Math.round(PASSEIO.y - s.ay));
  };

  const cena = {
    tick(t: number) {
      const dt = anterior ? Math.min(0.25, (t - anterior) / 1000) : 0;
      anterior = t;
      if (estudando) {
        st.pose = 'read'; st.held = 'book'; st.dir = 'down'; st.alvo = null;
      } else if (st.alvo !== null) {
        const d = st.alvo - st.x;
        const passo = 22 * dt;
        if (Math.abs(d) <= passo) {
          st.x = st.alvo; st.alvo = null; st.ate = 0;
        } else {
          st.x += Math.sign(d) * passo;
          st.dir = d > 0 ? 'right' : 'left';
          st.pose = 'walk'; st.held = 'none';
        }
      }
      if (!estudando && st.alvo === null && t >= st.ate) {
        if (rnd() < 0.45) {
          st.alvo = PASSEIO.x0 + rnd() * (PASSEIO.x1 - PASSEIO.x0);
        } else {
          const a = IDLES[Math.floor(rnd() * IDLES.length)];
          st.pose = a.pose; st.held = a.held; st.dir = 'down'; st.ate = t + a.ms;
        }
      }
      desenhar(t);
    },
  };
  desenhar(0);
  cenas.add(cena);
  if (!raf) raf = requestAnimationFrame(loop);
  return {
    parar: () => { cenas.delete(cena); },
    estudando: (v) => { estudando = v; if (!v) st.ate = 0; },
  };
}
