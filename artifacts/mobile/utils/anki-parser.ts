/**
 * Pure client-side .apkg / .colpkg parser.
 * - Native (iOS/Android via Expo Go): uses expo-sqlite
 * - Web: uses sql.js (WASM loaded from CDN)
 *
 * No network/API calls are made for parsing. Everything runs on-device.
 */
import { Platform } from "react-native";
import JSZip from "jszip";

export interface ParsedCard {
  front: string;
  back: string;
  tags?: string;
}

export interface ParsedDeck {
  name: string;
  cards: ParsedCard[];
}

export interface ParseResult {
  totalCards: number;
  decks: ParsedDeck[];
}

function stripHtml(input: string): string {
  if (!input) return "";
  let s = input.replace(/<br\s*\/?>(?=)/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  s = s.replace(/\[sound:[^\]]+\]/g, "");
  return s.trim();
}

function splitFields(flds: string): string[] {
  return flds.split("\x1f");
}

function parseDecksJson(json: string): Map<number, string> {
  const map = new Map<number, string>();
  try {
    const obj = JSON.parse(json) as Record<string, { id?: number; name?: string }>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      const id = v?.id ?? Number(key);
      const name = v?.name ?? "Default";
      if (typeof id === "number") map.set(id, name);
    }
  } catch {
    // ignore
  }
  return map;
}

interface RawNote {
  id: number;
  flds: string;
  tags: string;
}

interface RawCard {
  nid: number;
  did: number;
}

function buildResult(
  notes: RawNote[],
  cards: RawCard[],
  decks: Map<number, string>,
): ParseResult {
  const noteDeck = new Map<number, number>();
  for (const c of cards) if (!noteDeck.has(c.nid)) noteDeck.set(c.nid, c.did);

  const byDeck = new Map<string, ParsedCard[]>();
  let total = 0;
  for (const n of notes) {
    const fields = splitFields(n.flds).map(stripHtml).filter((s) => s.length > 0);
    if (fields.length < 2) continue;
    const front = fields[0]!;
    const back = fields.slice(1).join("\n\n");
    const did = noteDeck.get(n.id);
    const deckName = (did != null ? decks.get(did) : undefined) ?? "Imported";
    if (!byDeck.has(deckName)) byDeck.set(deckName, []);
    byDeck.get(deckName)!.push({ front, back, tags: n.tags.trim() || undefined });
    total++;
  }
  return {
    totalCards: total,
    decks: Array.from(byDeck.entries()).map(([name, c]) => ({ name, cards: c })),
  };
}

/* ---------- Native path: expo-sqlite ---------- */

async function parseNative(zip: JSZip, dbName: string): Promise<ParseResult> {
  const SQLite = await import("expo-sqlite");
  const FS = await import("expo-file-system");

  const dbFile = zip.file(dbName);
  if (!dbFile) throw new Error(`Tidak menemukan ${dbName} dalam .apkg`);
  const dbBytes = await dbFile.async("uint8array");

  // Convert bytes to base64 then write to SQLite directory so expo-sqlite can open it.
  // (Use a unique filename so we don't collide with the user's main DB.)
  const sqliteDir = (FS as any).documentDirectory + "SQLite/";
  try {
    await (FS as any).makeDirectoryAsync(sqliteDir, { intermediates: true });
  } catch {
    // already exists
  }
  const tmpName = `anki_import_${Date.now()}.db`;
  const tmpPath = sqliteDir + tmpName;

  // Convert Uint8Array → base64 (manually to avoid Buffer dep)
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < dbBytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(dbBytes.subarray(i, i + chunk)) as any,
    );
  }
  // btoa exists in RN/Hermes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b64 = (globalThis as any).btoa(binary);
  await (FS as any).writeAsStringAsync(tmpPath, b64, {
    encoding: (FS as any).EncodingType?.Base64 ?? "base64",
  });

  const db = await (SQLite as any).openDatabaseAsync(tmpName);

  try {
    // decks JSON from col table
    let decks = new Map<number, string>();
    try {
      const colRow = await db.getFirstAsync<{ decks: string }>(
        "SELECT decks FROM col LIMIT 1",
      );
      if (colRow?.decks) decks = parseDecksJson(colRow.decks);
    } catch {
      // ignore
    }

    const cardRows = (await db.getAllAsync<{ nid: number; did: number }>(
      "SELECT nid, did FROM cards",
    )) as RawCard[];
    const noteRows = (await db.getAllAsync<{
      id: number;
      flds: string;
      tags: string;
    }>("SELECT id, flds, tags FROM notes")) as RawNote[];

    return buildResult(noteRows, cardRows, decks);
  } finally {
    try {
      await db.closeAsync();
    } catch {
      // ignore
    }
    try {
      await (FS as any).deleteAsync(tmpPath, { idempotent: true });
    } catch {
      // ignore
    }
  }
}

/* ---------- Web path: sql.js ---------- */

async function parseWeb(zip: JSZip, dbName: string): Promise<ParseResult> {
  const initSqlJs = (await import("sql.js")).default ?? (await import("sql.js"));
  const SQL = await (initSqlJs as any)({
    locateFile: (file: string) =>
      `https://sql.js.org/dist/${file}`,
  });

  const dbFile = zip.file(dbName);
  if (!dbFile) throw new Error(`Tidak menemukan ${dbName} dalam .apkg`);
  const dbBytes = await dbFile.async("uint8array");
  const db = new SQL.Database(dbBytes);

  try {
    let decks = new Map<number, string>();
    try {
      const colRes = db.exec("SELECT decks FROM col LIMIT 1");
      if (colRes.length > 0 && colRes[0].values[0]) {
        decks = parseDecksJson(String(colRes[0].values[0][0] ?? "{}"));
      }
    } catch {
      // ignore
    }

    const cardRows: RawCard[] = [];
    try {
      const cardRes = db.exec("SELECT nid, did FROM cards");
      if (cardRes.length > 0) {
        for (const row of cardRes[0].values) {
          cardRows.push({ nid: Number(row[0]), did: Number(row[1]) });
        }
      }
    } catch {
      // ignore
    }

    const noteRows: RawNote[] = [];
    const noteRes = db.exec("SELECT id, flds, tags FROM notes");
    if (noteRes.length > 0) {
      for (const row of noteRes[0].values) {
        noteRows.push({
          id: Number(row[0]),
          flds: String(row[1] ?? ""),
          tags: String(row[2] ?? ""),
        });
      }
    }

    return buildResult(noteRows, cardRows, decks);
  } finally {
    db.close();
  }
}

/* ---------- Public entry ---------- */

/** Parse a .apkg / .colpkg given its raw bytes. Runs fully on-device. */
export async function parseApkg(bytes: Uint8Array): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(bytes);
  const dbName = zip.file("collection.anki21")
    ? "collection.anki21"
    : zip.file("collection.anki2")
      ? "collection.anki2"
      : "";
  if (!dbName) {
    throw new Error("File bukan .apkg yang valid (collection database tidak ditemukan)");
  }
  if (Platform.OS === "web") return parseWeb(zip, dbName);
  return parseNative(zip, dbName);
}
