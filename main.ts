// The World in One Day - news-image-20261122 entry v2.
// A one-page newspaper summing up Sunday 22 November 2026, drawn from code.
// Node 22, standard library only. Deterministic and offline: no clocks, no
// randomness, no network. Writes entry.png to MAKEFUN_OUTPUT_DIR.
//
// All 36 stories were verified against at least two published sources whose
// dates agree on 22 November 2026 (see SOURCES.md). Every illustration is
// an original flat drawing made by this program; no photo is used.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- colours
type RGB = [number, number, number];
const PAPER: RGB = [246, 239, 221];
const INK: RGB = [25, 23, 19];
const RED: RGB = [168, 30, 34];
const NAVY: RGB = [32, 57, 94];
const TEAL: RGB = [15, 118, 110];
const GOLD: RGB = [166, 124, 0];
const GREEN: RGB = [46, 125, 50];
const GREY: RGB = [107, 107, 102];
const RULE: RGB = [201, 191, 165];
const WHITE: RGB = [255, 255, 255];
const SKY: RGB = [186, 214, 228];
const SKYNIGHT: RGB = [38, 52, 84];

// ---------------------------------------------------------------- canvas
class Canvas {
  w: number; h: number; px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w; this.h = h; this.px = new Uint8Array(w * h * 3);
    this.rect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: RGB): void {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const o = (yi * this.w + xi) * 3;
    this.px[o] = c[0]; this.px[o + 1] = c[1]; this.px[o + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      let o = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) { this.px[o] = c[0]; this.px[o + 1] = c[1]; this.px[o + 2] = c[2]; o += 3; }
    }
  }
  // filled disc
  disc(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.max(0.5, r);
    for (let yy = Math.floor(cy - rr); yy <= Math.ceil(cy + rr); yy++)
      for (let xx = Math.floor(cx - rr); xx <= Math.ceil(cx + rr); xx++)
        if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= rr * rr) this.set(xx, yy, c);
  }
  // thick line segment, round caps
  line(x0: number, y0: number, x1: number, y1: number, wd: number, c: RGB): void {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len * 2));
    const r = Math.max(0.6, wd / 2);
    for (let i = 0; i <= steps; i++) this.disc(x0 + dx * i / steps, y0 + dy * i / steps, r, c);
  }
  polyline(pts: number[], wd: number, c: RGB): void {
    for (let i = 0; i + 3 < pts.length; i += 2) this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], wd, c);
  }
  // filled polygon (even-odd scanline)
  poly(pts: number[], c: RGB): void {
    let minY = 1e9, maxY = -1e9;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        const x0 = pts[i], y0 = pts[i + 1], x1 = pts[(i + 2) % pts.length], y1 = pts[(i + 3) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) this.rect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    const pts: number[] = [];
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2;
      pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    this.poly(pts, c);
  }
  ring(cx: number, cy: number, r: number, wd: number, c: RGB): void {
    for (let i = 0; i < 48; i++) {
      const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2;
      this.line(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, wd, c);
    }
  }
}

// ------------------------------------------------------- vector stroke font
// Single-stroke lettering on a 0..6 x 0..12 grid; baseline y=9, cap height 9.
// Glyph = list of strokes; a stroke is a flat [x,y,...] polyline.
type Glyph = number[][];
const FONT: Record<string, Glyph> = {
  A: [[0, 9, 3, 0, 6, 9], [1.8, 5.5, 4.2, 5.5]],
  B: [[0, 0, 0, 9], [0, 0, 4, 0, 5.5, 1.5, 5.5, 3.5, 4, 4.5, 0, 4.5], [0, 4.5, 4.5, 4.5, 5.5, 6, 5.5, 7.5, 4, 9, 0, 9]],
  C: [[5.5, 2, 4, 0, 2, 0, 0.5, 1.5, 0, 4.5, 0.5, 7.5, 2, 9, 4, 9, 5.5, 7]],
  D: [[0, 0, 0, 9], [0, 0, 3.5, 0, 5.5, 2, 6, 4.5, 5.5, 7, 3.5, 9, 0, 9]],
  E: [[0, 0, 0, 9], [0, 0, 5, 0], [0, 4.5, 4, 4.5], [0, 9, 5, 9]],
  F: [[0, 0, 0, 9], [0, 0, 5, 0], [0, 4.5, 4, 4.5]],
  G: [[5.5, 2, 4, 0, 2, 0, 0.5, 1.5, 0, 4.5, 0.5, 7.5, 2, 9, 4, 9, 5.5, 7, 5.5, 5], [3.5, 5, 5.5, 5]],
  H: [[0, 0, 0, 9], [6, 0, 6, 9], [0, 4.5, 6, 4.5]],
  I: [[1.5, 0, 4.5, 0], [3, 0, 3, 9], [1.5, 9, 4.5, 9]],
  J: [[1.5, 0, 4.5, 0], [3.5, 0, 3.5, 7, 2, 9, 0.5, 8.5]],
  K: [[0, 0, 0, 9], [5.5, 0, 0.8, 4.8, 5.5, 9]],
  L: [[0, 0, 0, 9], [0, 9, 5, 9]],
  M: [[0, 9, 0, 0, 3, 5, 6, 0, 6, 9]],
  N: [[0, 9, 0, 0, 6, 9, 6, 0]],
  O: [[3, 0, 5, 1, 6, 3, 6, 6, 5, 8, 3, 9, 1, 8, 0, 6, 0, 3, 1, 1, 3, 0]],
  P: [[0, 0, 0, 9], [0, 0, 4, 0, 5.5, 1.5, 5.5, 3, 4, 4.5, 0, 4.5]],
  Q: [[3, 0, 5, 1, 6, 3, 6, 6, 5, 8, 3, 9, 1, 8, 0, 6, 0, 3, 1, 1, 3, 0], [3.5, 6.5, 6, 9.5]],
  R: [[0, 0, 0, 9], [0, 0, 4, 0, 5.5, 1.5, 5.5, 3, 4, 4.5, 0, 4.5], [3.5, 4.5, 6, 9]],
  S: [[5, 1, 4, 0, 2, 0, 0.5, 1.5, 0, 3, 1, 4.5, 3, 4.5, 5, 4.5, 6, 6, 5.5, 8, 4, 9, 2, 9, 0.5, 8]],
  T: [[0, 0, 6, 0], [3, 0, 3, 9]],
  U: [[0, 0, 0, 7, 1, 9, 3, 9, 5, 9, 6, 7, 6, 0]],
  V: [[0, 0, 3, 9, 6, 0]],
  W: [[0, 0, 1.5, 9, 3, 4, 4.5, 9, 6, 0]],
  X: [[0, 0, 6, 9], [6, 0, 0, 9]],
  Y: [[0, 0, 3, 4.5, 6, 0], [3, 4.5, 3, 9]],
  Z: [[0, 0, 6, 0, 0, 9, 6, 9]],
  a: [[5.5, 3, 5.5, 9], [5.5, 5, 4, 3, 2, 3, 0.5, 4.5, 0, 6.5, 1, 8.5, 3, 9, 5, 8.5, 5.5, 7]],
  b: [[0, 0, 0, 9], [0, 5.5, 1.5, 3.5, 3.5, 3.5, 5, 5, 5.5, 7, 4.5, 9, 2, 9, 0, 7.5]],
  c: [[5.5, 4.5, 4, 3, 2, 3, 0.5, 4.5, 0, 6.5, 0.5, 8.5, 2, 9, 4, 9, 5.5, 7.5]],
  d: [[5.5, 0, 5.5, 9], [5.5, 5.5, 4, 3.5, 2, 3.5, 0.5, 5, 0, 7, 1, 9, 3, 9, 5, 7.5]],
  e: [[5, 7, 4, 9, 2, 9, 0.5, 7.5, 0, 5.5, 1, 3.5, 3, 3, 4.5, 4, 5, 5.5, 5, 6.5, 0.5, 6.5]],
  f: [[4.5, 9, 4.5, 2, 3.5, 0.5, 2, 0.5, 1, 1.5], [1.5, 4, 5, 4]],
  g: [[5.5, 3.5, 5.5, 9, 4, 12, 2, 12, 0.5, 10.5], [5.5, 5.5, 4, 3.5, 2, 3.5, 0.5, 5, 0, 7, 1, 9, 3, 9, 5, 7.5]],
  h: [[0, 0, 0, 9], [0, 6, 1.5, 3.5, 3.5, 3.5, 5, 5, 5.5, 7, 5.5, 9]],
  i: [[3, 3, 3, 9], [2.7, 0.8, 3.3, 0.8]],
  j: [[3.5, 3, 3.5, 9, 2.5, 12, 1, 12], [3.2, 0.8, 3.8, 0.8]],
  k: [[0, 0, 0, 9], [5.5, 3, 0.8, 6.5, 5.5, 9]],
  l: [[3, 0, 3, 9]],
  m: [[0, 3, 0, 9], [0, 5.5, 1.5, 3.5, 3, 3.5, 3.8, 5, 3.8, 9], [3.8, 5, 5, 3.5, 5.8, 4, 5.8, 9]],
  n: [[0, 3, 0, 9], [0, 6, 1.5, 3.5, 3.5, 3.5, 5, 5, 5.5, 7, 5.5, 9]],
  o: [[3, 3, 5, 4, 5.5, 6, 5, 8, 3, 9, 1, 8, 0, 6, 1, 4, 3, 3]],
  p: [[0, 3, 0, 12], [0, 6, 1.5, 3.5, 3.5, 3.5, 5, 5, 5.5, 7, 4.5, 9, 2, 9, 0, 7.5]],
  q: [[5.5, 3, 5.5, 12], [5.5, 6, 4, 3.5, 2, 3.5, 0.5, 5, 0, 7, 1, 9, 3, 9, 5, 7.5]],
  r: [[0, 3, 0, 9], [0, 6, 1.5, 3.5, 3, 3.5, 4.5, 4.5, 5, 6]],
  s: [[5, 4, 4, 3, 2, 3, 0.5, 4, 0, 5.5, 1, 6.5, 3, 6.5, 5, 6.5, 5.5, 8, 4.5, 9, 2, 9, 0.5, 8]],
  t: [[3, 0, 3, 9], [1, 4, 5, 4], [3, 9, 4.5, 9]],
  u: [[0, 3, 0, 7, 1, 9, 3, 9, 5, 9, 5.5, 7, 5.5, 3]],
  v: [[0, 3, 2.75, 9, 5.5, 3]],
  w: [[0, 3, 1.5, 9, 3, 5, 4.5, 9, 6, 3]],
  x: [[0, 3, 5.5, 9], [5.5, 3, 0, 9]],
  y: [[0, 3, 2.75, 9, 5.5, 3], [3.5, 7.5, 2.5, 12, 0.5, 12]],
  z: [[0, 3, 5.5, 3, 0, 9, 5.5, 9]],
  '0': [[3, 0, 5, 1, 6, 3, 6, 6, 5, 8, 3, 9, 1, 8, 0, 6, 0, 3, 1, 1, 3, 0]],
  '1': [[2, 1, 3, 0, 3, 9], [1, 9, 5, 9]],
  '2': [[0.5, 2, 2, 0, 4, 0, 5.5, 1.5, 5.5, 3, 3, 6, 0, 9, 5.5, 9]],
  '3': [[0.5, 1.5, 2, 0, 4, 0, 5, 1, 5.5, 2.5, 4.5, 4.5, 2.5, 4.5], [4.5, 4.5, 5.5, 6, 5, 8, 4, 9, 2, 9, 0.5, 7.5]],
  '4': [[4.5, 0, 0.5, 6.5, 4, 6.5], [4, 0, 4, 9]],
  '5': [[5, 0, 0.5, 0, 0.5, 4, 3, 4, 5, 5.5, 5, 7.5, 3.5, 9, 1.5, 9, 0.5, 8]],
  '6': [[5, 1.5, 4, 0, 2, 0, 0.5, 2, 0, 5, 0.5, 8, 2, 9, 4, 9, 5.5, 7, 5.5, 5, 4, 3.5, 2, 3.5, 0.5, 5]],
  '7': [[0, 0, 5.5, 0, 3, 9]],
  '8': [[3, 0, 4.5, 1, 5, 2.5, 4, 4.5, 2, 4.5, 1, 2.5, 1.5, 1, 3, 0], [2, 4.5, 4, 4.5, 5.5, 6, 5, 8, 3.5, 9, 1.5, 9, 0.5, 7.5, 1, 5.5, 2, 4.5]],
  '9': [[0.5, 7.5, 0, 5, 0.5, 3.5, 2, 3, 4, 3, 5.5, 4.5, 5.5, 7, 4, 9, 2, 9, 1, 8], [5.5, 4.5, 5.5, 1.5, 4, 0, 2, 0, 0.5, 1.5]],
  '.': [[2.7, 8.7, 3.3, 8.7]],
  ',': [[3, 9, 2, 11]],
  ':': [[2.7, 3, 3.3, 3], [2.7, 8, 3.3, 8]],
  ';': [[2.7, 3, 3.3, 3], [3, 8.5, 2, 11]],
  "'": [[3.2, 0, 2.2, 2.5]],
  '"': [[2, 0, 1.5, 2], [4.5, 0, 4, 2]],
  '!': [[3, 0, 3, 6.5], [2.7, 8.5, 3.3, 8.5]],
  '?': [[1, 2, 2, 0, 4, 0, 5, 1.5, 5, 3, 3.5, 4.5, 3, 6], [2.7, 8.5, 3.3, 8.5]],
  '(': [[4.5, 0, 2.5, 2, 1.5, 4.5, 2.5, 7, 4.5, 9]],
  ')': [[1.5, 0, 3.5, 2, 4.5, 4.5, 3.5, 7, 1.5, 9]],
  '-': [[0.5, 5, 5.5, 5]],
  '/': [[5, 0, 1, 9]],
  '%': [[5, 0, 1, 9], [1.5, 0.8, 2.5, 0.8, 2.5, 2.8, 1.5, 2.8, 1.5, 0.8], [3.5, 6.2, 4.5, 6.2, 4.5, 8.2, 3.5, 8.2, 3.5, 6.2]],
  '$': [[3, 0, 3, 9], [5, 1.5, 4, 0.5, 2, 0.5, 0.5, 2, 0.5, 3.5, 2, 4.5, 4, 4.5, 5.5, 5.5, 5.5, 7, 4, 9, 2, 9, 0.5, 8]],
  '+': [[3, 2, 3, 8], [0.5, 5, 5.5, 5]],
  '=': [[0.5, 3.5, 5.5, 3.5], [0.5, 6.5, 5.5, 6.5]],
  '|': [[3, 0, 3, 9]],
  '<': [[5, 1, 1, 4.5, 5, 8]],
  '>': [[1, 1, 5, 4.5, 1, 8]],
  '~': [[0.5, 5, 2, 3.5, 4, 6.5, 5.5, 5]],
};
const NARROW = new Set(['i', 'l', 'j', '.', ',', ':', ';', "'", '!', '|', '/', '1', 'f', 't']);
const WIDE = new Set(['M', 'W', 'm', 'w', '%']);
function charAdvance(ch: string): number {
  if (ch === ' ') return 3.8;
  if (NARROW.has(ch)) return 4.4;
  if (WIDE.has(ch)) return 8.2;
  return 7.2;
}
// size = cap height in px. Returns width in px.
function textWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) w += charAdvance(ch);
  return w * size / 9;
}
function drawText(cv: Canvas, s: string, x: number, yTop: number, size: number, color: RGB, weight = 1): void {
  const sc = size / 9;
  const wd = Math.max(1, size / 13) * weight;
  let cx = x;
  for (const ch of s) {
    if (ch !== ' ') {
      const g = FONT[ch];
      // Narrow glyphs are centred in their cell; shift them left so the
      // visual gap before them matches the gap after them.
      const off = NARROW.has(ch) ? -1.4 : 0;
      if (g) for (const st of g) {
        const pts: number[] = [];
        for (let i = 0; i < st.length; i += 2) pts.push(cx + (st[i] + off) * sc, yTop + st[i + 1] * sc);
        cv.polyline(pts, wd, color);
      }
    }
    cx += charAdvance(ch) * sc;
  }
}
// Greedy word wrap; returns lines that fit maxW.
function wrapText(s: string, size: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, size) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawTextBlock(cv: Canvas, s: string, x: number, yTop: number, size: number, color: RGB, maxW: number, lh: number, maxLines = 99, weight = 1): number {
  const lines = wrapText(s, size, maxW).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(cv, ln, x, yTop + i * lh, size, color, weight));
  return yTop + lines.length * lh;
}
function centerText(cv: Canvas, s: string, cx: number, yTop: number, size: number, color: RGB, weight = 1): void {
  drawText(cv, s, cx - textWidth(s, size) / 2, yTop, size, color, weight);
}

// ------------------------------------------------------------------ data
// Every story was checked against at least two published sources dated
// 22 November 2026 (or still developing that day). Sources are named in
// SOURCES.md; each story carries its outlets in parentheses on the page.
type Story = {
  n: number; region: string; kicker: string; loc: string;
  head: string; sum: string; src: string; x: number; y: number; // map pin lon/lat
};
const HEROES: Story[] = [
  { n: 1, region: 'AMERICAS', kicker: 'JUSTICE - CARTEL ARREST', loc: 'GUASAVE, MEXICO',
    head: "Troops seize 'El Chapo Isidro' in Sinaloa raid",
    sum: "Special forces captured FBI most-wanted boss Fausto Isidro Meza Flores in Guasave. Four soldiers and seven gunmen died.",
    src: '(Reuters, Al Jazeera)', x: -108.5, y: 25.6 },
  { n: 2, region: 'MIDDLE EAST', kicker: 'CONFLICT - THE GULF', loc: 'MANAMA, BAHRAIN',
    head: 'Iran strikes Bahrain; tankers hit near Hormuz',
    sum: "Bahrain said Iran hit a civilian industrial site late Saturday, hurting no one. Iran's Guards said they struck two US bases.",
    src: '(Times of Israel, Al Jazeera)', x: 50.6, y: 26.2 },
  { n: 3, region: 'EUROPE', kicker: 'CLIMATE - COP31', loc: 'ANTALYA, TURKEY',
    head: 'COP31 final deal has no mention of fossil fuels',
    sum: "Presidents Kurum and Bowen tabled a 10-page text that never names fossil fuels, oil, coal or a phase-out. Objections due 03:00 GMT.",
    src: '(Reuters, AP)', x: 30.7, y: 36.9 },
];
const GRID: Story[] = [
  { n: 4, region: 'EUROPE', kicker: 'WAR - UKRAINE', loc: 'KRYVYI RIH, UKRAINE',
    head: "Missile hits Zelenskyy's hometown",
    sum: "Two killed in Kryvyi Rih; a Russian ship burns in the Baltic.",
    src: '(BBC)', x: 33.4, y: 47.9 },
  { n: 5, region: 'AMERICAS', kicker: 'MARKETS', loc: 'NEW YORK, USA',
    head: 'AI sell-off drags stocks down',
    sum: "Dow and S&P 500 enter correction; Nvidia faces an SEC inquiry.",
    src: '(CNBC)', x: -74, y: 40.7 },
  { n: 6, region: 'ASIA-PACIFIC', kicker: 'TRADE', loc: 'BRUSSELS, BELGIUM',
    head: 'EU, Indonesia sign trade deal',
    sum: "Ten years of talks end; tariffs fall on 98.5% of EU goods.",
    src: '(Reuters)', x: 4.35, y: 50.85 },
  { n: 7, region: 'AFRICA', kicker: 'DISASTER', loc: 'BAYELSA, NIGERIA',
    head: 'Funeral boat capsizes; 24 dead',
    sum: "Mourners' boat overturns in Bayelsa; 24 rescued, driver flees.",
    src: '(AJ)', x: 6.0, y: 4.9 },
  { n: 8, region: 'AMERICAS', kicker: 'HEALTH - POLITICS', loc: 'BRASILIA, BRAZIL',
    head: 'Bolsonaro in intensive care',
    sum: "Ex-president stable with bowel obstruction; surgery weighed.",
    src: '(AJ)', x: -47.9, y: -15.8 },
  { n: 9, region: 'AMERICAS', kicker: 'TECH - SECURITY', loc: 'WASHINGTON, USA',
    head: 'FBI crime database hacked',
    sum: "Police data at risk in a second major breach in two months.",
    src: '(BBC)', x: -77, y: 38.9 },
  { n: 10, region: 'EUROPE', kicker: 'ESPIONAGE', loc: 'COPENHAGEN, DENMARK',
    head: 'Denmark expels Russian attache',
    sum: "Denmark says Russia plotted to kill rapper Kyivstoner.",
    src: '(BBC)', x: 12.6, y: 55.7 },
  { n: 11, region: 'WORLD', kicker: 'SPACE', loc: 'MERCURY ORBIT',
    head: 'BepiColombo reaches Mercury',
    sum: "Eight-year cruise ends; ESA confirms orbit, probes split soon.",
    src: '(AP)', x: 8.6, y: 49.9 },
  { n: 12, region: 'MIDDLE EAST', kicker: 'CONFLICT - THE GULF', loc: 'RIYADH, SAUDI ARABIA',
    head: 'Saudi stops three Houthi missiles',
    sum: "Defences halt missiles aimed at Riyadh; Hodeidah also hit.",
    src: '(AJ)', x: 46.7, y: 24.7 },
  { n: 13, region: 'MIDDLE EAST', kicker: 'ENVIRONMENT', loc: 'STRAIT OF HORMUZ',
    head: 'Swimmer crosses Hormuz for sea life',
    sum: "Lewis Pugh's 15-km swim flags war damage to marine life.",
    src: '(BBC)', x: 56.3, y: 26.6 },
];
const ALSO: { n: number; region: string; line: string }[] = [
  { n: 14, region: 'MIDDLE EAST', line: 'Gaza strikes continue; 4 killed (AJ)' },
  { n: 15, region: 'MIDDLE EAST', line: 'Likud invited to coalition talks (ST)' },
  { n: 16, region: 'MIDDLE EAST', line: 'West Bank settler attacks rise (CBC)' },
  { n: 17, region: 'MIDDLE EAST', line: 'Iran starts electricity rationing (ST)' },
  { n: 18, region: 'EUROPE', line: 'Cost protests in France, Portugal (F24)' },
  { n: 19, region: 'EUROPE', line: 'UK-EU strike trade, youth deals (Gdn)' },
  { n: 20, region: 'EUROPE', line: 'EU plans Rwanda hubs, digital tax (EP)' },
  { n: 21, region: 'WORLD', line: 'UN AI weapons talks end; no rules (NPR)' },
  { n: 22, region: 'AMERICAS', line: 'Palisades fire arsonist convicted (BBC)' },
  { n: 23, region: 'AFRICA', line: 'UN Women ex-chief dies at 71 (AN)' },
  { n: 24, region: 'ASIA-PACIFIC', line: 'Bangladesh garment strikes grow (DT)' },
  { n: 25, region: 'ASIA-PACIFIC', line: 'Saudi triples oil stored in Japan (JT)' },
  { n: 26, region: 'AMERICAS', line: 'Argentina approves $50bn LNG plan (BAT)' },
  { n: 27, region: 'AMERICAS', line: 'Trump curbs Congress oversight (Gdn)' },
  { n: 28, region: 'MIDDLE EAST', line: "Lebanon's Aoun blames Israel, Iran (AJ)" },
  { n: 29, region: 'EUROPE', line: 'Turkey seizes last independent TV (RFI)' },
  { n: 30, region: 'ASIA-PACIFIC', line: 'Indonesia factory fire: 3 dead (Hindu)' },
  { n: 31, region: 'ASIA-PACIFIC', line: 'Manipur fake liquor kills 11 (Yonhap)' },
  { n: 32, region: 'ASIA-PACIFIC', line: 'S Korea minister quits in AI row (YH)' },
  { n: 33, region: 'EUROPE', line: 'Belgian air strike to ground flights (ST)' },
  { n: 34, region: 'MIDDLE EAST', line: 'Basra power station fire kills 4 (Rtrs)' },
  { n: 35, region: 'ASIA-PACIFIC', line: 'Hong Kong election vote held (SCMP)' },
  { n: 36, region: 'ASIA-PACIFIC', line: 'BTS win five MAMA awards in Osaka (YH)' },
];
const STATS: { big: string; cap: string }[] = [
  { big: '11', cap: 'KILLED IN THE SINALOA RAID' },
  { big: '24', cap: 'DEAD IN THE NIGERIA BOAT' },
  { big: '~200', cap: 'NATIONS AT COP31' },
  { big: '$50BN', cap: 'ARGENTINA LNG DEAL' },
  { big: '3', cap: 'MISSILES AT RIYADH' },
  { big: '39', cap: 'MISSING IN FACTORY FIRE' },
];
const REGIONS: { name: string; count: number; color: RGB }[] = [
  { name: 'EUROPE', count: 8, color: NAVY },
  { name: 'MIDDLE EAST', count: 9, color: RED },
  { name: 'AMERICAS', count: 7, color: TEAL },
  { name: 'ASIA-PACIFIC', count: 8, color: GOLD },
  { name: 'AFRICA', count: 2, color: GREEN },
  { name: 'WORLD', count: 2, color: GREY },
];

// ------------------------------------------------------------ illustrations
// All drawings are original flat illustrations made by this program.
function nightSky(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, SKYNIGHT);
  const stars: [number, number][] = [[0.08, 0.2], [0.2, 0.1], [0.35, 0.25], [0.5, 0.12], [0.66, 0.22], [0.8, 0.1], [0.92, 0.3], [0.45, 0.32], [0.12, 0.45]];
  for (const [sx, sy] of stars) cv.disc(x + sx * w, y + sy * h, 1.4, WHITE);
}
function flame(cv: Canvas, x: number, y: number, s: number): void {
  cv.poly([x, y, x + s * 0.35, y - s * 0.7, x + s * 0.55, y - s * 0.35, x + s * 0.8, y - s * 0.9, x + s, y], [255, 140, 0]);
  cv.poly([x + s * 0.25, y, x + s * 0.45, y - s * 0.45, x + s * 0.75, y], [255, 210, 0]);
}
function smoke(cv: Canvas, x: number, y: number, s: number, c: RGB): void {
  cv.disc(x, y, s * 0.5, c); cv.disc(x + s * 0.4, y - s * 0.35, s * 0.42, c); cv.disc(x + s * 0.8, y - s * 0.7, s * 0.36, c);
}
function hero1(cv: Canvas, x: number, y: number, w: number, h: number): void {
  nightSky(cv, x, y, w, h);
  cv.disc(x + w * 0.82, y + h * 0.2, 11, [240, 230, 200]);
  cv.poly([x, y + h * 0.62, x + w * 0.3, y + h * 0.35, x + w * 0.55, y + h * 0.62], [52, 66, 96]);
  cv.poly([x + w * 0.55, y + h * 0.62, x + w * 0.8, y + h * 0.42, x + w, y + h * 0.62], [52, 66, 96]);
  cv.rect(x, y + h * 0.62, w, h * 0.38, [24, 26, 34]);
  // houses with lit windows
  cv.rect(x + w * 0.05, y + h * 0.5, w * 0.2, h * 0.16, [120, 90, 60]);
  cv.rect(x + w * 0.09, y + h * 0.54, 6, 6, [255, 210, 90]); cv.rect(x + w * 0.17, y + h * 0.54, 6, 6, [255, 210, 90]);
  cv.rect(x + w * 0.68, y + h * 0.48, w * 0.22, h * 0.18, [110, 80, 55]);
  cv.rect(x + w * 0.73, y + h * 0.52, 6, 6, [255, 210, 90]); cv.rect(x + w * 0.82, y + h * 0.52, 6, 6, [255, 210, 90]);
  // helicopter with searchlight
  cv.ellipse(x + w * 0.45, y + h * 0.16, 14, 7, [30, 30, 30]);
  cv.line(x + w * 0.45 - 18, y + h * 0.16, x + w * 0.45 + 18, y + h * 0.16, 2, [30, 30, 30]);
  cv.line(x + w * 0.45 + 12, y + h * 0.16, x + w * 0.45 + 26, y + h * 0.13, 2, [30, 30, 30]);
  cv.poly([x + w * 0.455, y + h * 0.18, x + w * 0.485, y + h * 0.18, x + w * 0.53, y + h * 0.6, x + w * 0.4, y + h * 0.6], [255, 240, 150]);
  // burning truck + roadblock
  cv.rect(x + w * 0.3, y + h * 0.72, w * 0.16, h * 0.1, [90, 30, 25]);
  flame(cv, x + w * 0.32, y + h * 0.72, 16);
  smoke(cv, x + w * 0.36, y + h * 0.5, 14, [90, 90, 95]);
  cv.rect(x + w * 0.55, y + h * 0.78, w * 0.3, 4, [255, 255, 255]);
  cv.rect(x + w * 0.55, y + h * 0.78, w * 0.06, 4, RED); cv.rect(x + w * 0.67, y + h * 0.78, w * 0.06, 4, RED); cv.rect(x + w * 0.79, y + h * 0.78, w * 0.06, 4, RED);
  // soldiers
  for (const sx of [0.14, 0.2, 0.9]) {
    cv.disc(x + w * sx, y + h * 0.68, 3, [40, 60, 40]);
    cv.rect(x + w * sx - 2, y + h * 0.68, 4, 10, [40, 60, 40]);
  }
}
function hero2(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [214, 164, 110]);
  cv.disc(x + w * 0.78, y + h * 0.22, 13, [255, 220, 140]);
  cv.rect(x, y + h * 0.55, w, h * 0.45, [36, 68, 96]);
  // tanker
  cv.rect(x + w * 0.55, y + h * 0.62, w * 0.38, h * 0.12, [120, 30, 25]);
  cv.rect(x + w * 0.88, y + h * 0.52, w * 0.05, h * 0.1, [200, 200, 200]);
  cv.rect(x + w * 0.58, y + h * 0.66, 8, 5, [255, 210, 90]); cv.rect(x + w * 0.68, y + h * 0.66, 8, 5, [255, 210, 90]);
  cv.line(x + w * 0.55, y + h * 0.76, x + w * 0.93, y + h * 0.76, 2, [255, 255, 255]);
  // industrial plant
  cv.rect(x + w * 0.04, y + h * 0.42, w * 0.1, h * 0.2, [70, 70, 75]);
  cv.rect(x + w * 0.16, y + h * 0.34, w * 0.08, h * 0.28, [85, 85, 90]);
  cv.rect(x + w * 0.26, y + h * 0.46, w * 0.14, h * 0.16, [70, 70, 75]);
  cv.rect(x + w * 0.07, y + h * 0.47, 5, 5, [255, 210, 90]); cv.rect(x + w * 0.19, y + h * 0.4, 5, 5, [255, 210, 90]);
  flame(cv, x + w * 0.27, y + h * 0.46, 22);
  flame(cv, x + w * 0.17, y + h * 0.34, 14);
  smoke(cv, x + w * 0.3, y + h * 0.28, 16, [60, 60, 65]);
  // missile arcs
  for (const [ax, ay] of [[0.42, 0.1], [0.55, 0.05]]) {
    cv.poly([x + w * ax, y + h * 0.05, x + w * (ax + 0.06), y + h * 0.22, x + w * (ax + 0.02), y + h * 0.45], RED);
  }
  cv.disc(x + w * 0.44, y + h * 0.45, 3, RED); cv.disc(x + w * 0.57, y + h * 0.45, 3, RED);
  // radar dish
  cv.line(x + w * 0.46, y + h * 0.62, x + w * 0.46, y + h * 0.5, 2, [200, 200, 200]);
  cv.poly([x + w * 0.42, y + h * 0.52, x + w * 0.46, y + h * 0.46, x + w * 0.5, y + h * 0.52], [220, 220, 220]);
}
function hero3(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [232, 222, 198]);
  // hall + flags
  cv.rect(x, y, w, h * 0.3, [70, 90, 120]);
  const flagCols: RGB[] = [RED, NAVY, TEAL, GOLD, GREEN, [120, 60, 140]];
  flagCols.forEach((c, i) => {
    const fx = x + w * (0.06 + i * 0.16);
    cv.line(fx, y + h * 0.04, fx, y + h * 0.28, 2, [200, 200, 200]);
    cv.rect(fx, y + h * 0.04, w * 0.11, h * 0.1, c);
  });
  // long table with delegates
  cv.rect(x + w * 0.05, y + h * 0.58, w * 0.9, h * 0.14, [120, 80, 50]);
  for (let i = 0; i < 6; i++) {
    const dx = x + w * (0.1 + i * 0.15);
    cv.disc(dx, y + h * 0.5, 6, [200, 170, 130]);
    cv.rect(dx - 7, y + h * 0.52, 14, 8, NAVY);
    cv.rect(dx - 5, y + h * 0.6, 10, 5, WHITE);
  }
  // big overtime clock
  cv.disc(x + w * 0.82, y + h * 0.42, 26, WHITE);
  cv.ring(x + w * 0.82, y + h * 0.42, 26, 3, RED);
  cv.line(x + w * 0.82, y + h * 0.42, x + w * 0.82, y + h * 0.42 - 16, 3, INK);
  cv.line(x + w * 0.82, y + h * 0.42, x + w * 0.82 + 12, y + h * 0.42 + 6, 3, INK);
  drawText(cv, 'DAY 2', x + w * 0.82 - textWidth('DAY 2', 8) / 2, y + h * 0.42 + 8, 8, RED, 1.4);
  // draft document with struck-through words
  cv.rect(x + w * 0.08, y + h * 0.76, w * 0.42, h * 0.2, WHITE);
  cv.rect(x + w * 0.1, y + h * 0.79, w * 0.36, 2, INK);
  cv.rect(x + w * 0.1, y + h * 0.83, w * 0.3, 2, INK);
  cv.rect(x + w * 0.1, y + h * 0.87, w * 0.36, 2, INK);
  cv.line(x + w * 0.1, y + h * 0.83, x + w * 0.4, y + h * 0.83, 2, RED);
  cv.line(x + w * 0.1, y + h * 0.87, x + w * 0.46, y + h * 0.87, 2, RED);
  // globe
  cv.disc(x + w * 0.62, y + h * 0.86, 14, TEAL);
  cv.poly([x + w * 0.58, y + h * 0.8, x + w * 0.62, y + h * 0.84, x + w * 0.66, y + h * 0.8, x + w * 0.64, y + h * 0.9, x + w * 0.6, y + h * 0.92], GREEN);
}
// ---- small grid illustrations (each ~w x h, flat, original)
function g4(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [58, 74, 110]);
  cv.rect(x, y + h * 0.55, w, h * 0.45, [30, 40, 60]);
  for (let i = 0; i < 5; i++) cv.rect(x + w * (0.04 + i * 0.19), y + h * (0.3 + (i % 2) * 0.12), w * 0.13, h * 0.4, [90, 100, 130]);
  cv.rect(x + w * 0.08, y + h * 0.38, 4, 4, [255, 210, 90]); cv.rect(x + w * 0.45, y + h * 0.34, 4, 4, [255, 210, 90]);
  cv.poly([x + w * 0.1, y + h * 0.1, x + w * 0.5, y + h * 0.35, x + w * 0.75, y + h * 0.3], RED);
  cv.disc(x + w * 0.75, y + h * 0.3, 3, [255, 160, 0]);
  cv.rect(x + w * 0.6, y + h * 0.66, w * 0.3, h * 0.12, [140, 40, 30]);
  flame(cv, x + w * 0.62, y + h * 0.66, 10);
}
function g5(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [240, 238, 228]);
  const bars = [0.7, 0.62, 0.66, 0.45, 0.5, 0.28];
  bars.forEach((b, i) => cv.rect(x + w * (0.08 + i * 0.15), y + h * (0.9 - b), w * 0.1, h * b, i < 3 ? TEAL : RED));
  cv.poly([x + w * 0.06, y + h * 0.25, x + w * 0.5, y + h * 0.42, x + w * 0.9, y + h * 0.68], RED);
  cv.poly([x + w * 0.9, y + h * 0.68, x + w * 0.82, y + h * 0.68, x + w * 0.9, y + h * 0.78], RED);
}
function g6(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, SKY);
  cv.rect(x, y + h * 0.6, w, h * 0.4, [70, 90, 110]);
  cv.rect(x + w * 0.08, y + h * 0.62, w * 0.24, h * 0.2, [200, 60, 50]);
  cv.rect(x + w * 0.36, y + h * 0.62, w * 0.24, h * 0.2, [40, 90, 160]);
  cv.rect(x + w * 0.64, y + h * 0.62, w * 0.24, h * 0.2, [220, 180, 40]);
  cv.line(x + w * 0.2, y + h * 0.1, x + w * 0.2, y + h * 0.6, 2, INK);
  cv.rect(x + w * 0.2, y + h * 0.1, w * 0.26, h * 0.22, NAVY);
  for (let i = 0; i < 5; i++) cv.disc(x + w * (0.24 + i * 0.04), y + h * 0.21, 1.2, [255, 220, 0]);
  cv.line(x + w * 0.62, y + h * 0.1, x + w * 0.62, y + h * 0.6, 2, INK);
  cv.rect(x + w * 0.62, y + h * 0.1, w * 0.26, h * 0.11, RED);
  cv.rect(x + w * 0.62, y + h * 0.21, w * 0.26, h * 0.11, WHITE);
}
function g7(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [120, 170, 200]);
  cv.rect(x, y + h * 0.55, w, h * 0.45, [30, 80, 130]);
  cv.poly([x + w * 0.2, y + h * 0.55, x + w * 0.8, y + h * 0.55, x + w * 0.7, y + h * 0.38, x + w * 0.3, y + h * 0.38], [120, 70, 40]);
  cv.rect(x + w * 0.3, y + h * 0.38, w * 0.4, 3, [200, 200, 200]);
  cv.line(x + w * 0.1, y + h * 0.62, x + w * 0.9, y + h * 0.62, 2, WHITE);
  cv.line(x + w * 0.15, y + h * 0.75, x + w * 0.85, y + h * 0.75, 2, WHITE);
  cv.ring(x + w * 0.85, y + h * 0.3, 8, 3, [255, 120, 0]);
}
function g8(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [235, 240, 235]);
  cv.rect(x + w * 0.1, y + h * 0.5, w * 0.7, h * 0.22, [70, 120, 160]);
  cv.rect(x + w * 0.12, y + h * 0.38, w * 0.2, h * 0.14, [200, 220, 230]);
  cv.disc(x + w * 0.22, y + h * 0.42, 4, [220, 190, 150]);
  cv.rect(x + w * 0.82, y + h * 0.12, w * 0.12, h * 0.3, WHITE);
  cv.rect(x + w * 0.85, y + h * 0.16, w * 0.06, h * 0.22, RED);
  cv.rect(x + w * 0.82, y + h * 0.2, w * 0.12, h * 0.06, RED);
  cv.line(x + w * 0.1, y + h * 0.72, x + w * 0.8, y + h * 0.72, 2, [150, 150, 150]);
}
function g9(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [40, 45, 60]);
  for (let i = 0; i < 3; i++) {
    cv.rect(x + w * (0.1 + i * 0.28), y + h * 0.15, w * 0.2, h * 0.7, [90, 100, 120]);
    cv.rect(x + w * (0.13 + i * 0.28), y + h * 0.22, w * 0.14, 3, [120, 220, 120]);
    cv.rect(x + w * (0.13 + i * 0.28), y + h * 0.35, w * 0.14, 3, [120, 220, 120]);
  }
  cv.poly([x + w * 0.62, y + h * 0.2, x + w * 0.82, y + h * 0.55, x + w * 0.42, y + h * 0.55], [255, 200, 0]);
  drawText(cv, '!', x + w * 0.6, y + h * 0.3, 14, INK, 1.6);
}
function g10(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, SKY);
  cv.rect(x + w * 0.15, y + h * 0.3, w * 0.7, h * 0.5, [200, 190, 170]);
  cv.rect(x + w * 0.15, y + h * 0.3, w * 0.7, h * 0.08, [150, 40, 35]);
  for (let i = 0; i < 4; i++) cv.rect(x + w * (0.2 + i * 0.16), y + h * 0.45, w * 0.09, h * 0.16, [60, 80, 110]);
  cv.line(x + w * 0.5, y + h * 0.08, x + w * 0.5, y + h * 0.3, 2, INK);
  cv.rect(x + w * 0.5, y + h * 0.08, w * 0.24, h * 0.14, RED);
  cv.rect(x + w * 0.5, y + h * 0.15, w * 0.24, h * 0.07, WHITE);
  cv.line(x + w * 0.72, y + h * 0.55, x + w * 0.9, y + h * 0.8, 3, RED);
  cv.line(x + w * 0.9, y + h * 0.55, x + w * 0.72, y + h * 0.8, 3, RED);
}
function g11(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [12, 14, 26]);
  for (const [sx, sy] of [[0.1, 0.15], [0.3, 0.1], [0.85, 0.2], [0.7, 0.12], [0.2, 0.85]]) cv.disc(x + sx * w, y + sy * h, 1.2, WHITE);
  cv.disc(x + w * 0.32, y + h * 0.5, 17, [150, 145, 135]);
  cv.disc(x + w * 0.28, y + h * 0.42, 3, [110, 105, 95]); cv.disc(x + w * 0.38, y + h * 0.58, 4, [110, 105, 95]); cv.disc(x + w * 0.3, y + h * 0.62, 2, [110, 105, 95]);
  cv.rect(x + w * 0.62, y + h * 0.44, w * 0.12, h * 0.12, [200, 200, 210]);
  cv.rect(x + w * 0.56, y + h * 0.47, w * 0.06, h * 0.06, [40, 90, 160]);
  cv.rect(x + w * 0.74, y + h * 0.47, w * 0.06, h * 0.06, [40, 90, 160]);
  cv.line(x + w * 0.62, y + h * 0.5, x + w * 0.74, y + h * 0.5, 2, [200, 200, 210]);
}
function g12(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [214, 178, 130]);
  cv.rect(x, y + h * 0.7, w, h * 0.3, [120, 100, 70]);
  cv.poly([x + w * 0.15, y + h * 0.7, x + w * 0.2, y + h * 0.45, x + w * 0.28, y + h * 0.7], [180, 160, 120]);
  cv.poly([x + w * 0.7, y + h * 0.7, x + w * 0.75, y + h * 0.5, x + w * 0.82, y + h * 0.7], [180, 160, 120]);
  for (const [mx, my] of [[0.3, 0.25], [0.55, 0.18], [0.8, 0.28]]) {
    cv.line(x + w * mx, y + h * my, x + w * (mx - 0.08), y + h * (my + 0.3), 2, RED);
    cv.disc(x + w * (mx - 0.08), y + h * (my + 0.3), 4, [255, 160, 0]);
    cv.disc(x + w * (mx - 0.08), y + h * (my + 0.3), 7, [255, 200, 80]);
  }
}
function g13(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [150, 200, 225]);
  cv.disc(x + w * 0.8, y + h * 0.2, 10, [255, 210, 90]);
  cv.rect(x, y + h * 0.55, w, h * 0.45, [30, 90, 140]);
  cv.line(x + w * 0.05, y + h * 0.6, x + w * 0.95, y + h * 0.6, 2, WHITE);
  cv.line(x + w * 0.05, y + h * 0.75, x + w * 0.95, y + h * 0.75, 2, WHITE);
  cv.disc(x + w * 0.4, y + h * 0.5, 6, [220, 190, 150]);
  cv.rect(x + w * 0.36, y + h * 0.52, 8, 10, [20, 60, 110]);
  cv.line(x + w * 0.42, y + h * 0.45, x + w * 0.55, y + h * 0.3, 3, [220, 190, 150]);
  cv.disc(x + w * 0.56, y + h * 0.29, 3, [220, 190, 150]);
}
const GRID_ART: Record<number, (cv: Canvas, x: number, y: number, w: number, h: number) => void> = {
  4: g4, 5: g5, 6: g6, 7: g7, 8: g8, 9: g9, 10: g10, 11: g11, 12: g12, 13: g13,
};
const HERO_ART: Record<number, (cv: Canvas, x: number, y: number, w: number, h: number) => void> = { 1: hero1, 2: hero2, 3: hero3 };
const HERO_CHIP: Record<number, string> = { 1: '11 KILLED', 2: '2 BASES', 3: '~200 NATIONS' };

// -------------------------------------------------------------------- map
const CONTINENTS: number[][][] = [
  [[-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-60, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-90, 21], [-97, 16], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-168, 66]],
  [[-80, 10], [-60, 8], [-50, 5], [-35, -8], [-40, -20], [-48, -28], [-58, -35], [-65, -45], [-70, -54], [-73, -40], [-70, -20], [-80, -5], [-80, 10]],
  [[-17, 15], [-10, 30], [0, 36], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [51, 11], [48, 0], [40, -15], [35, -28], [20, -35], [15, -28], [12, -18], [8, 4], [-8, 5], [-17, 15]],
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [25, 65], [20, 70], [15, 68], [10, 62], [5, 58], [-2, 50], [-5, 48], [-10, 43], [-10, 36]],
  [[30, 62], [40, 68], [60, 70], [80, 73], [100, 76], [120, 73], [140, 72], [160, 70], [178, 66], [170, 60], [158, 52], [142, 45], [135, 43], [127, 40], [122, 32], [120, 25], [110, 20], [105, 10], [100, 8], [95, 15], [90, 22], [85, 20], [80, 10], [75, 8], [70, 20], [65, 25], [60, 25], [55, 26], [50, 29], [45, 30], [40, 35], [35, 36], [30, 36], [28, 40], [30, 50], [30, 62]],
  [[113, -22], [114, -30], [120, -34], [130, -32], [140, -38], [147, -39], [150, -37], [153, -27], [146, -19], [142, -11], [136, -12], [130, -13], [122, -14], [114, -20], [113, -22]],
];
function drawMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [233, 226, 205]);
  const px = (lon: number): number => x + (lon + 180) / 360 * w;
  const py = (lat: number): number => y + (90 - lat) / 150 * h; // lat 90..-60
  for (const cont of CONTINENTS) {
    const pts: number[] = [];
    for (const [lon, lat] of cont) pts.push(px(lon), py(lat));
    cv.poly(pts, [214, 198, 160]);
  }
  const placed: [number, number][] = [];
  for (const s of [...HEROES, ...GRID]) {
    const tx = px(s.x), ty = py(s.y);
    let cx = tx, cy = ty;
    // Push apart pins that would overlap in the Europe / Gulf clusters,
    // keeping a thin leader line to the true spot.
    const shifts: [number, number][] = [[15, -13], [-15, -13], [15, 13], [-15, 13], [0, -18], [18, 0], [-18, 0], [0, 18]];
    for (const [dx, dy] of shifts) {
      if (placed.every(([ox, oy]) => Math.hypot(cx - ox, cy - oy) >= 17)) break;
      cx = tx + dx; cy = ty + dy;
    }
    placed.push([cx, cy]);
    if (Math.hypot(cx - tx, cy - ty) > 1) cv.line(tx, ty, cx, cy, 1.5, RED);
    cv.disc(cx, cy, 7, RED);
    cv.ring(cx, cy, 7, 1.5, WHITE);
    const label = String(s.n);
    drawText(cv, label, cx - textWidth(label, 8) / 2, cy - 4, 8, WHITE, 1.5);
  }
}

// ------------------------------------------------------------------ layout
const W = 1024, H = 1024, M = 24, CW = W - 2 * M;

function rule(cv: Canvas, y: number, wd = 1): void { cv.rect(M, y, CW, wd, INK); }
function numBadge(cv: Canvas, cx: number, cy: number, n: number, r = 8): void {
  cv.disc(cx, cy, r, RED);
  const label = String(n);
  drawText(cv, label, cx - textWidth(label, 8) / 2, cy - 4, 8, WHITE, 1.5);
}

function render(): Canvas {
  const cv = new Canvas(W, H, PAPER);
  // --- top strip
  drawText(cv, 'THE WORLD IN ONE DAY', M, 12, 11, INK, 1.5);
  const right = '36 STORIES - 6 REGIONS - EVERY ONE DATED SUNDAY 22 NOVEMBER 2026';
  drawText(cv, right, M + CW - textWidth(right, 10), 13, 10, INK, 1.2);
  cv.rect(M, 30, CW, 1, INK);
  // --- masthead
  centerText(cv, 'SUNDAY 22 NOVEMBER 2026', M + CW / 2, 36, 46, INK, 1.1);
  centerText(cv, 'CARTEL BOSS SEIZED IN SINALOA  -  IRAN STRIKES BAHRAIN  -  COP31 IN OVERTIME', M + CW / 2, 88, 13, RED, 1.2);
  cv.rect(M, 106, CW, 1, INK);
  // --- stat strip
  const cellW = CW / 6;
  STATS.forEach((s, i) => {
    const cx = M + i * cellW;
    centerText(cv, s.big, cx + cellW / 2, 112, 26, RED, 1.4);
    const capLines = wrapText(s.cap, 9, cellW - 10);
    capLines.forEach((ln, j) => centerText(cv, ln, cx + cellW / 2, 142 + j * 11, 9, INK, 1.1));
    if (i > 0) cv.rect(cx, 114, 1, 46, RULE);
  });
  // --- region bar
  let bx = M;
  const total = REGIONS.reduce((a, r) => a + r.count, 0);
  const widths = REGIONS.map((r) => Math.max(64, Math.round(r.count / total * CW)));
  const wsum = widths.reduce((a, b) => a + b, 0);
  const adj = Math.round((wsum - CW) / REGIONS.length);
  REGIONS.forEach((r, i) => {
    const wdt = widths[i] - adj;
    cv.rect(bx, 166, wdt, 20, r.color);
    centerText(cv, r.name + ' ' + r.count, bx + wdt / 2, 170, 9.5, WHITE, 1.3);
    bx += wdt;
  });
  // --- heroes
  const hw = (CW - 24) / 3, hy = 192, hh = 130;
  HEROES.forEach((s, i) => {
    const hx = M + i * (hw + 12);
    HERO_ART[s.n](cv, hx, hy, hw, hh);
    cv.rect(hx, hy, hw, 1, INK); cv.rect(hx, hy + hh - 1, hw, 1, INK);
    // stat chip top-right of the picture
    const chip = HERO_CHIP[s.n];
    const chw = textWidth(chip, 10) + 14;
    cv.rect(hx + hw - chw - 6, hy + 6, chw, 16, WHITE);
    drawText(cv, chip, hx + hw - chw + 1, hy + 9, 10, RED, 1.4);
    drawText(cv, s.n + ' ' + s.loc + ' - ' + s.kicker, hx, hy + hh + 8, 10, RED, 1.3);
    drawTextBlock(cv, s.head, hx, hy + hh + 24, 16.5, INK, hw, 20, 2, 1.3);
    drawTextBlock(cv, s.sum, hx, hy + hh + 66, 11.5, INK, hw, 13.5, 4);
    drawText(cv, s.src, hx, hy + hh + 122, 10, GREY, 1.1);
  });
  // --- grid 4-13 (5 x 2)
  const gw = (CW - 4 * 10) / 5, gh = 121, gy0 = 460;
  GRID.forEach((s, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const gx = M + col * (gw + 10), gy = gy0 + row * (gh + 4);
    GRID_ART[s.n](cv, gx, gy, gw, 36);
    numBadge(cv, gx + gw - 10, gy + 10, s.n);
    drawText(cv, s.loc + ' ' + s.src, gx, gy + 41, 8, RED, 1.2);
    drawTextBlock(cv, s.head, gx, gy + 52, 12, INK, gw, 13.5, 2, 1.3);
    drawTextBlock(cv, s.sum, gx, gy + 81, 9.5, INK, gw, 11, 3);
  });
  // --- map + also-on
  drawText(cv, 'WHERE IT HAPPENED - PINS MATCH STORY NUMBERS', M, 708, 10, INK, 1.4);
  drawText(cv, 'ALSO ON SUNDAY 22 NOVEMBER - 23 MORE STORIES', M + 420, 708, 11, INK, 1.4);
  drawMap(cv, M, 722, 396, 146);
  const ax = M + 420, aw = CW - 420;
  const colW = (aw - 14) / 2;
  ALSO.forEach((a, i) => {
    const col = i < 12 ? 0 : 1;
    const row = i < 12 ? i : i - 12;
    const lx = ax + col * (colW + 14), ly = 722 + row * 12.2;
    drawText(cv, a.n + ' ' + a.line, lx, ly, 9, INK, 1.1);
  });
  // --- date check
  cv.rect(M, 874, CW, 2, RED); cv.rect(M, 948, CW, 2, RED);
  cv.rect(M, 874, 2, 76, RED); cv.rect(M + CW - 2, 874, 2, 76, RED);
  drawText(cv, 'DATE CHECK', M + 8, 880, 12, RED, 1.5);
  const dc = 'Wires read up to 07:30 UTC, Sunday 22 November 2026. Every story here happened, was first reported, or was still developing on 22 November in at least one time zone. Left out as other days\' news: the ICJ genocide ruling (19 Nov), the Shenzhen summit (19 Nov), Kyiv\'s 400-drone barrage (20 Nov), Russian missiles in Poland (20 Nov), the Kerch Bridge strikes (17-18 Nov) and the Peru earthquake (20 Nov). Not yet decided when drawn: COP31 final adoption (06:00 GMT session) and the ATP final (Alcaraz-Zverev).';
  drawTextBlock(cv, dc, M + 8, 896, 10, INK, CW - 16, 12.5, 5);
  // --- footer
  const foot = 'Sources: Reuters, BBC, Al Jazeera, AP, DW, France 24, The Guardian, El Pais, Africanews, Dhaka Tribune, Japan Today, Buenos Aires Times, Yonhap, SCMP, CBC, NPR, RFI, CNBC, UPI, CBS, Nature, Middle East Eye. Short names in the list: AJ Al Jazeera, ST Straits Times, F24 France 24, Gdn Guardian, EP El Pais, AN Africanews, DT Dhaka Tribune, JT Japan Today, BAT Buenos Aires Times, YH Yonhap, Rtrs Reuters. Pictures and map: original, drawn in code.';
  drawTextBlock(cv, foot, M, 958, 8.5, GREY, CW, 11, 5);
  centerText(cv, 'THE WORLD IN ONE DAY  |  SUNDAY 22 NOVEMBER 2026  -  ONE PAGE', M + CW / 2, 1004, 10, INK, 1.4);
  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const cv = render();
  const png = encodePNG(W, H, cv.px);
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
