import type { LevelData, Point } from "./schema";

/**
 * Compact, self-contained share codes for player-made boards and rival runs.
 *
 * Everything is encoded into a URL-safe base64 string — no JSON, no server,
 * no database. A checksum rejects truncated or edited links, and decoders are
 * strict about bounds so a hostile link can never produce an absurd board.
 *
 * Layout: [version, gridSize, startX, startY, nodeBitmask..., payload..., crc16]
 * Board version = 1 (no payload). Rival version = 2 (path + time follow the mask).
 */

export const LAB_MIN_GRID = 3;
export const LAB_MAX_GRID = 9;
export const LAB_MIN_NODES = 4;

const BOARD_VERSION = 1;
const RIVAL_VERSION = 2;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export interface LabBoard {
  gridSize: number;
  start: Point;
  nodes: Point[];
}

export interface RivalRun {
  board: LabBoard;
  path: Point[];
  timeMs: number;
}

function toBase64Url(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[n & 63];
  }
  return out;
}

function fromBase64Url(code: string): number[] | null {
  if (!code || code.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < code.length; i += 4) {
    const chunk = code.slice(i, i + 4);
    const values = chunk.split("").map(char => ALPHABET.indexOf(char));
    if (values.some(value => value < 0)) return null;
    const n = ((values[0] ?? 0) << 18) | ((values[1] ?? 0) << 12) | ((values[2] ?? 0) << 6) | (values[3] ?? 0);
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return bytes;
}

function checksum(bytes: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) & 0xffff;
}

function withChecksum(bytes: number[]): string {
  const crc = checksum(bytes);
  return toBase64Url([...bytes, (crc >> 8) & 255, crc & 255]);
}

function stripChecksum(code: string): number[] | null {
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length < 4) return null;
  const payload = bytes.slice(0, -2);
  const expected = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
  return checksum(payload) === expected ? payload : null;
}

const bitmaskBytes = (gridSize: number) => Math.ceil((gridSize * gridSize) / 8);
const cellIndex = (point: Point, gridSize: number) => point.y * gridSize + point.x;

/** A human-readable reason why a board cannot be published, or null when it is valid. */
export function labBoardError(board: LabBoard): string | null {
  const { gridSize, start, nodes } = board;
  if (!Number.isInteger(gridSize) || gridSize < LAB_MIN_GRID || gridSize > LAB_MAX_GRID) return "grid";
  const inside = (point: Point) =>
    Number.isInteger(point.x) && Number.isInteger(point.y)
    && point.x >= 0 && point.y >= 0 && point.x < gridSize && point.y < gridSize;
  if (!start || !inside(start)) return "start";
  if (!Array.isArray(nodes) || nodes.length < LAB_MIN_NODES || nodes.length > gridSize * gridSize) return "nodes";
  if (!nodes.every(inside)) return "bounds";
  if (new Set(nodes.map(point => cellIndex(point, gridSize))).size !== nodes.length) return "duplicate";
  if (!nodes.some(point => point.x === start.x && point.y === start.y)) return "missingStart";
  return null;
}

function boardBytes(board: LabBoard, version: number): number[] {
  const { gridSize, start, nodes } = board;
  const mask = new Array<number>(bitmaskBytes(gridSize)).fill(0);
  for (const node of nodes) {
    const index = cellIndex(node, gridSize);
    mask[index >> 3] |= 1 << (index & 7);
  }
  return [version, gridSize, start.x, start.y, ...mask];
}

function readBoard(bytes: number[]): { board: LabBoard; offset: number } | null {
  const [, gridSize, startX, startY] = bytes;
  if (gridSize === undefined || gridSize < LAB_MIN_GRID || gridSize > LAB_MAX_GRID) return null;
  const maskLength = bitmaskBytes(gridSize);
  const offset = 4 + maskLength;
  if (bytes.length < offset || startX === undefined || startY === undefined) return null;
  const start = { x: startX, y: startY };
  const nodes: Point[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const index = y * gridSize + x;
      if ((bytes[4 + (index >> 3)] & (1 << (index & 7))) !== 0) nodes.push({ x, y });
    }
  }
  const board: LabBoard = { gridSize, start, nodes };
  if (labBoardError(board)) return null;
  return { board, offset };
}

export function encodeLabBoard(board: LabBoard): string {
  if (labBoardError(board)) return "";
  return withChecksum(boardBytes(board, BOARD_VERSION));
}

export function decodeLabBoard(code: string): LabBoard | null {
  const bytes = stripChecksum(code);
  if (!bytes || bytes[0] !== BOARD_VERSION) return null;
  const parsed = readBoard(bytes);
  return parsed && parsed.offset === bytes.length ? parsed.board : null;
}

export function encodeRivalRun(run: RivalRun): string {
  const { board, path, timeMs } = run;
  if (labBoardError(board)) return "";
  const indices = path.map(point => cellIndex(point, board.gridSize));
  if (indices.length < 2 || indices.length > 800 || indices.some(index => index < 0 || index >= board.gridSize ** 2)) return "";
  const time = Math.max(0, Math.min(0xffffffff, Math.round(timeMs)));
  const bytes = [
    ...boardBytes(board, RIVAL_VERSION),
    (indices.length >> 8) & 255,
    indices.length & 255,
    ...indices,
    (time >>> 24) & 255,
    (time >>> 16) & 255,
    (time >>> 8) & 255,
    time & 255,
  ];
  return withChecksum(bytes);
}

export function decodeRivalRun(code: string): RivalRun | null {
  const bytes = stripChecksum(code);
  if (!bytes || bytes[0] !== RIVAL_VERSION) return null;
  const parsed = readBoard(bytes);
  if (!parsed) return null;
  const { board, offset } = parsed;
  if (bytes.length < offset + 6) return null;
  const length = (bytes[offset] << 8) | bytes[offset + 1];
  if (length < 2 || length > 800 || bytes.length !== offset + 2 + length + 4) return null;
  const path: Point[] = [];
  for (let i = 0; i < length; i++) {
    const index = bytes[offset + 2 + i];
    if (index >= board.gridSize ** 2) return null;
    path.push({ x: index % board.gridSize, y: Math.floor(index / board.gridSize) });
  }
  const timeStart = offset + 2 + length;
  const timeMs = ((bytes[timeStart] << 24) | (bytes[timeStart + 1] << 16)
    | (bytes[timeStart + 2] << 8) | bytes[timeStart + 3]) >>> 0;
  return { board, path, timeMs };
}

/** Adapt a shared board to the shape the canvas and solver expect. */
export function labBoardToLevel(board: LabBoard): LevelData {
  return {
    id: 0,
    gridSize: board.gridSize,
    start: { ...board.start },
    nodes: board.nodes.map(point => ({ ...point })),
  };
}
