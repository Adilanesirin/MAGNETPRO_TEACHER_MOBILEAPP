/**
 * diaryApi.ts
 * MagnetPro — Teacher Diary API Service
 *
 * Covers all endpoints used by TeacherDiaryScreen:
 *   • Auth / session helpers
 *   • GET  /api/chat/contacts/
 *   • GET  /api/chat/history/
 *   • POST /api/chat/get-room/
 *   • POST /api/chat/send-bulk/
 *   • POST /api/chat/upload/
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://magnetpro.in/api';

// ─── Stored-user shape (from login response) ──────────────────────────────────

export interface StoredUser {
  id: number;
  name?: string;
  username?: string;
  token: string;              // Bearer token returned by /api/user-login/
  institution_id: string;     // kept in AsyncStorage separately too
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Contact {
  id: number;
  name: string;
  role: string;
  admission_no?: string;
}

export type MsgType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'pdf';
export type MsgStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
  id: string | number;
  type: MsgType;
  content?: string;             // text / fallback
  file_url?: string;            // URL returned after upload
  sender_id: number;
  sender_role: 'teacher' | 'parent';
  timestamp: string;
  status: MsgStatus;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
}

export interface ChatRoom {
  id: number;
  teacher_id: number;
  student_id: number;
}

export interface UploadResult {
  id: number;
  file_url: string;
  file_type: string;
  room_id: number;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/**
 * Returns the logged-in teacher's stored profile, or null if not found.
 */
export async function getStoredUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem('magnetpro_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Fallback: institution_id may have been stored separately at login
    if (!parsed.institution_id) {
      const saved = await AsyncStorage.getItem('magnetpro_institution_id');
      if (saved) parsed.institution_id = saved;
    }

    return parsed as StoredUser;
  } catch {
    return null;
  }
}

/**
 * Builds the standard auth header from the stored token.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const user = await getStoredUser();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
  return headers;
}

// ─── 1. Contacts ──────────────────────────────────────────────────────────────

/**
 * GET /api/chat/contacts/?role=teacher&user_id=&institution_id=
 *
 * Returns the list of students (contacts) linked to this teacher.
 */
export async function fetchContacts(): Promise<Contact[]> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired. Please log in again.');

  const params = new URLSearchParams({
    role:           'teacher',
    user_id:        String(user.id),
    institution_id: user.institution_id ?? '',
  });

  const res = await fetch(`${BASE_URL}/chat/contacts/?${params.toString()}`, {
    method:  'GET',
    headers: await authHeaders(),
  });

  if (!res.ok) throw new Error(`Contacts fetch failed: ${res.status}`);

  const data = await res.json();

  // API may return array directly or nested under a key
  if (Array.isArray(data))           return data;
  if (Array.isArray(data.results))   return data.results;
  if (Array.isArray(data.contacts))  return data.contacts;
  if (Array.isArray(data.students))  return data.students;
  return [];
}

// ─── 2. Chat History ──────────────────────────────────────────────────────────

/**
 * GET /api/chat/history/<room_id>/?role=teacher
 * Authorization: Bearer <token>
 *
 * Returns previous diary messages sent by this teacher.
 * Pass an optional `room_id` to scope to a single student's thread.
 */
export async function fetchChatHistory(roomId?: number): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ role: 'teacher' });
  const path = roomId !== undefined
    ? `/chat/history/${encodeURIComponent(String(roomId))}/`
    : '/chat/history/';

  const res = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
    method:  'GET',
    headers: await authHeaders(),
  });

  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);

  const data = await res.json();

  if (Array.isArray(data))          return data;
  if (Array.isArray(data.results))  return data.results;
  if (Array.isArray(data.messages)) return data.messages;
  return [];
}

// ─── 3. Get or Create Chat Room ───────────────────────────────────────────────

/**
 * POST /api/chat/get-room/
 * Body: { teacher_id, student_id }
 *
 * Returns (or creates) the chat room between this teacher and one student.
 * Needed before uploading a file, since upload requires a room_id.
 */
export async function getOrCreateRoom(
  teacherId: number,
  studentId: number,
): Promise<ChatRoom> {
  const res = await fetch(`${BASE_URL}/chat/get-room/`, {
    method:  'POST',
    headers: await authHeaders(),
    body:    JSON.stringify({ teacher_id: teacherId, student_id: studentId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || err?.detail || `get-room failed: ${res.status}`);
  }

  return res.json();
}

// ─── 4. Bulk Text Message ─────────────────────────────────────────────────────

/**
 * POST /api/chat/send-bulk/
 * Body: { teacher_id, student_ids: number[], content: string }
 *
 * Broadcasts a text message (or a file URL string) to all listed students.
 */
export async function sendBulkMessage(payload: {
  teacher_id:  number;
  student_ids: number[];
  content:     string;
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat/send-bulk/`, {
    method:  'POST',
    headers: await authHeaders(),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || err?.detail || `send-bulk failed: ${res.status}`);
  }
}

// ─── 5. File Upload ───────────────────────────────────────────────────────────

/**
 * POST /api/chat/upload/
 * Form Data: room_id, sender_id, sender_role=teacher, file=<binary>
 *
 * Uploads a single file to one chat room.
 * Returns the server file URL which can then be broadcast via send-bulk.
 */
export async function uploadFile(params: {
  roomId:     number;
  senderId:   number;
  fileUri:    string;
  fileName:   string;
  mimeType:   string;
}): Promise<UploadResult> {
  const user = await getStoredUser();
  const headers: Record<string, string> = {};
  if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
  // NOTE: do NOT set Content-Type here — fetch sets it automatically for FormData

  const form = new FormData();
  form.append('room_id',     String(params.roomId));
  form.append('sender_id',   String(params.senderId));
  form.append('sender_role', 'teacher');
  form.append('file', {
    uri:  params.fileUri,
    name: params.fileName,
    type: params.mimeType,
  } as any);

  const res = await fetch(`${BASE_URL}/chat/upload/`, {
    method:  'POST',
    headers,
    body:    form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || err?.detail || `upload failed: ${res.status}`);
  }

  return res.json();
}

// ─── 6. Broadcast File to All Students ───────────────────────────────────────

/**
 * High-level helper used by the diary screen for media sends.
 *
 * Flow:
 *   1. Get/create a room with the first student (upload only needs one room_id).
 *   2. Upload the file → get back a public file_url.
 *   3. Broadcast the file_url as a text message to all students via send-bulk.
 *
 * This means parents all receive the same hosted file URL.
 */
export async function uploadAndBroadcast(params: {
  teacherId:  number;
  studentIds: number[];
  fileUri:    string;
  fileName:   string;
  mimeType:   string;
  caption?:   string;
  msgType:    MsgType;
}): Promise<string> {
  const {
    teacherId, studentIds, fileUri, fileName, mimeType, caption, msgType,
  } = params;

  if (studentIds.length === 0) throw new Error('No students to send to.');

  // Step 1 — get a room (use first student just to get a valid room_id for upload)
  const room = await getOrCreateRoom(teacherId, studentIds[0]);

  // Step 2 — upload the file
  const uploaded = await uploadFile({
    roomId:   room.id,
    senderId: teacherId,
    fileUri,
    fileName,
    mimeType,
  });

  // Step 3 — build a content string for the bulk message
  const prefix: Record<MsgType, string> = {
    image:    '📷 Photo',
    video:    '🎬 Video',
    audio:    '🎙️ Voice note',
    document: '📄 Document',
    pdf:      '📑 PDF',
    text:     '',
  };

  const content = [
    prefix[msgType],
    caption ? `— ${caption}` : '',
    uploaded.file_url,
  ].filter(Boolean).join(' ');

  // Step 4 — broadcast to all students
  await sendBulkMessage({ teacher_id: teacherId, student_ids: studentIds, content });

  return uploaded.file_url;
}

// ─── MIME helpers ─────────────────────────────────────────────────────────────

export function mimeTypeForMsgType(type: MsgType): string {
  const map: Record<MsgType, string> = {
    image:    'image/jpeg',
    video:    'video/mp4',
    audio:    'audio/m4a',
    document: 'application/octet-stream',
    pdf:      'application/pdf',
    text:     'text/plain',
  };
  return map[type] ?? 'application/octet-stream';
}

/**
 * Derives a safe file name from a URI if no explicit name is provided.
 * e.g. "file:///cache/IMG_0042.jpg" → "IMG_0042.jpg"
 */
export function fileNameFromUri(uri: string, fallback = 'attachment'): string {
  const parts = uri.split('/');
  const last  = parts[parts.length - 1];
  return last || fallback;
}
