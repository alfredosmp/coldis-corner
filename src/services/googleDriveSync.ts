import { db, DEFAULT_SETTINGS } from '../db/database';
import { parseAndIndexDocument } from './documentParser';
import type {
  AppSettings,
  BookHighlight,
  BookItem,
  CalendarEvent,
  Flashcard,
  GlossaryTerm,
  PomodoroSession,
  StudyNote,
  Subject,
} from '../types/models';

const SESSION_KEY = 'coldi_gdrive_session_v1';
const CONFIG_KEY = 'coldi_gdrive_config_v1';
const TOMBSTONE_KEY = 'coldi_deleted_tombstones_v1';
const PKCE_VERIFIER_KEY = 'coldi_gdrive_pkce_verifier';

const DRIVE_FOLDER_NAME = "Coldi's Corner";
const DRIVE_BOOKS_SUBFOLDER = 'books';
const DRIVE_STATE_FILENAME = 'state.json';
const DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
// Public OAuth Client ID (safe for client-side PWA; client_secret stays strictly local in .env)
const DEFAULT_PUBLIC_CLIENT_ID =
  '152833242613-mduinf8mgojvplme8ng8lhg6lsljm86v.apps.googleusercontent.com';

export interface GoogleDriveSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  folderId?: string;
  booksFolderId?: string;
  stateFileId?: string;
  lastSyncedAt?: number;
}

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret?: string;
}

export interface CloudSyncState {
  connected: boolean;
  email?: string;
  syncing: boolean;
  lastSyncedAt?: number;
  error?: string;
  needsReauth?: boolean;
  isDesktop: boolean;
  hasClientId: boolean;
}

interface CloudStatePayload {
  schemaVersion: number;
  exportedAt: number;
  deletedIds: Record<string, number>;
  settings: AppSettings;
  subjects: Subject[];
  calendarEvents: CalendarEvent[];
  books: BookItem[];
  bookHighlights: BookHighlight[];
  studyNotes: StudyNote[];
  flashcards: Flashcard[];
  pomodoroSessions: PomodoroSession[];
  glossary: GlossaryTerm[];
}

export function isDesktopApp(): boolean {
  return Boolean(window.coldiDesktop?.isDesktop);
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  let stored: Partial<GoogleDriveConfig> = {};
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // ignore
  }
  const clientId = (
    stored.clientId ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    DEFAULT_PUBLIC_CLIENT_ID
  ).trim();
  const clientSecret = (
    stored.clientSecret ||
    import.meta.env.VITE_GOOGLE_CLIENT_SECRET ||
    ''
  ).trim();
  return { clientId, clientSecret: clientSecret || undefined };
}

export function saveGoogleDriveConfig(config: GoogleDriveConfig): void {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      clientId: config.clientId.trim(),
      clientSecret: config.clientSecret?.trim() || undefined,
    })
  );
}

export function getStoredDriveSession(): GoogleDriveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleDriveSession;
    if (!parsed.accessToken && !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDriveSession(session: GoogleDriveSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function recordDeletionTombstone(id: string): void {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[id] = Date.now();
    // Prune tombstones older than 180 days
    const cutoff = Date.now() - 180 * 86_400_000;
    for (const key of Object.keys(map)) {
      if (map[key] < cutoff) delete map[key];
    }
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function getDeletionTombstones(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveDeletionTombstones(map: Record<string, number>): void {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(hash);
  return { verifier, challenge };
}

async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email;
  } catch {
    return undefined;
  }
}

async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  config: GoogleDriveConfig
): Promise<GoogleDriveSession> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`No se pudo completar el acceso a Google Drive (${res.status}): ${errText.slice(0, 140)}`);
  }

  const tokenData = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const prev = getStoredDriveSession();
  const email = await fetchUserEmail(tokenData.access_token);
  const session: GoogleDriveSession = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || prev?.refreshToken,
    expiresAt: Date.now() + Math.max(60, tokenData.expires_in - 120) * 1000,
    email: email || prev?.email,
    folderId: prev?.folderId,
    booksFolderId: prev?.booksFolderId,
    stateFileId: prev?.stateFileId,
    lastSyncedAt: prev?.lastSyncedAt,
  };
  saveDriveSession(session);
  return session;
}

async function refreshAccessTokenIfNeeded(session: GoogleDriveSession): Promise<GoogleDriveSession> {
  if (session.accessToken && Date.now() < session.expiresAt) {
    return session;
  }

  const config = getGoogleDriveConfig();
  if (!session.refreshToken || !config.clientId) {
    throw new Error('REAUTH_REQUIRED');
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    refresh_token: session.refreshToken,
    grant_type: 'refresh_token',
  });
  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error('REAUTH_REQUIRED');
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const next: GoogleDriveSession = {
    ...session,
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in - 120) * 1000,
  };
  saveDriveSession(next);
  return next;
}

/**
 * Initiates one-time Google Drive sign-in.
 * - On Windows (Electron): opens browser + loopback callback and stores permanent refresh_token.
 * - On Mobile/Web PWA: redirects cleanly to Google OAuth and returns right back to the PWA.
 */
export async function connectGoogleDrive(): Promise<GoogleDriveSession | null> {
  const config = getGoogleDriveConfig();
  if (!config.clientId) {
    throw new Error(
      'Falta configurar el Client ID de Google Drive en Ajustes (se configura una sola vez).'
    );
  }

  const { verifier, challenge } = await createPkcePair();

  if (window.coldiDesktop?.isDesktop) {
    const redirectUri = await window.coldiDesktop.getRedirectUri();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    const result = await window.coldiDesktop.startGoogleOAuth(authUrl);
    if (result.error || !result.code) {
      throw new Error(
        result.error === 'timeout'
          ? 'Se agotó el tiempo de espera del inicio de sesión.'
          : 'Se canceló la conexión con Google Drive.'
      );
    }

    return exchangeAuthCode(result.code, verifier, redirectUri, config);
  }

  // Mobile / Web PWA flow: PKCE redirect (or implicit token fallback if no client_secret)
  const cleanPath = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  const redirectUri = `${window.location.origin}${cleanPath}`;
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: config.clientSecret ? 'code' : 'token',
    scope: DRIVE_SCOPE,
    include_granted_scopes: 'true',
  });
  if (config.clientSecret) {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }

  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  return null;
}

/**
 * Completes OAuth redirect on Mobile / Web PWA when returning from Google Sign-In.
 */
export async function completeWebOAuthIfPresent(): Promise<GoogleDriveSession | null> {
  if (window.coldiDesktop?.isDesktop) return null;

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  if (code) {
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY) || '';
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    const cleanPath = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : `${window.location.pathname}/`;
    const redirectUri = `${window.location.origin}${cleanPath}`;
    window.history.replaceState({}, document.title, redirectUri);

    const config = getGoogleDriveConfig();
    if (!config.clientId || !verifier) return null;
    return exchangeAuthCode(code, verifier, redirectUri, config);
  }

  // Implicit flow hash (#access_token=...)
  if (window.location.hash.includes('access_token=')) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = Number(hashParams.get('expires_in') || '3500');
    window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
    if (!accessToken) return null;

    const prev = getStoredDriveSession();
    const email = await fetchUserEmail(accessToken);
    const session: GoogleDriveSession = {
      accessToken,
      refreshToken: prev?.refreshToken,
      expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000,
      email: email || prev?.email,
      folderId: prev?.folderId,
      booksFolderId: prev?.booksFolderId,
      stateFileId: prev?.stateFileId,
      lastSyncedAt: prev?.lastSyncedAt,
    };
    saveDriveSession(session);
    return session;
  }

  return null;
}

export function disconnectGoogleDrive(): void {
  saveDriveSession(null);
}

// === Google Drive REST v3 Helpers ===

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    throw new Error('REAUTH_REQUIRED');
  }
  return res;
}

async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const q = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false${parentClause}`;

  const searchRes = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`
  );
  if (searchRes.ok) {
    const data = (await searchRes.json()) as { files?: { id: string }[] };
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  const createRes = await driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok) {
    throw new Error('No se pudo crear la carpeta Coldi’s Corner en Google Drive.');
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function findFileInFolder(
  token: string,
  folderId: string,
  fileName: string
): Promise<string | null> {
  const safeName = fileName.replace(/'/g, "\\'");
  const q = `name='${safeName}' and '${folderId}' in parents and trashed=false`;
  const res = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)&pageSize=5`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

async function uploadJsonFile(
  token: string,
  folderId: string,
  fileName: string,
  existingFileId: string | undefined,
  payload: unknown
): Promise<string> {
  const jsonBody = JSON.stringify(payload);

  if (existingFileId) {
    const res = await driveFetch(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&fields=id`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: jsonBody,
      }
    );
    if (res.ok) {
      return existingFileId;
    }
  }

  // Create new file via multipart upload
  const boundary = `coldi_boundary_${Date.now()}`;
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  });
  const multipart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonBody}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(
    token,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    }
  );
  if (!res.ok) {
    throw new Error('No se pudo subir state.json a Google Drive.');
  }
  const created = (await res.json()) as { id: string };
  return created.id;
}

async function uploadBinaryFile(
  token: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  data: ArrayBuffer
): Promise<void> {
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    parents: [folderId],
  });

  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', new Blob([data], { type: mimeType || 'application/octet-stream' }));

  const res = await driveFetch(
    token,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      body: form,
    }
  );
  if (!res.ok) {
    throw new Error(`No se pudo respaldar el archivo ${fileName}`);
  }
}

// === Two-Way Conflict-Safe Merge (LWW by updatedAt + Tombstones) ===

function mergeRecords<T extends { id: string; updatedAt?: number; createdAt?: number }>(
  localItems: T[],
  remoteItems: T[],
  tombstones: Record<string, number>
): T[] {
  const map = new Map<string, T>();

  const consider = (item: T) => {
    const itemTs = item.updatedAt ?? item.createdAt ?? 0;
    const deletedAt = tombstones[item.id];
    if (deletedAt && deletedAt >= itemTs) return;

    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      return;
    }
    const existingTs = existing.updatedAt ?? existing.createdAt ?? 0;
    if (itemTs >= existingTs) {
      map.set(item.id, item);
    }
  };

  for (const r of remoteItems) consider(r);
  for (const l of localItems) consider(l);

  return Array.from(map.values());
}

function mergeTombstones(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...a };
  for (const [id, ts] of Object.entries(b)) {
    if (!merged[id] || ts > merged[id]) {
      merged[id] = ts;
    }
  }
  return merged;
}

let inFlightSync: Promise<GoogleDriveSession> | null = null;

/**
 * Runs a complete silent two-way sync with Mafecita's personal Google Drive ("Coldi's Corner" folder).
 * Merges all study data + incrementally syncs PDF/Word/EPUB files so laptop and phone stay identical.
 */
export async function syncWithGoogleDrive(): Promise<GoogleDriveSession> {
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    if (!navigator.onLine) {
      throw new Error('OFFLINE');
    }

    const stored = getStoredDriveSession();
    if (!stored) {
      throw new Error('NOT_CONNECTED');
    }

    const session = await refreshAccessTokenIfNeeded(stored);
    const token = session.accessToken;

    // 1. Ensure Coldi's Corner folder & books subfolder exist
    const folderId =
      session.folderId || (await findOrCreateFolder(token, DRIVE_FOLDER_NAME));
    const booksFolderId =
      session.booksFolderId ||
      (await findOrCreateFolder(token, DRIVE_BOOKS_SUBFOLDER, folderId));

    // 2. Download existing remote state.json if present
    let stateFileId =
      session.stateFileId || (await findFileInFolder(token, folderId, DRIVE_STATE_FILENAME)) || undefined;
    let remoteState: CloudStatePayload | null = null;

    if (stateFileId) {
      const dlRes = await driveFetch(
        token,
        `https://www.googleapis.com/drive/v3/files/${stateFileId}?alt=media`
      );
      if (dlRes.ok) {
        try {
          remoteState = (await dlRes.json()) as CloudStatePayload;
        } catch {
          remoteState = null;
        }
      } else if (dlRes.status === 404) {
        stateFileId = undefined;
      }
    }

    // 3. Read all local Dexie tables
    const [
      localSettingsRec,
      localSubjects,
      localEvents,
      localBooks,
      localHighlights,
      localNotes,
      localCards,
      localSessions,
      localGlossary,
    ] = await Promise.all([
      db.settings.get('main'),
      db.subjects.toArray(),
      db.calendarEvents.toArray(),
      db.books.toArray(),
      db.bookHighlights.toArray(),
      db.studyNotes.toArray(),
      db.flashcards.toArray(),
      db.pomodoroSessions.toArray(),
      db.glossary.toArray(),
    ]);

    const localSettings: AppSettings = { ...DEFAULT_SETTINGS, ...(localSettingsRec ?? {}) };
    const localTombstones = getDeletionTombstones();

    // 4. Two-way merge
    const mergedTombstones = mergeTombstones(localTombstones, remoteState?.deletedIds ?? {});
    const mergedSettings: AppSettings =
      remoteState?.settings &&
      (remoteState.settings.updatedAt ?? 0) > (localSettings.updatedAt ?? 0)
        ? { ...DEFAULT_SETTINGS, ...remoteState.settings, id: 'main' }
        : localSettings;

    const mergedSubjects = mergeRecords(localSubjects, remoteState?.subjects ?? [], mergedTombstones);
    const mergedEvents = mergeRecords(localEvents, remoteState?.calendarEvents ?? [], mergedTombstones);
    const mergedBooks = mergeRecords(localBooks, remoteState?.books ?? [], mergedTombstones);
    const mergedHighlights = mergeRecords(
      localHighlights,
      remoteState?.bookHighlights ?? [],
      mergedTombstones
    );
    const mergedNotes = mergeRecords(localNotes, remoteState?.studyNotes ?? [], mergedTombstones);
    const mergedCards = mergeRecords(localCards, remoteState?.flashcards ?? [], mergedTombstones);
    const mergedSessions = mergeRecords(
      localSessions.map((s) => ({ ...s, updatedAt: s.completedAt })),
      (remoteState?.pomodoroSessions ?? []).map((s) => ({ ...s, updatedAt: s.completedAt })),
      mergedTombstones
    ).map(({ updatedAt: _u, ...rest }) => rest as PomodoroSession);
    const mergedGlossary = mergeRecords(
      localGlossary,
      remoteState?.glossary ?? [],
      mergedTombstones
    );

    // 5. Persist merged state back to local Dexie cleanly
    await db.transaction(
      'rw',
      [
        db.settings,
        db.subjects,
        db.calendarEvents,
        db.books,
        db.bookHighlights,
        db.studyNotes,
        db.flashcards,
        db.pomodoroSessions,
        db.glossary,
      ],
      async () => {
        await db.settings.put(mergedSettings);

        await db.subjects.clear();
        if (mergedSubjects.length) await db.subjects.bulkPut(mergedSubjects);

        await db.calendarEvents.clear();
        if (mergedEvents.length) await db.calendarEvents.bulkPut(mergedEvents);

        await db.books.clear();
        if (mergedBooks.length) await db.books.bulkPut(mergedBooks);

        await db.bookHighlights.clear();
        if (mergedHighlights.length) await db.bookHighlights.bulkPut(mergedHighlights);

        await db.studyNotes.clear();
        if (mergedNotes.length) await db.studyNotes.bulkPut(mergedNotes);

        await db.flashcards.clear();
        if (mergedCards.length) await db.flashcards.bulkPut(mergedCards);

        await db.pomodoroSessions.clear();
        if (mergedSessions.length) await db.pomodoroSessions.bulkPut(mergedSessions);

        await db.glossary.clear();
        if (mergedGlossary.length) await db.glossary.bulkPut(mergedGlossary);
      }
    );
    saveDeletionTombstones(mergedTombstones);

    // 6. Upload merged state.json to Drive
    const nextPayload: CloudStatePayload = {
      schemaVersion: 6,
      exportedAt: Date.now(),
      deletedIds: mergedTombstones,
      settings: mergedSettings,
      subjects: mergedSubjects,
      calendarEvents: mergedEvents,
      books: mergedBooks,
      bookHighlights: mergedHighlights,
      studyNotes: mergedNotes,
      flashcards: mergedCards,
      pomodoroSessions: mergedSessions,
      glossary: mergedGlossary,
    };

    const nextStateFileId = await uploadJsonFile(
      token,
      folderId,
      DRIVE_STATE_FILENAME,
      stateFileId,
      nextPayload
    );

    // 7. Incremental binary sync for PDF / Word / EPUB files in Coldi's Corner/books/
    const listRes = await driveFetch(
      token,
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${booksFolderId}' in parents and trashed=false`
      )}&fields=files(id,name)&pageSize=200`
    );

    const remoteBookFiles = new Map<string, string>(); // fileName -> driveFileId
    if (listRes.ok) {
      const data = (await listRes.json()) as { files?: { id: string; name: string }[] };
      for (const f of data.files ?? []) {
        remoteBookFiles.set(f.name, f.id);
      }
    }

    for (const book of mergedBooks) {
      const driveName = `${book.id}.${book.format}`;
      const localBlob = await db.bookFiles.get(book.id);
      const remoteFileId = remoteBookFiles.get(driveName);

      if (localBlob && !remoteFileId) {
        // Upload local PDF/Word/EPUB once to her Drive
        try {
          await uploadBinaryFile(token, booksFolderId, driveName, localBlob.mimeType, localBlob.data);
        } catch {
          // Non-fatal: retry next sync
        }
      } else if (!localBlob && remoteFileId) {
        // Download missing book from Drive to this device (e.g., phone) & index it for offline search!
        try {
          const fileRes = await driveFetch(
            token,
            `https://www.googleapis.com/drive/v3/files/${remoteFileId}?alt=media`
          );
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            const mimeMap = {
              pdf: 'application/pdf',
              docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              epub: 'application/epub+zip',
            };
            const mimeType = mimeMap[book.format] || 'application/octet-stream';
            await db.bookFiles.put({ bookId: book.id, data: arrayBuffer, mimeType });

            // Re-index chunks locally so in-book search & live note suggestions work offline on this device too
            try {
              const fileObj = new File([arrayBuffer], book.fileName || driveName, { type: mimeType });
              const parsed = await parseAndIndexDocument(fileObj, book.id);
              if (parsed.chunks.length > 0) {
                await db.bookChunks.where('bookId').equals(book.id).delete();
                await db.bookChunks.bulkPut(parsed.chunks);
              }
            } catch {
              // File is still readable even if indexing skipped
            }
          }
        } catch {
          // Non-fatal: retry next sync
        }
      }
    }

    const updatedSession: GoogleDriveSession = {
      ...session,
      folderId,
      booksFolderId,
      stateFileId: nextStateFileId,
      lastSyncedAt: Date.now(),
    };
    saveDriveSession(updatedSession);
    return updatedSession;
  })();

  try {
    return await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}
