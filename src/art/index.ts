// Arte em pixel art procedural, aparada do módulo do Habblaud (MIT, ver LICENSE).
// Tudo é desenhado em código (PixelBuf) e vira canvas uma única vez por combinação de parâmetros (cache).
import { hash32 } from '../shared/hash';
import { appearanceFromSeed as appearanceFromSeedPure } from '../shared/appearance-flat';
import type { Appearance, CharacterFrameRequest, FloorKind, FurnitureKind, FurnitureSprites, Pose, RoomTheme, Sprite, WallStyle } from './api';
import { TILE } from './api';
import { shade } from './core/color';
import type { PixelBuf } from './core/pixbuf';
import type { BufSprite } from './core/sprite';
import { normalizeFurniture, renderFurniture } from './furniture/index';
import { CHAR_H, CHAR_W, POSE_DURATION, POSE_FRAMES, isSeated, renderCharacter } from './character/render';
import { CHUNK_PX, floorChunk } from './surfaces/floor';
import { WALL_CAP_H, WALL_FACE_H, capColor, wallFaceTile } from './surfaces/walls';
import { roomTheme as roomThemePure } from './theme';

export * from './api';
export { hash32 };

function toCanvas(buf: PixelBuf): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, buf.w);
  c.height = Math.max(1, buf.h);
  const ctx = c.getContext('2d');
  if (ctx && buf.w > 0 && buf.h > 0) ctx.putImageData(new ImageData(buf.data, buf.w, buf.h), 0, 0);
  return c;
}

function toSprite(s: BufSprite): Sprite {
  return { canvas: toCanvas(s.buf), ax: s.ax, ay: s.ay, rects: s.rects };
}

/** Cache simples, sem limite: o app tem poucas combinações. */
function memo<T>(map: Map<string, T>, key: string, make: () => T): T {
  let v = map.get(key);
  if (v === undefined) {
    v = make();
    map.set(key, v);
  }
  return v;
}

const charCache = new Map<string, Sprite>();
const furnCache = new Map<string, FurnitureSprites>();
const tileCache = new Map<string, HTMLCanvasElement>();
const floorCache = new Map<string, HTMLCanvasElement>();

export const CHARACTER_SHEET = { w: CHAR_W, h: CHAR_H } as const;

export function appearanceFromSeed(seed: number, look?: 'f' | 'm'): Appearance {
  return appearanceFromSeedPure(seed, { look });
}

export const poseFrameCount = (pose: Pose): number => POSE_FRAMES[pose] ?? 1;
export const poseFrameDuration = (pose: Pose): number => POSE_DURATION[pose] ?? 500;

export function characterSprite(req: CharacterFrameRequest): Sprite {
  const n = poseFrameCount(req.pose);
  const frame = ((Math.floor(req.frame) % n) + n) % n;
  const seated = isSeated(req.pose, req.seated);
  const key = `${JSON.stringify(req.appearance)}|${req.dir}|${req.pose}|${frame}|${req.held ?? 'none'}|${seated ? 1 : 0}`;
  return memo(charCache, key, () => toSprite(renderCharacter({ ...req, frame, seated })));
}

export function furnitureSprites(kind: FurnitureKind, variant?: string, seed = 0): FurnitureSprites {
  const n = normalizeFurniture(kind, variant, 0, seed);
  const key = `${kind}|${n.variant ?? '-'}|${n.state}|${n.vseed}`;
  return memo(furnCache, key, () => {
    const f = renderFurniture(kind, n.variant, n.state, n.vseed);
    return { base: toSprite(f.base), front: f.front ? toSprite(f.front) : undefined };
  });
}

export const roomTheme = (seed: number): RoomTheme => roomThemePure(seed);

/** Piso de uma área (px de mundo), em blocos de 8x8 tiles recortados à área pedida. */
export function drawFloor(ctx: CanvasRenderingContext2D, kind: FloorKind, x: number, y: number, w: number, h: number, opts: { seed: number; tint?: string; tint2?: string }): void {
  for (let cy = Math.floor(y / CHUNK_PX); cy < Math.ceil((y + h) / CHUNK_PX); cy++) {
    for (let cx = Math.floor(x / CHUNK_PX); cx < Math.ceil((x + w) / CHUNK_PX); cx++) {
      const key = `${kind}|${opts.seed}|${opts.tint ?? ''}|${opts.tint2 ?? ''}|${cx}|${cy}`;
      const chunk = memo(floorCache, key, () => toCanvas(floorChunk(kind, cx, cy, opts)));
      const px = cx * CHUNK_PX;
      const py = cy * CHUNK_PX;
      const sx = Math.max(0, x - px);
      const sy = Math.max(0, y - py);
      const ex = Math.min(CHUNK_PX, x + w - px);
      const ey = Math.min(CHUNK_PX, y + h - py);
      if (ex > sx && ey > sy) ctx.drawImage(chunk, sx, sy, ex - sx, ey - sy, px + sx, py + sy, ex - sx, ey - sy);
    }
  }
}

function tileHash(seed: number, tx: number, ty: number): number {
  let h = Math.imul(tx | 0, 0x9e3779b1) ^ Math.imul(ty | 0, 0x85ebca77) ^ Math.imul(seed | 0, 0xc2b2ae3d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** Face da parede norte (2 tiles de altura a partir de y). */
export function drawWallFace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, style: WallStyle): void {
  const sk = `${style.base}|${style.trim ?? ''}|${style.pattern ?? 'plain'}`;
  for (let tx = Math.floor(x / TILE); tx * TILE < x + w; tx++) {
    const variant = tileHash(7, tx, 0) % 4;
    const col = tx & 1;
    const tile = memo(tileCache, `${sk}|${variant}|${col}`, () => toCanvas(wallFaceTile(style, variant, col)));
    const px = tx * TILE;
    const sx = Math.max(0, x - px);
    const ex = Math.min(TILE, x + w - px);
    if (ex > sx) ctx.drawImage(tile, sx, 0, ex - sx, WALL_FACE_H, px + sx, y, ex - sx, WALL_FACE_H);
  }
}

/** Tampa de parede (laterais). */
export function drawWallTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: WallStyle): void {
  const cap = capColor(style);
  ctx.fillStyle = cap;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(cap, 0.08);
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = shade(cap, -0.06);
  if (h > 2) ctx.fillRect(x, y + h - 1, w, 1);
}

export { WALL_CAP_H, WALL_FACE_H };
