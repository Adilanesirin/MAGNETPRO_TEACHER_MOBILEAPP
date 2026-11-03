import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,

  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
// ════════════════════════════════════════════════════════════════════════════
//  RESPONSIVE HELPERS
// ════════════════════════════════════════════════════════════════════════════
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.5));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ════════════════════════════════════════════════════════════════════════════
//  BRAND COLORS — same accent (#0E7EA4) as the rest of the app, fresh palette
// ════════════════════════════════════════════════════════════════════════════
const C = {
  accent:        '#0E7EA4',
  accentDark:    '#0A5F7A',
  accentDeep:    '#073F52',
  accentLight:   '#EDF6FA',
  accentMid:     '#1591B8',
  accentSoft:    'rgba(14,126,164,0.10)',
  bg:            '#F5F8FA',
  bgChat:        '#EAF1F4',
  white:         '#FFFFFF',
  dark:          '#142A33',
  ink:           '#1E3A44',
  muted:         '#7B97A1',
  mutedLight:    '#A9C0C8',
  faint:         '#C7D9DE',
  border:        'rgba(14,57,72,0.08)',
  borderMid:     'rgba(14,57,72,0.14)',
  bubbleOut:     '#0E7EA4',
  bubbleOutText: '#FFFFFF',
  bubbleOutSub:  'rgba(255,255,255,0.75)',
  amber:         '#D88A3F',
  amberSoft:     'rgba(216,138,63,0.12)',
  success:       '#2FBF8F',
  successSoft:   'rgba(47,191,143,0.12)',
  danger:        '#E25C5C',
  dangerSoft:    'rgba(226,92,92,0.10)',
  overlay:       'rgba(8,24,30,0.55)',
  pdf:           '#E25C5C',
  doc:           '#3D7FE0',
  audio:         '#9B6BC4',
  video:         '#E08A3C',
  shimmer:       'rgba(255,255,255,0.35)',
};

// ════════════════════════════════════════════════════════════════════════════
//  API CONFIG
// ════════════════════════════════════════════════════════════════════════════
const BASE_URL = 'https://magnetpro.in/api';

// AsyncStorage keys.
// NOTE: adjust AUTH_TOKEN_KEYS to match whatever key your login flow actually
// uses — we try each of these in order and use the first one found.
const USER_STORAGE_KEY = 'magnetpro_user';
const AUTH_TOKEN_KEYS = ['auth_token', 'magnetpro_token', 'token'];
const BROADCAST_HISTORY_KEY = 'magnetpro_broadcast_history';

// There is no GET endpoint for broadcast history (send-bulk is fire-and-forget),
// so sent messages are persisted locally in AsyncStorage and survive app restarts.
// If a real broadcast-history endpoint becomes available, swap loadLocalHistory()
// for a fetch call here.

// ════════════════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════════════════
export type MsgType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'pdf';
export type MsgStatus = 'sending' | 'sent' | 'failed' | 'delivered';

export interface BroadcastMessage {
  id: string;
  type: MsgType;
  text?: string;
  mediaUri?: string;
  remoteUrl?: string;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  timestamp: string;
  isoDate: string;
  status: MsgStatus;
  recipientCount: number;
  errorMessage?: string;
}

export interface Contact {
  id: number;
  name: string;
  role: string;
  class?: string;
  div?: string;
  admno?: string;
  room_id?: number;
  is_online?: boolean;
}

interface StoredUser {
  id: number;
  institution_id: string;
  token?: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  STORAGE HELPERS
// ════════════════════════════════════════════════════════════════════════════
async function getStoredUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    for (const key of AUTH_TOKEN_KEYS) {
      const val = await AsyncStorage.getItem(key);
      if (val) return val;
    }
    // Fall back to a token field nested inside the stored user object.
    const user = await getStoredUser();
    if (user?.token) return user.token;
    return null;
  } catch {
    return null;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadLocalHistory(): Promise<BroadcastMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(BROADCAST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveLocalHistory(messages: BroadcastMessage[]): Promise<void> {
  try {
    // Cap stored history so AsyncStorage doesn't grow unbounded.
    const trimmed = messages.slice(-300);
    await AsyncStorage.setItem(BROADCAST_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('saveLocalHistory error:', e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  API MODULE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Fetches the contact/recipient list. This is used ONLY to know who the
 * broadcast goes to (count + names for the header) — there is no per-contact
 * thread UI since this screen is broadcast-only.
 */
async function fetchContacts(): Promise<Contact[]> {
  const user = await getStoredUser();
  if (!user) return [];
  const headers = await authHeaders();

  const params = new URLSearchParams({
    role: 'teacher',
    user_id: String(user.id),
    institution_id: user.institution_id,
  });

  const res = await fetch(`${BASE_URL}/chat/contacts/?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
  });

  if (!res.ok) throw new Error(`Contacts fetch failed: ${res.status}`);
  const data = await res.json();

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.contacts)) return data.contacts;
  if (Array.isArray(data.students)) return data.students;
  return [];
}

async function sendBulkMessage(payload: {
  teacher_id: number;
  student_ids: number[];
  content: string;
}): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/chat/send-bulk/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || err?.detail || `Send failed: ${res.status}`);
  }
}

/**
 * Uploads a file via the shared chat upload endpoint, returning the server's
 * file URL so it can be embedded as text content in the bulk send.
 *
 * /chat/upload/ requires a real, existing room_id — there is no broadcast-wide
 * room on the backend. To satisfy this, we lazily create/fetch ONE real room
 * via /chat/get-room/ (teacher_id + the first student in the contact list)
 * the first time an upload is needed, cache its room_id locally, and reuse
 * that same room_id for every subsequent broadcast upload.
 *
 * This is a workaround, not a real "broadcast room" concept — if the backend
 * ever adds a dedicated broadcast room or broadcast-upload endpoint, swap
 * getOrCreateUploadRoomId() below for that instead.
 */
const UPLOAD_ROOM_ID_KEY = 'magnetpro_upload_room_id';
let cachedUploadRoomId: number | null = null;

async function fetchRoomIdFromServer(params: { teacherId: number; fallbackStudentId: number }): Promise<number> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/chat/get-room/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      teacher_id: params.teacherId,
      student_id: params.fallbackStudentId,
    }),
  });

  const raw = await res.text();
  console.log('[get-room] status:', res.status, 'raw response:', raw);

  if (!res.ok) {
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {}
    throw new Error(parsed?.message || parsed?.detail || `get-room failed: ${res.status}`);
  }

  let data: any = {};
  try { data = JSON.parse(raw); } catch {
    throw new Error('get-room returned a non-JSON response.');
  }

  // Try every shape we've seen APIs use for this. Logged above so we can see
  // exactly which shape this backend actually returns if none of these hit.
  const roomId =
    data?.room_id ?? data?.id ?? data?.room?.id ?? data?.room?.room_id ??
    data?.data?.room_id ?? data?.data?.id ?? data?.result?.room_id;

  if (roomId == null) {
    throw new Error('get-room succeeded but no room_id could be found in the response — check console log above for the raw shape.');
  }
  return Number(roomId);
}

async function getOrCreateUploadRoomId(params: {
  teacherId: number;
  fallbackStudentId: number;
}): Promise<number> {
  if (cachedUploadRoomId != null) return cachedUploadRoomId;

  try {
    const stored = await AsyncStorage.getItem(UPLOAD_ROOM_ID_KEY);
    if (stored != null && !Number.isNaN(Number(stored)) && Number(stored) > 0) {
      cachedUploadRoomId = Number(stored);
      console.log('[upload room] using cached room_id from storage:', cachedUploadRoomId);
      return cachedUploadRoomId;
    }
    // A previously-cached value of 0, NaN, or empty string is treated as
    // invalid and discarded rather than reused, since 0 is exactly the value
    // that caused "ChatRoom matching query does not exist." earlier.
    if (stored != null) {
      await AsyncStorage.removeItem(UPLOAD_ROOM_ID_KEY);
    }
  } catch {}

  const roomId = await fetchRoomIdFromServer(params);
  console.log('[upload room] fetched fresh room_id from server:', roomId);

  cachedUploadRoomId = roomId;
  AsyncStorage.setItem(UPLOAD_ROOM_ID_KEY, String(roomId)).catch(() => {});
  return cachedUploadRoomId;
}

/**
 * Clears the cached upload room id (both in-memory and in storage) so the
 * next upload attempt fetches a fresh one from the server. Call this if
 * uploads keep failing with "ChatRoom matching query does not exist" —
 * it usually means a bad id got cached at some point.
 */
async function resetCachedUploadRoomId(): Promise<void> {
  cachedUploadRoomId = null;
  try { await AsyncStorage.removeItem(UPLOAD_ROOM_ID_KEY); } catch {}
}

async function uploadChatFile(params: {
  teacherId: number;
  fallbackStudentId: number;
  senderId: number;
  uri: string;
  name: string;
  mimeType: string;
}): Promise<{ url: string }> {
  const roomId = await getOrCreateUploadRoomId({
    teacherId: params.teacherId,
    fallbackStudentId: params.fallbackStudentId,
  });

  console.log('[upload] sending with room_id:', roomId, 'sender_id:', params.senderId);

  const headers = await authHeaders();
  const form = new FormData();
  form.append('room_id', String(roomId));
  form.append('sender_id', String(params.senderId));
  form.append('sender_role', 'teacher');
  form.append('file', {
    uri: params.uri,
    name: params.name,
    type: params.mimeType,
  } as any);

  const res = await fetch(`${BASE_URL}/chat/upload/`, {
    method: 'POST',
    headers, // do NOT set Content-Type manually for multipart — fetch sets the boundary
    body: form,
  });

  const raw = await res.text();
  console.log('[upload] status:', res.status, 'raw response:', raw);

  if (!res.ok) {
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {}
    const message: string = parsed?.message || parsed?.detail || raw || `Upload failed: ${res.status}`;

    // If the room_id we used doesn't actually exist on the server, our cache
    // is stale/wrong — clear it so the NEXT attempt fetches a fresh room_id
    // from get-room instead of repeating the same failure forever.
    if (/ChatRoom matching query does not exist/i.test(message)) {
      console.warn('[upload] cached room_id', roomId, 'is invalid on the server — clearing cache.');
      await resetCachedUploadRoomId();
      throw new Error(`Upload room (id ${roomId}) does not exist on the server. The cached room has been cleared — please try sending again.`);
    }
    throw new Error(message);
  }

  let data: any = {};
  try { data = JSON.parse(raw); } catch {}
  const attachment = Array.isArray(data?.attachments)
    ? data.attachments[0]
    : Array.isArray(data?.message?.attachments)
      ? data.message.attachments[0]
      : Array.isArray(data?.data?.attachments)
        ? data.data.attachments[0]
        : Array.isArray(data?.data?.message?.attachments)
          ? data.data.message.attachments[0]
          : null;
  const url =
    data?.url ||
    data?.file_url ||
    data?.file ||
    data?.path ||
    data?.message?.url ||
    data?.message?.file_url ||
    data?.data?.url ||
    data?.data?.file_url ||
    attachment?.url ||
    attachment?.file_url ||
    attachment?.file ||
    attachment?.path;
  if (!url) throw new Error('Upload succeeded but no file URL was returned. Check console log above for the raw response shape.');
  return { url };
}

// ════════════════════════════════════════════════════════════════════════════
//  ICONS
// ════════════════════════════════════════════════════════════════════════════
const BackIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MegaphoneIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M14 8a4 4 0 010 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M17 5a8 8 0 010 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const SendIcon = ({ active }: { active: boolean }) => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M22 2L11 13" stroke={active ? C.white : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={active ? C.white : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PlayIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M5 3l14 9-14 9V3z" fill={color} />
  </Svg>
);

const PauseIcon = ({ color = C.white, size = 13 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={color} />
  </Svg>
);

const MicIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="2" width="6" height="13" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M5 10a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 19v3M9 22h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const ImagePickIcon = ({ color = C.accent }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8" />
    <Circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const VideoPickIcon = ({ color = C.video }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="6" width="14" height="12" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M16 10l6-3v10l-6-3V10z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </Svg>
);

const FileIcon = ({ color = C.doc }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="8" y1="17" x2="12" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const PdfIcon = ({ color = C.pdf }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M8 12h1.5a1 1 0 010 2H8v-2zm0 2v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M12 12v4m0-4h1.5a1.5 1.5 0 010 3H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 12h2v1.5M16 14.5h1.5M16 16h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const EmojiIcon = ({ color = C.muted }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M8 14s1.5 2 4 2 4-2 4-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="9" y1="9" x2="9.01" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="15" y1="9" x2="15.01" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

const PlusIcon = ({ color = C.accent }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const CloseIcon = ({ color = C.muted, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const RetryIcon = ({ color = C.danger, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 4v6h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4.5 13a8 8 0 1015-5.5L20 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = ({ color = C.mutedLight, double = false }: { color?: string; double?: boolean }) => (
  <Svg width={rs(15)} height={rs(15)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 12l5 5L20 7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    {double && <Path d="M1 12l5 5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />}
  </Svg>
);

const ClockIcon = ({ color = C.bubbleOutSub, size = 13 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SearchIcon = ({ color = C.white, size = 19 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <Line x1="21" y1="21" x2="16.5" y2="16.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const PinIcon = ({ color = C.amber, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2l1.5 5.5L19 9l-4.5 3.5L16 18l-4-3-4 3 1.5-5.5L5 9l5.5-1.5z" fill={color} />
  </Svg>
);

const UsersIcon = ({ color = C.white, size = 13 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.8" />
    <Path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M16 4.5a3.2 3.2 0 010 6.3M19 20c0-2.6-1.7-4.8-4-5.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const DownArrowIcon = ({ color = C.accent, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4v15M5 12l7 7 7-7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TrashIcon = ({ color = C.danger, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6h14z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CopyIcon = ({ color = C.dark, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="9" width="12" height="12" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ════════════════════════════════════════════════════════════════════════════
//  WAVEFORM (animated playback)
// ════════════════════════════════════════════════════════════════════════════
const Waveform = ({ played = 0 }: { played?: number }) => {
  const bars = useMemo(
    () => [8, 14, 20, 16, 28, 18, 12, 24, 10, 20, 30, 14, 22, 8, 18, 26, 12, 20, 10, 28, 16, 22, 18, 14],
    []
  );
  return (
    <View style={wv.container}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            wv.bar,
            { height: rs(h) },
            i / bars.length < played ? wv.barPlayed : wv.barUnplayed,
          ]}
        />
      ))}
    </View>
  );
};
const wv = StyleSheet.create({
  container:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(2) },
  bar:         { flex: 1, borderRadius: rs(2) },
  barPlayed:   { backgroundColor: C.white },
  barUnplayed: { backgroundColor: 'rgba(255,255,255,0.35)' },
});

// ════════════════════════════════════════════════════════════════════════════
//  STATUS PILL — sending / sent / delivered / failed, with recipient count
// ════════════════════════════════════════════════════════════════════════════
const StatusRow = ({ msg, onRetry }: { msg: BroadcastMessage; onRetry: () => void }) => {
  if (msg.status === 'sending') {
    return (
      <View style={srow.wrap}>
        <ActivityIndicator size="small" color={C.bubbleOutSub} style={{ width: rs(13), height: rs(13) }} />
        <Text style={srow.timeText}>{msg.timestamp}</Text>
      </View>
    );
  }
  if (msg.status === 'failed') {
    return (
      <TouchableOpacity style={srow.wrap} onPress={onRetry} activeOpacity={0.7}>
        <RetryIcon color="#FFD9D9" size={13} />
        <Text style={[srow.timeText, { color: '#FFD9D9', fontWeight: '700' }]}>Tap to retry</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={srow.wrap}>
      <UsersIcon color={C.bubbleOutSub} size={11} />
      <Text style={srow.timeText}>{msg.recipientCount}</Text>
      <Text style={srow.dot}>·</Text>
      <Text style={srow.timeText}>{msg.timestamp}</Text>
      <CheckIcon color={msg.status === 'delivered' ? '#BFEFE0' : C.bubbleOutSub} double={msg.status === 'delivered'} />
    </View>
  );
};
const srow = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: rs(4), marginTop: rs(5) },
  timeText: { fontSize: fs(10.5), color: C.bubbleOutSub, fontWeight: '600' },
  dot:      { fontSize: fs(10), color: C.bubbleOutSub },
});

// ════════════════════════════════════════════════════════════════════════════
//  DATE SEPARATOR
// ════════════════════════════════════════════════════════════════════════════
const DateSeparator = ({ label }: { label: string }) => (
  <View style={ds.wrap}>
    <View style={ds.pill}>
      <Text style={ds.text}>{label}</Text>
    </View>
  </View>
);
const ds = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: rs(14) },
  pill: { backgroundColor: 'rgba(14,57,72,0.06)', borderRadius: rs(20), paddingHorizontal: rs(14), paddingVertical: rs(5) },
  text: { fontSize: fs(10.5), fontWeight: '700', color: C.muted, letterSpacing: 0.3 },
});

// ════════════════════════════════════════════════════════════════════════════
//  AUDIO BUBBLE (inline player)
// ════════════════════════════════════════════════════════════════════════════
const AudioBubble = ({ msg }: { msg: BroadcastMessage }) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [loading, setLoading] = useState(false);
  const totalDur = msg.duration ?? '0:00';
  const audioUri = msg.remoteUrl ?? msg.mediaUri;

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const onStatus = useCallback((status: any) => {
    if (!status.isLoaded) return;
    if (status.durationMillis) {
      setProgress(status.positionMillis / status.durationMillis);
      const secs = Math.floor(status.positionMillis / 1000);
      setCurrentTime(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    }
    if (status.didJustFinish) {
      setPlaying(false);
      setProgress(0);
      setCurrentTime('0:00');
      soundRef.current?.setPositionAsync(0);
    }
  }, []);

  const handlePlayPause = async () => {
    if (!audioUri) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (!soundRef.current) {
        setLoading(true);
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true }, onStatus);
        soundRef.current = sound;
        setLoading(false);
        setPlaying(true);
      } else {
        const status = (await soundRef.current.getStatusAsync()) as any;
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setPlaying(true);
        }
      }
    } catch (e) {
      setLoading(false);
      console.warn('Audio playback error:', e);
    }
  };

  return (
    <View style={mb.audioRow}>
      <TouchableOpacity style={mb.audioPlayBtn} onPress={handlePlayPause} activeOpacity={0.8}>
        {loading ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : playing ? (
          <PauseIcon color={C.white} size={13} />
        ) : (
          <PlayIcon color={C.white} size={13} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Waveform played={progress} />
      </View>
      <Text style={mb.audioDur}>{playing ? currentTime : totalDur}</Text>
    </View>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  MESSAGE BUBBLE — supports long-press actions (copy / delete / retry / pin)
// ════════════════════════════════════════════════════════════════════════════
const MessageBubble = ({
  msg,
  isPinned,
  onRetry,
  onDelete,
  onTogglePin,
  onPreviewImage,
  isStarred = false,
  onToggleStar,
  onEdit,
}: {
  msg: BroadcastMessage;
  isPinned: boolean;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onPreviewImage: (uri: string) => void;
  isStarred?: boolean;
  onToggleStar?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLongPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setMenuVisible(true);
  };

  const mediaSource = msg.remoteUrl ?? msg.mediaUri;

  const renderContent = () => {
    switch (msg.type) {
      case 'text':
        return <Text style={mb.text}>{msg.text}</Text>;

      case 'image':
        return (
          <View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => mediaSource && onPreviewImage(mediaSource)}>
              {mediaSource ? (
                <Image source={{ uri: mediaSource }} style={mb.mediaImg} resizeMode="cover" />
              ) : (
                <View style={[mb.mediaImg, mb.mediaPlaceholder]}>
                  <ImagePickIcon color={C.white} />
                </View>
              )}
            </TouchableOpacity>
            {msg.caption ? <Text style={mb.caption}>{msg.caption}</Text> : null}
          </View>
        );

      case 'video':
        return (
          <View>
            <View style={[mb.mediaImg, mb.videoThumb]}>
              <View style={mb.videoPlayCircle}>
                <PlayIcon color={C.white} size={20} />
              </View>
              {msg.duration ? (
                <View style={mb.videoDurBadge}>
                  <Text style={mb.videoDurText}>{msg.duration}</Text>
                </View>
              ) : null}
            </View>
            {msg.caption ? <Text style={mb.caption}>{msg.caption}</Text> : null}
          </View>
        );

      case 'audio':
        return (
          <View>
            {msg.text ? <Text style={mb.audioLabel} numberOfLines={1}>{msg.text}</Text> : null}
            <AudioBubble msg={msg} />
          </View>
        );

      case 'document':
      case 'pdf':
        return (
          <View style={mb.fileRow}>
            <View style={[mb.fileIconBox, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              {msg.type === 'pdf' ? <PdfIcon color={C.white} /> : <FileIcon color={C.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mb.fileName} numberOfLines={2}>{msg.fileName}</Text>
              <Text style={mb.fileSize}>{msg.fileSize}</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const canCopy = msg.type === 'text' && !!msg.text;

  return (
    <View style={mb.row}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], maxWidth: '84%' }}>
        <View style={{ position: 'relative' }}>
          {isStarred && <Text style={{ position: 'absolute', top: rs(-8), left: rs(-8), fontSize: rs(16), zIndex: 10 }}>⭐</Text>}
          <TouchableOpacity activeOpacity={0.95} onLongPress={handleLongPress} delayLongPress={280}>
            <View
              style={[
                mb.bubble,
                msg.status === 'failed' && mb.bubbleFailed,
                isPinned && mb.bubblePinned,
              ]}
            >
              {isPinned && (
                <View style={mb.pinTag}>
                  <PinIcon color={C.white} size={10} />
                  <Text style={mb.pinTagText}>Pinned</Text>
                </View>
              )}
              {renderContent()}
              <StatusRow msg={msg} onRetry={() => onRetry(msg.id)} />
              {msg.status === 'failed' && msg.errorMessage ? (
                <Text style={mb.errorText} numberOfLines={2}>{msg.errorMessage}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Long-press action sheet */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={mb.menuOverlay}>
            <View style={mb.menuCard}>
              {canCopy && (
                <TouchableOpacity
                  style={mb.menuItem}
                  onPress={() => setMenuVisible(false)}
                  activeOpacity={0.7}
                >
                  <CopyIcon size={17} />
                  <Text style={mb.menuItemText}>Copy text</Text>
                </TouchableOpacity>
              )}
              {msg.type === 'text' && (
                <TouchableOpacity
                  style={mb.menuItem}
                  onPress={() => { setMenuVisible(false); onEdit?.(msg.id, msg.text || ''); }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: fs(16) }}>✏️</Text>
                  <Text style={mb.menuItemText}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={mb.menuItem}
                onPress={() => { setMenuVisible(false); onToggleStar?.(msg.id); }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: fs(16) }}>{isStarred ? '⭐' : '☆'}</Text>
                <Text style={mb.menuItemText}>{isStarred ? 'Unstar' : 'Star'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={mb.menuItem}
                onPress={() => { setMenuVisible(false); onTogglePin(msg.id); }}
                activeOpacity={0.7}
              >
                <PinIcon color={C.dark} size={16} />
                <Text style={mb.menuItemText}>{isPinned ? 'Unpin message' : 'Pin message'}</Text>
              </TouchableOpacity>
              {msg.status === 'failed' && (
                <TouchableOpacity
                  style={mb.menuItem}
                  onPress={() => { setMenuVisible(false); onRetry(msg.id); }}
                  activeOpacity={0.7}
                >
                  <RetryIcon color={C.dark} size={16} />
                  <Text style={mb.menuItemText}>Retry send</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[mb.menuItem, { borderBottomWidth: 0 }]}
                onPress={() => { setMenuVisible(false); Alert.alert('Delete', 'Delete for me, or for everyone?', [
                  { text: 'Delete for Me', onPress: () => onDelete(msg.id) },
                  { text: 'Delete for Everyone', onPress: () => onDelete(msg.id) },
                  { text: 'Cancel', style: 'cancel' },
                ]); }}
                activeOpacity={0.7}
              >
                <TrashIcon size={16} />
                <Text style={[mb.menuItemText, { color: C.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const mb = StyleSheet.create({
  row:    { alignItems: 'flex-end', marginBottom: rs(10), paddingHorizontal: rs(2) },
  bubble: {
    backgroundColor: C.bubbleOut,
    borderRadius: rs(18),
    borderBottomRightRadius: rs(5),
    paddingVertical: rs(9),
    paddingHorizontal: rs(12),
    shadowColor: C.accentDeep,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.12,
    shadowRadius: rs(5),
    elevation: 2,
  },
  bubbleFailed: { backgroundColor: '#C25555' },
  bubblePinned: { borderWidth: 1.4, borderColor: C.amber },
  pinTag:       { flexDirection: 'row', alignItems: 'center', gap: rs(4), marginBottom: rs(5) },
  pinTagText:   { fontSize: fs(9.5), fontWeight: '800', color: C.white, letterSpacing: 0.4, textTransform: 'uppercase' },

  text: { fontSize: fs(14), color: C.bubbleOutText, lineHeight: fs(20) },
  errorText: { fontSize: fs(10.5), color: '#FFE0E0', marginTop: rs(4) },

  mediaImg: { width: SCREEN_W * 0.6, height: SCREEN_W * 0.42, borderRadius: rs(13) },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentDeep },
  caption: { fontSize: fs(13), color: C.bubbleOutText, lineHeight: fs(18), marginTop: rs(7) },

  videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentDeep },
  videoPlayCircle: { width: rs(46), height: rs(46), borderRadius: rs(23), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  videoDurBadge: { position: 'absolute', bottom: rs(8), right: rs(10), backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: rs(5), paddingHorizontal: rs(6), paddingVertical: rs(2) },
  videoDurText: { fontSize: fs(10), color: C.white, fontWeight: '600' },

  audioRow: { flexDirection: 'row', alignItems: 'center', gap: rs(9), minWidth: SCREEN_W * 0.48, paddingVertical: rs(2) },
  audioPlayBtn: { width: rs(34), height: rs(34), borderRadius: rs(17), backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  audioDur: { fontSize: fs(11), color: C.bubbleOutSub, fontWeight: '600', flexShrink: 0 },
  audioLabel: { fontSize: fs(12), color: C.bubbleOutText, fontWeight: '600', marginBottom: rs(5) },

  fileRow: { flexDirection: 'row', alignItems: 'center', gap: rs(11), minWidth: SCREEN_W * 0.5 },
  fileIconBox: { width: rs(40), height: rs(40), borderRadius: rs(11), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileName: { fontSize: fs(13), fontWeight: '600', color: C.bubbleOutText, marginBottom: rs(2) },
  fileSize: { fontSize: fs(11), color: C.bubbleOutSub },

  menuOverlay: { flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(40) },
  menuCard: { backgroundColor: C.white, borderRadius: rs(16), paddingVertical: rs(6), width: '100%', overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: rs(12), paddingHorizontal: rs(16), paddingVertical: rs(13), borderBottomWidth: 0.6, borderBottomColor: C.border },
  menuItemText: { fontSize: fs(14), color: C.dark, fontWeight: '600' },
});

// ════════════════════════════════════════════════════════════════════════════
//  ATTACH MENU
// ════════════════════════════════════════════════════════════════════════════
const AttachMenu = ({
  visible,
  onClose,
  onSelectType,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: 'image' | 'video' | 'audio' | 'document' | 'pdf') => void;
}) => {
  const slideAnim = useRef(new Animated.Value(320)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 68, friction: 11, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 320, duration: 200, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const ITEMS = [
    { label: 'Photo', sub: 'Camera or Gallery', type: 'image' as const, icon: <ImagePickIcon />, bg: C.accentSoft },
    { label: 'Video', sub: 'Camera or Library', type: 'video' as const, icon: <VideoPickIcon />, bg: 'rgba(224,138,60,0.12)' },
    { label: 'Audio', sub: 'Voice or File', type: 'audio' as const, icon: <MicIcon color={C.audio} />, bg: 'rgba(155,107,196,0.12)' },
    { label: 'Document', sub: '.docx  .xlsx  .pptx', type: 'document' as const, icon: <FileIcon color={C.doc} />, bg: 'rgba(61,127,224,0.12)' },
    { label: 'PDF', sub: '.pdf file', type: 'pdf' as const, icon: <PdfIcon />, bg: C.dangerSoft },
  ];

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[am.overlay, { opacity: opacAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <Animated.View style={[am.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={am.handle} />
          <Text style={am.title}>Send to all parents</Text>
          <View style={am.grid}>
            {ITEMS.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={am.item}
                onPress={() => { onClose(); onSelectType(item.type); }}
                activeOpacity={0.75}
              >
                <View style={[am.iconBox, { backgroundColor: item.bg }]}>{item.icon}</View>
                <Text style={am.itemLabel}>{item.label}</Text>
                <Text style={am.itemSub}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
const am = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), paddingTop: rs(10), paddingHorizontal: rs(20), paddingBottom: rs(34) },
  handle: { width: rs(40), height: rs(4), backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: rs(2), alignSelf: 'center', marginBottom: rs(18) },
  title: { fontSize: fs(13), fontWeight: '700', color: C.muted, textAlign: 'center', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: rs(20) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(12) },
  item: { width: (SCREEN_W - rs(40) - rs(48)) / 3, alignItems: 'center', gap: rs(6) },
  iconBox: { width: rs(56), height: rs(56), borderRadius: rs(18), alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: fs(12), fontWeight: '700', color: C.dark },
  itemSub: { fontSize: fs(9.5), color: C.muted, textAlign: 'center' },
});

// ════════════════════════════════════════════════════════════════════════════
//  CAPTION MODAL
// ════════════════════════════════════════════════════════════════════════════
const CaptionModal = ({
  visible,
  type,
  onSend,
  onCancel,
}: {
  visible: boolean;
  type: MsgType;
  onSend: (caption: string) => void;
  onCancel: () => void;
}) => {
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (visible) setCaption('');
  }, [visible]);

  const label: Record<MsgType, string> = {
    image: 'Photo selected',
    video: 'Video selected',
    audio: 'Audio file selected',
    document: 'Document selected',
    pdf: 'PDF selected',
    text: '',
  };

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={cm.overlay}>
          <View style={cm.card}>
            <Text style={cm.fileLabel}>{label[type]}</Text>
            <TextInput
              style={cm.input}
              placeholder="Add a caption (optional)…"
              placeholderTextColor={C.mutedLight}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={300}
            />
            <View style={cm.btnRow}>
              <TouchableOpacity style={cm.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                <Text style={cm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.sendBtn} onPress={() => onSend(caption)} activeOpacity={0.8}>
                <Text style={cm.sendText}>Send to all</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(28) },
  card: { backgroundColor: C.white, borderRadius: rs(20), padding: rs(20), width: '100%' },
  fileLabel: { fontSize: fs(13), fontWeight: '700', color: C.dark, marginBottom: rs(12) },
  input: { fontSize: fs(13), color: C.dark, backgroundColor: C.bg, borderRadius: rs(12), padding: rs(12), minHeight: rs(60), maxHeight: rs(120), borderWidth: 0.8, borderColor: C.border },
  btnRow: { flexDirection: 'row', gap: rs(10), marginTop: rs(16) },
  cancelBtn: { flex: 1, paddingVertical: rs(12), borderRadius: rs(12), alignItems: 'center', backgroundColor: C.bg },
  cancelText: { fontSize: fs(13), fontWeight: '700', color: C.muted },
  sendBtn: { flex: 1.4, paddingVertical: rs(12), borderRadius: rs(12), alignItems: 'center', backgroundColor: C.accent },
  sendText: { fontSize: fs(13), fontWeight: '700', color: C.white },
});

// ════════════════════════════════════════════════════════════════════════════
//  IMAGE PREVIEW MODAL (full-screen tap-to-zoom-ish viewer)
// ════════════════════════════════════════════════════════════════════════════
const ImagePreviewModal = ({ uri, onClose }: { uri: string | null; onClose: () => void }) => (
  <Modal transparent visible={!!uri} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={ip.overlay}>
      <TouchableOpacity style={ip.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <CloseIcon color={C.white} size={22} />
      </TouchableOpacity>
      {uri ? (
        <Image source={{ uri }} style={ip.image} resizeMode="contain" />
      ) : null}
    </View>
  </Modal>
);
const ip = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: rs(50), right: rs(20), width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  image: { width: SCREEN_W, height: SCREEN_H * 0.7 },
});

// ════════════════════════════════════════════════════════════════════════════
//  PINNED MESSAGE BANNER
// ════════════════════════════════════════════════════════════════════════════
const PinnedBanner = ({
  message,
  onPress,
  onUnpin,
}: {
  message: BroadcastMessage;
  onPress: () => void;
  onUnpin: () => void;
}) => {
  const preview =
    message.type === 'text'
      ? message.text
      : message.type === 'image'
        ? `Photo${message.caption ? ` · ${message.caption}` : ''}`
        : message.type === 'video'
          ? `Video${message.caption ? ` · ${message.caption}` : ''}`
          : message.type === 'audio'
            ? 'Voice note'
            : message.fileName ?? 'Attachment';

  return (
    <TouchableOpacity style={pn.wrap} onPress={onPress} activeOpacity={0.85}>
      <PinIcon size={14} />
      <View style={{ flex: 1, marginLeft: rs(8) }}>
        <Text style={pn.label}>Pinned message</Text>
        <Text style={pn.preview} numberOfLines={1}>{preview}</Text>
      </View>
      <TouchableOpacity onPress={onUnpin} style={pn.closeBtn} activeOpacity={0.7}>
        <CloseIcon color={C.muted} size={15} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};
const pn = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.amberSoft, paddingHorizontal: rs(14), paddingVertical: rs(9), borderBottomWidth: 0.8, borderBottomColor: C.borderMid },
  label: { fontSize: fs(9.5), fontWeight: '800', color: C.amber, letterSpacing: 0.4, textTransform: 'uppercase' },
  preview: { fontSize: fs(12), color: C.dark, fontWeight: '500', marginTop: rs(1) },
  closeBtn: { padding: rs(4) },
});

// ════════════════════════════════════════════════════════════════════════════
//  COMPOSE BAR
// ════════════════════════════════════════════════════════════════════════════
const EMOJI_CATEGORIES = [
  {
    key: 'smileys',
    icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🥹']
  },
  {
    key: 'people',
    icon: '👋',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🙏','✍️','💅','🤳','💪','🧑','👶','👧','🧒','👦','👩','🧑‍🦱','👨','🧓','👴','👵','🙋','🙆','🙅','💁','🙇','🤦','🤷']
  },
  {
    key: 'animals',
    icon: '🐶',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🐢','🐍','🦎','🐙','🦑','🦀','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐘','🦒','🐫','🐄','🐑','🐐']
  },
  {
    key: 'food',
    icon: '🍎',
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥦','🥕','🌽','🥔','🍞','🥐','🧀','🥚','🍳','🥞','🧇','🥓','🍗','🍔','🍟','🍕','🌭','🌮','🌯','🥙','🍲','🍜','🍝','🍣','🍱','🍙','🍚','🍦','🍩','🍪','🎂','🍰','🍫','🍬','🍭','☕','🍵','🥤','🧃','🍺','🍷']
  },
  {
    key: 'activities',
    icon: '⚽',
    emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🏒','🏑','🥍','🏏','⛳','🪁','🎣','🤿','🥊','🥋','🎽','🛹','🎿','⛷️','🏂','🏋️','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🚣','🧗','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎮','🎲','🧩','🎯','🎳','🎨','🎭','🎬','🎤','🎧','🎼','🎹','🎸','🥁']
  },
  {
    key: 'travel',
    icon: '✈️',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛵','🏍️','🚲','🛴','🚨','🚔','🚍','🚘','🚖','🚡','🚟','🚃','🚞','🚄','🚅','🚈','🚂','🚆','🚇','🚊','✈️','🛫','🛬','🛩️','💺','🚀','🛸','🚁','⛵','🚤','🛳️','⛴️','🚢','⚓','🏠','🏫','🏥','🏦','⛪','🕌','🗽','🗼','🏰','🎡','🎢']
  },
  {
    key: 'objects',
    icon: '💡',
    emojis: ['⌚','📱','💻','⌨️','🖥️','🖨️','📷','📸','🎥','📞','☎️','📺','📻','🔋','🔌','💡','🔦','🕯️','💰','💵','💳','⚖️','🔧','🔨','⚙️','🔩','🧲','🔫','💣','🔪','🗡️','🛡️','🚪','🪑','🛏️','🚽','🚿','🛁','🧴','🧹','🧺','🧻','🧼','🔑','🔒','🔓','📎','📌','📍','✂️','📏','📐','📅','📆','📖','📚','📝','✉️','📦']
  },
  {
    key: 'symbols',
    icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💯','✅','❌','❓','❗','⭐','🌟','✨','🔥','💧','⚡','☀️','🌙','☁️','⛄','🔔','🎉','🎊','🎈','🎁','🏆','🚩','📌','🔁','▶️','⏸️','⏹️','🆕','🆗','♻️','⚠️','🚫','🔞','🔢','🔤']
  },
];
const ComposeBar = ({
  onSendText,
  onAttach,
  onRecordAudio,
  showEmoji,
  onToggleEmoji,
}: {
  onSendText: (text: string) => void;
  onAttach: () => void;
  onRecordAudio: () => void;
  showEmoji: boolean;
  onToggleEmoji: () => void;
}) => {
  const [text, setText] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const hasText = text.trim().length > 0;

  const handleSend = () => {
    if (!hasText) return;
    onSendText(text.trim());
    setText('');
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  return (
    <View>
      {showEmoji && (
        <View style={cb.emojiPanel}>
          <View style={cb.emojiTabs}>
            {EMOJI_CATEGORIES.map((cat, i) => (
              <TouchableOpacity
                key={cat.key}
                style={[cb.emojiTab, activeCategory === i && cb.emojiTabActive]}
                onPress={() => setActiveCategory(i)}
                activeOpacity={0.7}
              >
                <Text style={cb.emojiTabIcon}>{cat.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={cb.emojiGrid}>
            {EMOJI_CATEGORIES[activeCategory].emojis.map((e, i) => (
              <TouchableOpacity key={i} style={cb.emojiItem} onPress={() => insertEmoji(e)} activeOpacity={0.6}>
                <Text style={cb.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={cb.wrap}>
        <TouchableOpacity style={cb.iconBtn} onPress={onAttach} activeOpacity={0.75}>
          <PlusIcon />
        </TouchableOpacity>
        <View style={cb.inputWrap}>
          <TextInput
            style={cb.input}
            placeholder="Message all parents…"
            placeholderTextColor={C.mutedLight}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
        <TouchableOpacity
            style={cb.emojiBtn}
            activeOpacity={0.75}
            onPress={onToggleEmoji}
          >
            <EmojiIcon />
          </TouchableOpacity>
        </View>
        {hasText ? (
          <TouchableOpacity style={cb.sendBtn} onPress={handleSend} activeOpacity={0.85}>
            <SendIcon active />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={cb.micBtn} onPress={onRecordAudio} activeOpacity={0.85}>
            <MicIcon />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
const cb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8), paddingHorizontal: rs(10), paddingVertical: rs(8), backgroundColor: C.white, borderTopWidth: 0.8, borderTopColor: C.border },
  iconBtn: { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(1) },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.bg, borderRadius: rs(22), paddingLeft: rs(14), paddingRight: rs(6), paddingVertical: rs(6), borderWidth: 0.8, borderColor: C.border },
  input: { flex: 1, fontSize: fs(13.5), color: C.dark, maxHeight: rs(110), paddingRight: rs(4) },
  emojiBtn: { width: rs(32), height: rs(32), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtn: { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(1) },
  micBtn: { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(1) },
 emojiPanel: { height: rs(260), backgroundColor: C.white, borderTopWidth: 0.8, borderTopColor: C.border },
  emojiTabs: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: C.border, paddingVertical: rs(6), paddingHorizontal: rs(4) },
  emojiTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: rs(6), borderRadius: rs(8) },
  emojiTabActive: { backgroundColor: C.accentLight },
  emojiTabIcon: { fontSize: fs(18) },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: rs(6), paddingTop: rs(8), paddingBottom: rs(12) },
  emojiItem: { width: rs(44), height: rs(44), alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: fs(22) },
});

// ════════════════════════════════════════════════════════════════════════════
//  RECORDING BAR
// ════════════════════════════════════════════════════════════════════════════
const RecordingBar = ({ onStop, onCancel }: { onStop: () => void; onCancel: () => void }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const loop = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start(loop);
    };
    loop();
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      pulseAnim.stopAnimation();
      clearInterval(timer);
    };
  }, []);

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <View style={rb.wrap}>
      <Animated.View style={[rb.dot, { transform: [{ scale: pulseAnim }] }]} />
      <Text style={rb.timer}>{fmt(elapsed)}</Text>
      <Text style={rb.label}>Recording…</Text>
      <TouchableOpacity style={rb.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
        <Text style={rb.cancelText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={rb.stopBtn} onPress={onStop} activeOpacity={0.8}>
        <Text style={rb.stopText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};
const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: rs(10), paddingHorizontal: rs(14), paddingVertical: rs(12), backgroundColor: C.white, borderTopWidth: 0.8, borderTopColor: C.border },
  dot: { width: rs(10), height: rs(10), borderRadius: rs(5), backgroundColor: C.danger },
  timer: { fontSize: fs(14), fontWeight: '700', color: C.dark, minWidth: rs(44) },
  label: { flex: 1, fontSize: fs(12), color: C.muted },
  cancelBtn: { paddingHorizontal: rs(10), paddingVertical: rs(8) },
  cancelText: { fontSize: fs(12), fontWeight: '600', color: C.muted },
  stopBtn: { backgroundColor: C.accent, borderRadius: rs(16), paddingHorizontal: rs(16), paddingVertical: rs(8) },
  stopText: { fontSize: fs(12), fontWeight: '700', color: C.white },
});

// ════════════════════════════════════════════════════════════════════════════
//  SCROLL-TO-BOTTOM FAB
// ════════════════════════════════════════════════════════════════════════════
const ScrollToBottomFab = ({ visible, onPress, unread }: { visible: boolean; onPress: () => void; unread: number }) => {
  if (!visible) return null;
  return (
    <TouchableOpacity style={fab.wrap} onPress={onPress} activeOpacity={0.85}>
      <DownArrowIcon size={18} />
      {unread > 0 && (
        <View style={fab.badge}>
          <Text style={fab.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
const fab = StyleSheet.create({
  wrap: { position: 'absolute', right: rs(14), bottom: rs(14), width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: rs(6), elevation: 4 },
  badge: { position: 'absolute', top: -rs(4), right: -rs(4), minWidth: rs(18), height: rs(18), borderRadius: rs(9), backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(4) },
  badgeText: { fontSize: fs(9), fontWeight: '800', color: C.white },
});

// ════════════════════════════════════════════════════════════════════════════
//  SEARCH OVERLAY — search within sent broadcast history
// ════════════════════════════════════════════════════════════════════════════
const SearchOverlay = ({
  visible,
  messages,
  onClose,
  onJumpTo,
}: {
  visible: boolean;
  messages: BroadcastMessage[];
  onClose: () => void;
  onJumpTo: (id: string) => void;
}) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      const haystack = [m.text, m.caption, m.fileName].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [query, messages]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

if (!visible) return null;

  return (
    <SafeAreaView style={so.wrap} edges={['top']}>
      <View style={so.searchBar}>
        <SearchIcon color={C.muted} size={17} />
        <TextInput
          style={so.input}
          placeholder="Search sent messages…"
          placeholderTextColor={C.mutedLight}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <CloseIcon color={C.muted} size={18} />
        </TouchableOpacity>
      </View>
      <ScrollView style={so.results} keyboardShouldPersistTaps="handled">
        {query.trim().length > 0 && results.length === 0 && (
          <Text style={so.empty}>No messages found</Text>
        )}
        {results.map((m) => (
          <TouchableOpacity key={m.id} style={so.resultRow} onPress={() => onJumpTo(m.id)} activeOpacity={0.7}>
            <Text style={so.resultText} numberOfLines={2}>
              {m.text || m.caption || m.fileName || `[${m.type}]`}
            </Text>
            <Text style={so.resultMeta}>{m.timestamp}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};
const so = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 50 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.white, paddingHorizontal: rs(16), paddingVertical: rs(12), borderBottomWidth: 0.8, borderBottomColor: C.border },
  input: { flex: 1, fontSize: fs(14), color: C.dark },
  results: { flex: 1 },
  empty: { textAlign: 'center', marginTop: rs(40), color: C.muted, fontSize: fs(13) },
  resultRow: { paddingHorizontal: rs(16), paddingVertical: rs(12), borderBottomWidth: 0.6, borderBottomColor: C.border },
  resultText: { fontSize: fs(13.5), color: C.dark, lineHeight: fs(19) },
  resultMeta: { fontSize: fs(10.5), color: C.muted, marginTop: rs(3) },
});

// ════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ════════════════════════════════════════════════════════════════════════════
export const BroadcastChatScreen = ({ route }: any) => {
  const classLabel = route?.params?.classLabel ?? 'Class 1A';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // ── Message state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<BroadcastMessage | null>(null);
  const [menuVis, setMenuVis] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // ── Compose / modal state ────────────────────────────────────────────────
  const [attachVisible, setAttachVisible] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [pendingType, setPendingType] = useState<MsgType>('image');
  const [pendingMedia, setPendingMedia] = useState<Partial<BroadcastMessage> | null>(null);
  const [recording, setRecording] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // ── Scroll / unread tracking ─────────────────────────────────────────────
  const [showFab, setShowFab] = useState(false);
  const [unreadBelow, setUnreadBelow] = useState(0);
  const isAtBottomRef = useRef(true);

  // ── API / auth state ─────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── Load local history + teacher/contacts on mount ──────────────────────
  useEffect(() => {
    (async () => {
      const local = await loadLocalHistory();
      setMessages(local);
      setHistoryLoaded(true);
    })();

    (async () => {
      try {
        setContactsLoading(true);
        setContactsError(null);

        const user = await getStoredUser();
        if (!user) {
          setContactsError('Session expired. Please log in again.');
          return;
        }
        setTeacherId(user.id);

        const list = await fetchContacts();
        setContacts(list);
      } catch (err: any) {
        console.warn('fetchContacts error:', err);
        setContactsError(err?.message ?? 'Failed to load student list');
      } finally {
        setContactsLoading(false);
      }
    })();
  }, []);

  // ── Persist history whenever messages change (after initial load) ───────
  useEffect(() => {
    if (!historyLoaded) return;
    saveLocalHistory(messages);
  }, [messages, historyLoaded]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const scrollToBottom = (animated = true) => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 80);
    setUnreadBelow(0);
    isAtBottomRef.current = true;
    setShowFab(false);
  };

  const handleScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const atBottom = distanceFromBottom < rs(60);
    isAtBottomRef.current = atBottom;
    setShowFab(!atBottom && messages.length > 0);
    if (atBottom) setUnreadBelow(0);
  };

  // ── Core send pipeline: optimistic insert → API call → status update ────
  const studentIds = useMemo(() => contacts.map((c) => c.id), [contacts]);

  const buildContent = (msg: Omit<BroadcastMessage, 'id' | 'timestamp' | 'isoDate' | 'status' | 'recipientCount'>) => {
    if (msg.type === 'text') return msg.text ?? '';
    if (msg.type === 'audio') return `[Voice note]${msg.remoteUrl ? ' ' + msg.remoteUrl : ''}`;
    if (msg.type === 'image') return `[Photo]${msg.caption ? ' ' + msg.caption : ''}${msg.remoteUrl ? ' ' + msg.remoteUrl : ''}`;
    if (msg.type === 'video') return `[Video]${msg.caption ? ' ' + msg.caption : ''}${msg.remoteUrl ? ' ' + msg.remoteUrl : ''}`;
    return `[File] ${msg.fileName ?? ''}${msg.remoteUrl ? ' ' + msg.remoteUrl : ''}`;
  };

  const dispatchSend = async (msgId: string, content: string) => {
    if (!teacherId) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed', errorMessage: 'Teacher ID not found. Please log in again.' } : m)));
      return;
    }
    if (contactsError || studentIds.length === 0) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed', errorMessage: 'Student list unavailable. Cannot send.' } : m)));
      return;
    }
    try {
      await sendBulkMessage({ teacher_id: teacherId, student_ids: studentIds, content });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sent', recipientCount: studentIds.length } : m)));
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'delivered' } : m)));
      }, 1800);
    } catch (err: any) {
      console.warn('sendBulkMessage error:', err);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed', errorMessage: err?.message ?? 'Send failed. Tap to retry.' } : m)));
    }
  };

  const insertOptimistic = (
    partial: Omit<BroadcastMessage, 'id' | 'timestamp' | 'isoDate' | 'status' | 'recipientCount'>
  ): BroadcastMessage => {
    const msg: BroadcastMessage = {
      ...partial,
      id: `m_${Date.now()}_${Math.round(Math.random() * 1000)}`,
      timestamp: now(),
      isoDate: new Date().toISOString(),
      status: 'sending',
      recipientCount: studentIds.length,
    };
    setMessages((prev) => [...prev, msg]);
    if (isAtBottomRef.current) {
      scrollToBottom();
    } else {
      setUnreadBelow((u) => u + 1);
      setShowFab(true);
    }
    return msg;
  };

  const handleSendText = (text: string) => {
    if (contactsLoading) {
      Alert.alert('Loading', 'Student list is still loading. Please wait a moment.');
      return;
    }
    const msg = insertOptimistic({ type: 'text', text });
    dispatchSend(msg.id, buildContent({ type: 'text', text }));
  };

  const handleSendMedia = async (caption: string) => {
    setCaptionVisible(false);
    if (!pendingMedia) return;
    if (contactsLoading) {
      Alert.alert('Loading', 'Student list is still loading. Please wait a moment.');
      return;
    }

    const basePartial = { ...pendingMedia, caption } as Omit<
      BroadcastMessage,
      'id' | 'timestamp' | 'isoDate' | 'status' | 'recipientCount'
    >;
    const msg = insertOptimistic(basePartial);
    setPendingMedia(null);

    // Upload the file first (if there's a local mediaUri to upload), then send.
    try {
      if (msg.mediaUri && teacherId) {
        if (studentIds.length === 0) {
          throw new Error('No recipients available — cannot create an upload room.');
        }
        const mime =
          msg.type === 'image' ? 'image/jpeg'
          : msg.type === 'video' ? 'video/mp4'
          : msg.type === 'pdf' ? 'application/pdf'
          : msg.type === 'audio' ? 'audio/m4a'
          : 'application/octet-stream';
        const { url } = await uploadChatFile({
          teacherId,
          fallbackStudentId: studentIds[0],
          senderId: teacherId,
          uri: msg.mediaUri,
          name: msg.fileName ?? `upload_${Date.now()}`,
          mimeType: mime,
        });
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, remoteUrl: url } : m)));
        await dispatchSend(msg.id, buildContent({ ...basePartial, remoteUrl: url }));
      } else {
        await dispatchSend(msg.id, buildContent(basePartial));
      }
    } catch (err: any) {
      console.warn('uploadChatFile error:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed', errorMessage: err?.message ?? 'Upload failed.' } : m))
      );
    }
  };

  const handleRetry = (id: string) => {
    const target = messages.find((m) => m.id === id);
    if (!target) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'sending', errorMessage: undefined } : m)));
    dispatchSend(id, buildContent(target));
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete message', 'Remove this message from your local history? This does not unsend it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setMessages((prev) => prev.filter((m) => m.id !== id));
          if (pinnedId === id) setPinnedId(null);
        },
      },
    ]);
  };

  const handleTogglePin = (id: string) => setPinnedId((prev) => (prev === id ? null : id));

  const handleJumpToPinned = () => {
    // Best-effort: scroll to bottom since we don't track per-item layout offsets.
    scrollToBottom();
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication failed');
        return;
      }

      // Try to update via PUT first, fallback to POST if needed
      const updateResponse = await fetch(`${BASE_URL}/chat/messages/${editingId}/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: editText.trim() }),
      }).catch(async () => {
        // Fallback: Try POST to /chat/send/ with message_id
        return fetch(`${BASE_URL}/chat/send/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message_id: editingId,
            text: editText.trim(),
            message_type: 'edit',
          }),
        });
      });

      if (!updateResponse.ok) {
        throw new Error(`HTTP ${updateResponse.status}`);
      }

      // Update local message state
      setMessages(messages.map(msg =>
        msg.id === editingId ? { ...msg, text: editText.trim() } : msg
      ));

      setEditingId(null);
      setEditText('');
      Alert.alert('Success', 'Message updated');
    } catch (err) {
      console.error('Edit error:', err);
      Alert.alert('Error', 'Failed to update message');
    }
  };

  // ── Attachment picking ───────────────────────────────────────────────────
  const handleSelectType = async (type: 'image' | 'video' | 'audio' | 'document' | 'pdf') => {
    setAttachVisible(false);
    await new Promise((res) => setTimeout(res, 350));

    if (type === 'audio') {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setPendingMedia({ type: 'audio', mediaUri: file.uri, duration: '0:00', text: file.name, fileName: file.name });
      setPendingType('audio');
      setCaptionVisible(true);
      return;
    }

    if (type === 'image') {
      Alert.alert('Send Photo', 'Choose a source', [
        {
          text: 'Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
            if (result.canceled) return;
            setPendingMedia({ type: 'image', mediaUri: result.assets[0].uri, fileName: `photo_${Date.now()}.jpg` });
            setPendingType('image');
            setCaptionVisible(true);
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
            if (result.canceled) return;
            setPendingMedia({ type: 'image', mediaUri: result.assets[0].uri, fileName: `photo_${Date.now()}.jpg` });
            setPendingType('image');
            setCaptionVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    if (type === 'video') {
      Alert.alert('Send Video', 'Choose a source', [
        {
          text: 'Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 300 });
            if (result.canceled) return;
            const asset = result.assets[0];
            const d = asset.duration ? Math.round(asset.duration) : 0;
            setPendingMedia({
              type: 'video',
              mediaUri: asset.uri,
              duration: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`,
              fileName: `video_${Date.now()}.mp4`,
            });
            setPendingType('video');
            setCaptionVisible(true);
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 300 });
            if (result.canceled) return;
            const asset = result.assets[0];
            const d = asset.duration ? Math.round(asset.duration) : 0;
            setPendingMedia({
              type: 'video',
              mediaUri: asset.uri,
              duration: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`,
              fileName: `video_${Date.now()}.mp4`,
            });
            setPendingType('video');
            setCaptionVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    // document / pdf
    const mimeMap: Record<string, string | string[]> = {
      document: [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      pdf: 'application/pdf',
    };
    const result = await DocumentPicker.getDocumentAsync({ type: mimeMap[type], copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    const sizeKB = file.size ? `${Math.round(file.size / 1024)} KB` : '';
    setPendingMedia({ type, fileName: file.name, fileSize: sizeKB, mediaUri: file.uri });
    setPendingType(type);
    setCaptionVisible(true);
  };

  // ── Recording ─────────────────────────────────────────────────────────────
  const handleStartRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = rec;
      setRecording(true);
    } catch (e) {
      console.warn('Start recording error:', e);
      setRecording(true);
    }
  };

  const handleStopRecording = async () => {
    setRecording(false);
    let uri: string | undefined;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        uri = recordingRef.current.getURI() ?? undefined;
        recordingRef.current = null;
      }
    } catch (e) {
      console.warn('Stop recording error:', e);
    }
    if (!uri) return;
    const msg = insertOptimistic({ type: 'audio', duration: '0:00', text: 'Voice note', mediaUri: uri, fileName: `voice_${Date.now()}.m4a` });
    try {
      if (teacherId && studentIds.length > 0) {
        const { url } = await uploadChatFile({
          teacherId,
          fallbackStudentId: studentIds[0],
          senderId: teacherId,
          uri,
          name: msg.fileName ?? 'voice.m4a',
          mimeType: 'audio/m4a',
        });
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, remoteUrl: url } : m)));
        await dispatchSend(msg.id, buildContent({ type: 'audio', text: 'Voice note', remoteUrl: url } as any));
      } else {
        await dispatchSend(msg.id, buildContent({ type: 'audio', text: 'Voice note' } as any));
      }
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed', errorMessage: err?.message ?? 'Upload failed.' } : m)));
    }
  };

  const handleCancelRecording = async () => {
    setRecording(false);
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch {}
  };

  // ── Derived display values ───────────────────────────────────────────────
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const studentCount = contacts.length;
  const pinnedMsg = pinnedId ? messages.find((m) => m.id === pinnedId) ?? null : null;
  const [showEmoji, setShowEmoji] = useState(false);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />

      {/* Header */}
      <View
        style={[
          s.header,
          {
            paddingTop:
              insets.top > 0
                ? insets.top + rs(8)
                : Platform.OS === 'android'
                  ? (StatusBar.currentHeight ?? rs(20)) + rs(8)
                  : rs(50),
          },
        ]}
      >
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <MegaphoneIcon size={19} />
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{classLabel} Broadcast</Text>
          <View style={s.headerSubRow}>
            <UsersIcon size={11} />
            <Text style={s.headerSub}>
              {contactsLoading ? 'Loading recipients…' : contactsError ? 'Recipients unavailable' : `${studentCount} parents`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => setSearchVisible(true)} activeOpacity={0.8}>
          <SearchIcon />
        </TouchableOpacity>
      </View>

      {/* Notice / status bar */}
      {contactsLoading ? (
        <View style={[s.noticeBand, { flexDirection: 'row', justifyContent: 'center', gap: rs(8) }]}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={s.noticeText}>Loading recipient list…</Text>
        </View>
      ) : contactsError ? (
        <View style={[s.noticeBand, { backgroundColor: C.dangerSoft }]}>
          <Text style={[s.noticeText, { color: C.danger }]}>{contactsError}</Text>
        </View>
      ) : (
        <View style={s.noticeBand}>
          <MegaphoneIcon color={C.accent} size={12} />
          <Text style={s.noticeText}>
            One-way broadcast · visible to all {studentCount} parents in {classLabel}
          </Text>
        </View>
      )}

      {/* Pinned message banner */}
      {pinnedMsg && (
        <PinnedBanner message={pinnedMsg} onPress={handleJumpToPinned} onUnpin={() => setPinnedId(null)} />
      )}

      {/* Chat area */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (isAtBottomRef.current) scrollToBottom(false);
          }}
        >
          <DateSeparator label={`Today · ${todayLabel}`} />
          {messages.length === 0 && !contactsLoading && (
            <View style={s.emptyState}>
              <MegaphoneIcon color={C.muted} size={40} />
              <Text style={s.emptyTitle}>No broadcasts sent yet</Text>
              <Text style={s.emptySub}>Send a message, photo, or voice note to every parent in {classLabel} at once.</Text>
            </View>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isPinned={pinnedId === msg.id}
              isStarred={starred.has(msg.id)}
              onRetry={handleRetry}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onToggleStar={(id) => {
                const newStarred = new Set(starred);
                if (newStarred.has(id)) {
                  newStarred.delete(id);
                } else {
                  newStarred.add(id);
                }
                setStarred(newStarred);
              }}
              onEdit={(id, text) => {
                setEditingId(id);
                setEditText(text);
              }}
              onPreviewImage={setPreviewUri}
            />
          ))}
          <View style={{ height: rs(8) }} />
        </ScrollView>
        <ScrollToBottomFab visible={showFab} onPress={() => scrollToBottom()} unread={unreadBelow} />
        {showEmoji && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowEmoji(false)} />
        )}
      </View>

      {/* Compose / Recording */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : rs(4) }}>
          {recording ? (
            <RecordingBar onStop={handleStopRecording} onCancel={handleCancelRecording} />
          ) : (
            <ComposeBar
              onSendText={handleSendText}
              onAttach={() => setAttachVisible(true)}
              onRecordAudio={handleStartRecording}
              showEmoji={showEmoji}
              onToggleEmoji={() => setShowEmoji((v) => !v)}
            />          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modals & overlays */}
      <AttachMenu visible={attachVisible} onClose={() => setAttachVisible(false)} onSelectType={handleSelectType} />
      <CaptionModal visible={captionVisible} type={pendingType} onSend={handleSendMedia} onCancel={() => setCaptionVisible(false)} />
      <ImagePreviewModal uri={previewUri} onClose={() => setPreviewUri(null)} />
      <SearchOverlay
        visible={searchVisible}
        messages={messages}
        onClose={() => setSearchVisible(false)}
        onJumpTo={() => { setSearchVisible(false); scrollToBottom(); }}
      />

      {/* ── Edit Modal ── */}
      <Modal transparent visible={!!editingId} statusBarTranslucent animationType="fade" onRequestClose={() => setEditingId(null)}>
        <TouchableWithoutFeedback onPress={() => setEditingId(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: rs(20) }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: C.white, borderRadius: rs(16), paddingHorizontal: rs(16), paddingVertical: rs(20), width: '100%' }}>
                <Text style={{ fontSize: fs(16), fontWeight: 'bold', color: C.dark, marginBottom: rs(12) }}>Edit Message</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: rs(10),
                    paddingHorizontal: rs(12),
                    paddingVertical: rs(10),
                    fontSize: fs(14),
                    color: C.dark,
                    maxHeight: rs(120),
                    textAlignVertical: 'top',
                  }}
                  placeholder="Edit your message..."
                  placeholderTextColor={C.mutedLight}
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  maxLength={1000}
                />
                <View style={{ flexDirection: 'row', gap: rs(12), marginTop: rs(16), justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    style={{ paddingHorizontal: rs(16), paddingVertical: rs(10), borderRadius: rs(8), backgroundColor: C.border }}
                    onPress={() => setEditingId(null)}
                  >
                    <Text style={{ fontSize: fs(14), fontWeight: '600', color: C.dark }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ paddingHorizontal: rs(16), paddingVertical: rs(10), borderRadius: rs(8), backgroundColor: C.accent }}
                    onPress={handleSaveEdit}
                  >
                    <Text style={{ fontSize: fs(14), fontWeight: '600', color: C.white }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  SCREEN-LEVEL STYLES
// ════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgChat },
  header: {
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(12),
    paddingBottom: rs(13),
    gap: rs(10),
    shadowColor: C.accentDeep,
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.18,
    shadowRadius: rs(8),
    elevation: 6,
  },
  headerBtn: { width: rs(34), height: rs(34), borderRadius: rs(17), backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatar: { width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerInfo: { flex: 1, gap: rs(3) },
  headerName: { fontSize: fs(15.5), fontWeight: '700', color: C.white, letterSpacing: -0.1 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  headerSub: { fontSize: fs(11), color: 'rgba(255,255,255,0.78)', fontWeight: '500' },

  noticeBand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6), backgroundColor: C.accentLight, paddingHorizontal: rs(16), paddingVertical: rs(8), borderBottomWidth: 0.8, borderBottomColor: C.borderMid },
  noticeText: { fontSize: fs(11), color: C.accent, fontWeight: '500', textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: rs(12), paddingTop: rs(8), paddingBottom: rs(12) },

  emptyState: { alignItems: 'center', paddingTop: rs(70), paddingHorizontal: rs(36), gap: rs(10) },
  emptyTitle: { fontSize: fs(16), fontWeight: '700', color: C.dark },
  emptySub: { fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: fs(20) },
});

export default BroadcastChatScreen;
