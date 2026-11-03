import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    PixelRatio,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

// ─── Responsive Helpers ───────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (n: number) => Math.round(n * Math.min(scale, 1.5));
const fs = (n: number) => Math.round((n * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  accent:      '#0E7EA4',
  accentDark:  '#0A5F7A',
  accentLight: '#EDF6FA',
  accentMid:   '#1591B8',
  bg:          '#F2F5F7',
  white:       '#FFFFFF',
  dark:        '#1A2B35',
  muted:       '#7AA0B0',
  mutedLight:  '#9BBAC8',
  border:      'rgba(14,126,164,0.09)',
  borderMid:   'rgba(14,126,164,0.2)',
  bubbleOut:   '#DCF2EA',   // teacher (outgoing) — green
  bubbleIn:    '#E6F4F9',   // student (incoming) — blue-ish
  bubbleOutText: '#1A7A5E',
  success:     '#2ECC9A',
  danger:      '#E05A5A',
  overlay:     'rgba(0,0,0,0.45)',
  pdf:         '#E05A5A',
  doc:         '#2F80ED',
  audio:       '#9B59B6',
  video:       '#E67E22',
};

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://magnetpro.in/api';
const POLL_MS  = 8_000; // poll every 8s for new messages

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'pdf';
type MsgStatus = 'sending' | 'sent' | 'failed' | 'delivered' | 'read';

interface ChatMessage {
  id: string;
  type: MsgType;
  text?: string;
  mediaUri?: string;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  timestamp: string;       // display string e.g. "2:34 PM"
  isoTime: string;         // for grouping
  status: MsgStatus;
  isOutgoing: boolean;     // true = teacher sent it
}

interface StoredUser {
  id: number;
  token?: string;
  institution_id?: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function getStoredUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem('magnetpro_user');
    if (!raw) return null;
    const parsed: StoredUser = JSON.parse(raw);
    if (!parsed.institution_id) {
      const saved = await AsyncStorage.getItem('magnetpro_institution_id');
      if (saved) parsed.institution_id = saved;
    }
    return parsed;
  } catch { return null; }
}

function makeHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchHistory(roomId: string, studentId: string, page = 1): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const user = await getStoredUser();
  if (!user) return { messages: [], hasMore: false };

    if (!roomId || roomId === 'new') return { messages: [], hasMore: false };
  const pathParams = new URLSearchParams({ role: 'teacher', page: String(page) });
  const queryParams = new URLSearchParams({ role: 'teacher', room_id: roomId, page: String(page) });
  const urls = [
    `${BASE_URL}/chat/history/${encodeURIComponent(roomId)}/?${pathParams.toString()}`,
    `${BASE_URL}/chat/history/?${queryParams.toString()}`,
  ];

  let res: Response | null = null;
  for (const url of urls) {
    res = await fetch(url, {
      headers: makeHeaders(user.token),
    });
    if (res.ok || res.status !== 404) break;
  }

  if (!res?.ok) throw new Error(`History fetch failed (${res?.status ?? 'unknown'})`);
  const data = await res.json();

  const raw: any[] = Array.isArray(data) ? data
    : Array.isArray(data.results) ? data.results
    : Array.isArray(data.messages) ? data.messages
    : [];

  const hasMore = data.next != null || data.has_more === true;

  const messages: ChatMessage[] = raw
    .filter((m: any) => {
      // Only include personal one-on-one messages
      // Broadcast messages have no receiver_id or receiver_ids
      
      const isFromTeacher = m.sender_role === 'teacher' || String(m.sender_id) === String(user.id);
      const isFromStudent = String(m.sender_id) === String(studentId);
      
      // If from teacher: MUST have receiver_id matching this student (otherwise it's broadcast)
      if (isFromTeacher) {
        const hasValidReceiver = m.receiver_id !== undefined && String(m.receiver_id) === String(studentId);
        const hasValidReceiverIds = m.receiver_ids && Array.isArray(m.receiver_ids) && m.receiver_ids.includes(Number(studentId));
        return hasValidReceiver || hasValidReceiverIds;
      }
      
      // If from student: include it
      if (isFromStudent) {
        return true;
      }
      
      return false;
    })
    .map((m: any) => {
      const iso = m.timestamp ?? m.created_at ?? m.time ?? new Date().toISOString();
      const d = new Date(iso);
      return {
        id:         String(m.id ?? Math.random()),
        type:       (m.message_type ?? m.type ?? 'text') as MsgType,
        text:       m.content ?? m.text ?? m.message ?? '',
        mediaUri:   m.file ?? m.media_url ?? m.url ?? undefined,
        caption:    m.caption ?? undefined,
        fileName:   m.file_name ?? m.filename ?? undefined,
        fileSize:   m.file_size ? `${Math.round(m.file_size / 1024)} KB` : undefined,
        duration:   m.duration ?? undefined,
        timestamp:  d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        isoTime:    iso,
        status:     (m.status ?? 'delivered') as MsgStatus,
        isOutgoing: m.sender_role === 'teacher' || m.is_teacher === true || String(m.sender_id) === String(user.id),
      };
    });

  return { messages, hasMore };
}

async function sendTextMessage(roomId: string, content: string): Promise<void> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired.');
  const res = await fetch(`${BASE_URL}/chat/send/`, {
    method: 'POST',
    headers: makeHeaders(user.token),
    body: JSON.stringify({ room_id: roomId, content, message_type: 'text' }),
  });
  if (!res.ok) throw new Error(`Send failed (${res.status})`);
}

async function uploadChatFile(roomId: string, fileUri: string, fileName: string, mimeType: string): Promise<string> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired.');

  const headers: Record<string, string> = {};
  if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

  const form = new FormData();
  form.append('room_id', roomId);
  form.append('sender_id', String(user.id));
  form.append('sender_role', 'teacher');
  form.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const res = await fetch(`${BASE_URL}/chat/upload/`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  
  const data = await res.json();
  const url = data?.url || data?.file_url || data?.file || data?.path || data?.media_url;
  if (!url) throw new Error('Upload succeeded but no file URL returned');
  
  return url;
}

async function sendMediaMessage(roomId: string, messageType: MsgType, mediaUrl: string, caption?: string): Promise<void> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired.');
  
  const payload: any = {
    room_id: roomId,
    message_type: messageType,
    file: mediaUrl,
  };
  if (caption) payload.caption = caption;

  const res = await fetch(`${BASE_URL}/chat/send/`, {
    method: 'POST',
    headers: makeHeaders(user.token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Send failed (${res.status})`);
}

// ─── Format date label ────────────────────────────────────────────────────────
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SendIcon = ({ active }: { active: boolean }) => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M22 2L11 13" stroke={active ? C.white : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={active ? C.white : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MicIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="2" width="6" height="13" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M5 10a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 19v3M9 22h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const PlusIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const PlayIcon = ({ color = C.white, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M5 3l14 9-14 9V3z" fill={color} />
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

const PdfIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={C.pdf} strokeWidth="1.8" strokeLinejoin="round" />
    <Polyline points="14 2 14 8 20 8" stroke={C.pdf} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M8 12h1.5a1 1 0 010 2H8v-2zm0 2v2" stroke={C.pdf} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const ImagePickIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="18" height="18" rx="3" stroke={C.accent} strokeWidth="1.8" />
    <Circle cx="8.5" cy="8.5" r="1.5" fill={C.accent} />
    <Path d="M21 15l-5-5L5 21" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const VideoPickIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="6" width="14" height="12" rx="2" stroke={C.video} strokeWidth="1.8" />
    <Path d="M16 10l6-3v10l-6-3V10z" stroke={C.video} strokeWidth="1.8" strokeLinejoin="round" />
  </Svg>
);

// ─── Status Tick ──────────────────────────────────────────────────────────────
const StatusTick = ({ status }: { status: MsgStatus }) => {
  if (status === 'sending') return <ActivityIndicator size="small" color={C.mutedLight} style={{ width: rs(14), height: rs(14) }} />;
  const color = status === 'read' ? C.accent : C.mutedLight;
  return (
    <Svg width={rs(14)} height={rs(14)} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l5 5L20 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {status !== 'sent' && <Path d="M1 12l5 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
    </Svg>
  );
};

// ─── Date Separator ───────────────────────────────────────────────────────────
const DateSep = ({ label }: { label: string }) => (
  <View style={sep.wrap}>
    <View style={sep.line} />
    <View style={sep.pill}><Text style={sep.text}>{label}</Text></View>
    <View style={sep.line} />
  </View>
);
const sep = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: rs(10), paddingHorizontal: rs(8) },
  line: { flex: 1, height: 0.8, backgroundColor: C.border },
  pill: { backgroundColor: C.accentLight, borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(4), marginHorizontal: rs(10) },
  text: { fontSize: fs(10), fontWeight: '600', color: C.accent, letterSpacing: 0.4 },
});

// ─── Waveform ─────────────────────────────────────────────────────────────────
const Waveform = ({ played = 0, outgoing = true }: { played?: number; outgoing?: boolean }) => {
  const bars = [8, 14, 20, 16, 28, 18, 12, 24, 10, 20, 30, 14, 22, 8, 18, 26, 12, 20, 10, 28];
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(2) }}>
      {bars.map((h, i) => (
        <View key={i} style={{
          flex: 1, height: rs(h), borderRadius: rs(2),
          backgroundColor: i / bars.length < played
            ? (outgoing ? C.accentDark : C.accent)
            : (outgoing ? 'rgba(14,126,164,0.25)' : 'rgba(14,126,164,0.18)'),
        }} />
      ))}
    </View>
  );
};

// ─── Audio Bubble ─────────────────────────────────────────────────────────────
const AudioBubble = ({ msg }: { msg: ChatMessage }) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [curTime,  setCurTime]  = useState('0:00');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);

  const onStatus = useCallback((s: any) => {
    if (!s.isLoaded) return;
    if (s.durationMillis) {
      setProgress(s.positionMillis / s.durationMillis);
      const sec = Math.floor(s.positionMillis / 1000);
      setCurTime(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    }
    if (s.didJustFinish) { setPlaying(false); setProgress(0); setCurTime('0:00'); soundRef.current?.setPositionAsync(0); }
  }, []);

  const toggle = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (!soundRef.current) {
        if (!msg.mediaUri) return;
        setLoading(true);
        const { sound } = await Audio.Sound.createAsync({ uri: msg.mediaUri }, { shouldPlay: true }, onStatus);
        soundRef.current = sound; setLoading(false); setPlaying(true);
      } else {
        const st = await soundRef.current.getStatusAsync() as any;
        if (st.isPlaying) { await soundRef.current.pauseAsync(); setPlaying(false); }
        else { await soundRef.current.playAsync(); setPlaying(true); }
      }
    } catch { setLoading(false); }
  };

  const bg  = msg.isOutgoing ? C.bubbleOut : C.bubbleIn;
  const bc  = msg.isOutgoing ? 'rgba(26,122,94,0.2)' : C.borderMid;

  return (
    <View style={[bb.audio, { backgroundColor: bg, borderColor: bc }]}>
      <TouchableOpacity style={bb.playBtn} onPress={toggle} activeOpacity={0.8}>
        {loading ? <ActivityIndicator size="small" color={C.white} /> : playing
          ? <Svg width={rs(13)} height={rs(13)} viewBox="0 0 24 24" fill="none"><Path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={C.white} /></Svg>
          : <PlayIcon color={C.white} size={13} />}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Waveform played={progress} outgoing={msg.isOutgoing} />
        <Text style={bb.dur}>{playing ? curTime : (msg.duration ?? '0:00')}</Text>
      </View>
      <View style={bb.meta}>
        <Text style={bb.time}>{msg.timestamp}</Text>
        {msg.isOutgoing && <StatusTick status={msg.status} />}
      </View>
    </View>
  );
};
const bb = StyleSheet.create({
  audio:   { flexDirection: 'row', alignItems: 'center', gap: rs(10), borderRadius: rs(18), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, minWidth: SCREEN_W * 0.55 },
  playBtn: { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dur:     { fontSize: fs(10), color: C.muted, marginTop: rs(3) },
  meta:    { flexDirection: 'column', alignItems: 'flex-end', gap: rs(3) },
  time:    { fontSize: fs(10), color: C.muted },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MsgBubble = ({ msg }: { msg: ChatMessage }) => {
  const out = msg.isOutgoing;
  const bg  = out ? C.bubbleOut : C.bubbleIn;
  const bc  = out ? 'rgba(26,122,94,0.2)' : C.borderMid;
  const tc  = out ? C.bubbleOutText : C.dark;
  const br  = out
    ? { borderBottomRightRadius: rs(4) }
    : { borderBottomLeftRadius: rs(4) };

  const Meta = () => (
    <View style={[bub.metaRow, { justifyContent: out ? 'flex-end' : 'flex-start' }]}>
      <Text style={bub.time}>{msg.timestamp}</Text>
      {out && <StatusTick status={msg.status} />}
    </View>
  );

  const renderContent = () => {
    switch (msg.type) {
      case 'text':
        return (
          <View style={[bub.textBubble, { backgroundColor: bg, borderColor: bc }, br]}>
            <Text style={[bub.msgText, { color: tc }]}>{msg.text}</Text>
            <Meta />
          </View>
        );
      case 'image':
        return (
          <View style={[bub.mediaBubble, { backgroundColor: bg, borderColor: bc }, br]}>
            {msg.mediaUri
              ? <Image source={{ uri: msg.mediaUri }} style={bub.img} resizeMode="cover" />
              : <View style={[bub.img, bub.imgPlaceholder]}><Text style={{ color: C.white }}>📷 Photo</Text></View>}
            {msg.caption ? <Text style={[bub.caption, { color: tc }]}>{msg.caption}</Text> : null}
            <Meta />
          </View>
        );
      case 'audio':
        return <AudioBubble msg={msg} />;
      case 'video':
        return (
          <View style={[bub.mediaBubble, { backgroundColor: bg, borderColor: bc }, br]}>
            <View style={[bub.img, bub.videoThumb]}>
              <View style={bub.videoPlay}><PlayIcon color={C.white} size={18} /></View>
              {msg.duration && (
                <View style={bub.durBadge}><Text style={bub.durText}>{msg.duration}</Text></View>
              )}
            </View>
            {msg.caption ? <Text style={[bub.caption, { color: tc }]}>{msg.caption}</Text> : null}
            <Meta />
          </View>
        );
      case 'pdf':
      case 'document':
        return (
          <View style={[bub.fileBubble, { backgroundColor: bg, borderColor: bc }, br]}>
            <View style={[bub.fileIconBox, { backgroundColor: msg.type === 'pdf' ? C.pdf + '18' : C.doc + '18' }]}>
              {msg.type === 'pdf' ? <PdfIcon /> : <FileIcon />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[bub.fileName, { color: tc }]} numberOfLines={2}>{msg.fileName ?? 'File'}</Text>
              {msg.fileSize ? <Text style={bub.fileSize}>{msg.fileSize}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: rs(4) }}>
              <Text style={bub.time}>{msg.timestamp}</Text>
              {out && <StatusTick status={msg.status} />}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[bub.row, out ? bub.rowOut : bub.rowIn]}>
      <View style={{ maxWidth: '82%' }}>{renderContent()}</View>
    </View>
  );
};
const bub = StyleSheet.create({
  row:         { flexDirection: 'row', marginBottom: rs(8) },
  rowOut:      { justifyContent: 'flex-end' },
  rowIn:       { justifyContent: 'flex-start' },
  textBubble:  { borderRadius: rs(18), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8 },
  msgText:     { fontSize: fs(14), lineHeight: fs(21), marginBottom: rs(3) },
  mediaBubble: { borderRadius: rs(18), padding: rs(8), borderWidth: 0.8, overflow: 'hidden' },
  img:         { width: SCREEN_W * 0.6, height: SCREEN_W * 0.42, borderRadius: rs(12) },
  imgPlaceholder: { backgroundColor: C.accentDark, alignItems: 'center', justifyContent: 'center' },
  caption:     { fontSize: fs(12), lineHeight: fs(18), padding: rs(6), paddingHorizontal: rs(8) },
  videoThumb:  { backgroundColor: C.accentDark, alignItems: 'center', justifyContent: 'center' },
  videoPlay:   { width: rs(46), height: rs(46), borderRadius: rs(23), backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' },
  durBadge:    { position: 'absolute', bottom: rs(8), right: rs(8), backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: rs(5), paddingHorizontal: rs(6), paddingVertical: rs(2) },
  durText:     { fontSize: fs(10), color: C.white, fontWeight: '600' },
  fileBubble:  { flexDirection: 'row', alignItems: 'center', gap: rs(10), borderRadius: rs(18), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, minWidth: SCREEN_W * 0.55 },
  fileIconBox: { width: rs(42), height: rs(42), borderRadius: rs(10), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileName:    { fontSize: fs(13), fontWeight: '600', marginBottom: rs(2) },
  fileSize:    { fontSize: fs(11), color: C.muted },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: rs(4), marginTop: rs(2) },
  time:        { fontSize: fs(10), color: C.muted, fontWeight: '500' },
});

// ─── Attach Menu ──────────────────────────────────────────────────────────────
const AttachMenu = ({
  visible, onClose, onSelect,
}: { visible: boolean; onClose: () => void; onSelect: (t: MsgType) => void }) => {
  const slide = useRef(new Animated.Value(300)).current;
  const opac  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(opac,  { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slide, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opac,  { toValue: 0,   duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const ITEMS = [
    { label: 'Photo',    sub: 'Camera or Gallery',  type: 'image'    as MsgType, icon: <ImagePickIcon />,             bg: C.accent + '15' },
    { label: 'Video',    sub: 'Camera or Library',  type: 'video'    as MsgType, icon: <VideoPickIcon />,             bg: C.video  + '15' },
    { label: 'Audio',    sub: 'Voice or File',       type: 'audio'    as MsgType, icon: <MicIcon color={C.audio} />,   bg: C.audio  + '15' },
    { label: 'Document', sub: '.docx  .xlsx  .pptx',type: 'document' as MsgType, icon: <FileIcon color={C.doc} />,    bg: C.doc    + '15' },
    { label: 'PDF',      sub: '.pdf file',           type: 'pdf'      as MsgType, icon: <PdfIcon />,                  bg: C.pdf    + '15' },
  ];

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[am.overlay, { opacity: opac }]}>
        <TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
        <Animated.View style={[am.sheet, { transform: [{ translateY: slide }] }]}>
          <View style={am.handle} />
          <Text style={am.title}>Send Attachment</Text>
          <View style={am.grid}>
            {ITEMS.map(item => (
              <TouchableOpacity key={item.type} style={am.item} onPress={() => { onClose(); onSelect(item.type); }} activeOpacity={0.75}>
                <View style={[am.iconBox, { backgroundColor: item.bg }]}>{item.icon}</View>
                <Text style={am.label}>{item.label}</Text>
                <Text style={am.sub}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet:   { backgroundColor: C.white, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), paddingBottom: rs(32), paddingHorizontal: rs(20) },
  handle:  { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: C.borderMid, alignSelf: 'center', marginTop: rs(12), marginBottom: rs(16) },
  title:   { fontSize: fs(15), fontWeight: '700', color: C.dark, marginBottom: rs(18) },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: rs(12) },
  item:    { width: (SCREEN_W - rs(40) - rs(48)) / 3, alignItems: 'center', gap: rs(6) },
  iconBox: { width: rs(50), height: rs(50), borderRadius: rs(16), alignItems: 'center', justifyContent: 'center' },
  label:   { fontSize: fs(11), fontWeight: '600', color: C.dark, textAlign: 'center' },
  sub:     { fontSize: fs(9), color: C.muted, textAlign: 'center' },
});

// ─── Recording Bar ────────────────────────────────────────────────────────────
const RecordingBar = ({ onStop }: { onStop: () => void }) => {
  const [secs, setSecs] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ])).start();
    return () => clearInterval(t);
  }, []);

  const fmt = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <View style={rec.bar}>
      <Animated.View style={[rec.dot, { transform: [{ scale: pulse }] }]} />
      <Text style={rec.timer}>{fmt}</Text>
      <Text style={rec.hint}>Recording…</Text>
      <TouchableOpacity style={rec.stopBtn} onPress={onStop} activeOpacity={0.85}>
        <View style={rec.stopIcon} />
        <Text style={rec.stopText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};
const rec = StyleSheet.create({
  bar:      { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: C.white, paddingHorizontal: rs(20), paddingVertical: rs(14), borderTopWidth: 1, borderTopColor: C.border },
  dot:      { width: rs(12), height: rs(12), borderRadius: rs(6), backgroundColor: C.danger },
  timer:    { fontSize: fs(16), fontWeight: '700', color: C.dark },
  hint:     { flex: 1, fontSize: fs(13), color: C.muted },
  stopBtn:  { flexDirection: 'row', alignItems: 'center', gap: rs(6), backgroundColor: C.accent, borderRadius: rs(20), paddingHorizontal: rs(16), paddingVertical: rs(8) },
  stopIcon: { width: rs(10), height: rs(10), borderRadius: rs(2), backgroundColor: C.white },
  stopText: { color: C.white, fontWeight: '700', fontSize: fs(13) },
});

// ─── Compose Bar ──────────────────────────────────────────────────────────────
const ComposeBar = ({
  onSend, onAttach, onRecord,
}: { onSend: (t: string) => void; onAttach: () => void; onRecord: () => void }) => {
  const [text, setText] = useState('');
  const active = text.trim().length > 0;

  return (
    <View style={cb.bar}>
      <TouchableOpacity style={cb.iconBtn} onPress={onAttach} activeOpacity={0.75}>
        <PlusIcon />
      </TouchableOpacity>
      <View style={cb.inputWrap}>
        <TextInput
          style={cb.input}
          placeholder="Message…"
          placeholderTextColor={C.mutedLight}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
      </View>
      <TouchableOpacity
        style={[cb.sendBtn, active ? cb.sendBtnActive : cb.sendBtnMic]}
        onPress={() => { if (active) { onSend(text.trim()); setText(''); } else onRecord(); }}
        activeOpacity={0.85}
      >
        {active ? <SendIcon active /> : <MicIcon color={C.audio} />}
      </TouchableOpacity>
    </View>
  );
};
const cb = StyleSheet.create({
  bar:          { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8), backgroundColor: C.white, paddingHorizontal: rs(12), paddingVertical: rs(10), borderTopWidth: 1, borderTopColor: C.border },
  iconBtn:      { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputWrap:    { flex: 1, backgroundColor: C.accentLight, borderRadius: rs(20), paddingHorizontal: rs(14), paddingVertical: rs(8), minHeight: rs(40), justifyContent: 'center' },
  input:        { fontSize: fs(14), color: C.dark, maxHeight: rs(100) },
  sendBtn:      { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnActive:{ backgroundColor: C.accent },
  sendBtnMic:   { backgroundColor: C.accentLight },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PersonalChatScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{
    roomId:      string;
    studentId:   string;
    studentName: string;
    admNo?:      string;
    classNo?:    string;
    division?:   string;
    isOnline?:   string;
  }>();

  const roomId      = params.roomId ?? '';
  const studentName = params.studentName ?? 'Student';
  const isOnline    = params.isOnline === '1';
  const admNo       = params.admNo ?? '';
  const classNo     = params.classNo ?? '';
  const division    = params.division ?? '';

  const subLabel = [admNo, classNo, division].filter(Boolean).join(' · ');

  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [error,       setError]       = useState<string | null>(null);
  const [recording,   setRecording]   = useState(false);
  const [attachVis,   setAttachVis]   = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<ChatMessage | null>(null);
  const [menuVis,     setMenuVis]     = useState(false);
  const [starred,     setStarred]     = useState<Set<string>>(new Set());
  const [pinned,      setPinned]      = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editText,    setEditText]    = useState('');

  const flatRef    = useRef<FlatList>(null);
  const recordRef  = useRef<Audio.Recording | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef  = useRef<string | null>(null);

  // ── Initial load ─────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async (pg = 1, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { messages: msgs, hasMore: more } = await fetchHistory(roomId, params.studentId ?? '', pg);
      if (pg === 1) {
        setMessages(msgs);
        lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
      } else {
        setMessages(prev => [...msgs, ...prev]);
      }
      setHasMore(more);
      setPage(pg);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [roomId]);

  // ── Poll for new messages ─────────────────────────────────────────────────────
  const pollMessages = useCallback(async () => {
    try {
      const { messages: fresh } = await fetchHistory(roomId, params.studentId ?? '', 1);
      if (fresh.length === 0) return;
      const newLatestId = fresh[fresh.length - 1].id;
      if (newLatestId !== lastIdRef.current) {
        lastIdRef.current = newLatestId;
        setMessages(fresh);
      }
    } catch { /* silent fail */ }
  }, [roomId]);

  useEffect(() => {
    loadHistory(1);
    pollRef.current = setInterval(pollMessages, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadHistory, pollMessages]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && !loadingMore) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  // ── Load older messages (pagination) ─────────────────────────────────────────
  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadHistory(page + 1);
  };

  // ── Send text ─────────────────────────────────────────────────────────────────
  const handleSendText = async (text: string) => {
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    const tempMsg: ChatMessage = {
      id:         tempId,
      type:       'text',
      text,
      timestamp:  now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      isoTime:    now.toISOString(),
      status:     'sending',
      isOutgoing: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      await sendTextMessage(roomId, text);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  };

  // ── Attach media ──────────────────────────────────────────────────────────────
  const handleSelectType = async (type: MsgType) => {
    if (type === 'image') {
      Alert.alert('Send Photo', 'Choose a source', [
        {
          text: 'Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
            if (result.canceled) return;
            addLocalMsg({ type: 'image', mediaUri: result.assets[0].uri, fileName: `photo_${Date.now()}.jpg` });
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
            if (result.canceled) return;
            const asset = result.assets[0];
            addLocalMsg({ type: 'image', mediaUri: asset.uri, fileName: asset.fileName ?? `photo_${Date.now()}.jpg` });
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
            addLocalMsg({
              type: 'video',
              mediaUri: asset.uri,
              duration: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`,
              fileName: asset.fileName ?? `video_${Date.now()}.mp4`,
            });
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
            addLocalMsg({
              type: 'video',
              mediaUri: asset.uri,
              duration: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`,
              fileName: asset.fileName ?? `video_${Date.now()}.mp4`,
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (type === 'audio') {
      Alert.alert('Send Audio', 'Choose an option', [
        { text: 'Record Voice', onPress: startRecording },
        {
          text: 'Pick Audio File',
          onPress: async () => {
            const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
            if (result.canceled) return;
            const file = result.assets[0];
            addLocalMsg({
              type: 'audio',
              mediaUri: file.uri,
              duration: '0:00',
              text: file.name,
              fileName: file.name,
              fileSize: file.size ? `${Math.round(file.size / 1024)} KB` : '',
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const mimeMap: Record<string, string | string[]> = {
      document: [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
      ],
      pdf: 'application/pdf',
    };
    const result = await DocumentPicker.getDocumentAsync({ type: mimeMap[type] ?? '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    addLocalMsg({ type, fileName: file.name, fileSize: file.size ? `${Math.round(file.size / 1024)} KB` : '', mediaUri: file.uri });
  };

  const addLocalMsg = async (partial: Partial<ChatMessage>) => {
    const tempId = `local-${Date.now()}`;
    const now = new Date();
    const msg: ChatMessage = {
      id:         tempId,
      type:       'text',
      timestamp:  now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      isoTime:    now.toISOString(),
      status:     'sending',
      isOutgoing: true,
      ...partial,
    };
    setMessages(prev => [...prev, msg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

    // If it's a media message with a local URI, upload it first
    if (msg.mediaUri && msg.mediaUri.startsWith('file://')) {
      try {
        const mimeMap: Record<string, string> = {
          image: 'image/jpeg',
          video: 'video/mp4',
          audio: 'audio/mp4',
          document: 'application/octet-stream',
          pdf: 'application/pdf',
        };
        const mimeType = mimeMap[msg.type] || 'application/octet-stream';
        const fileName = msg.fileName || `media_${Date.now()}`;
        
        const uploadedUrl = await uploadChatFile(roomId, msg.mediaUri, fileName, mimeType);
        
        // Send the message with uploaded URL
        await sendMediaMessage(roomId, msg.type as MsgType, uploadedUrl, msg.caption);
        
        // Update UI with successful status
        setMessages(prev => prev.map(m => 
          m.id === tempId 
            ? { ...m, mediaUri: uploadedUrl, status: 'sent' } 
            : m
        ));
      } catch (err: any) {
        setMessages(prev => prev.map(m => 
          m.id === tempId 
            ? { ...m, status: 'failed' } 
            : m
        ));
      }
    }
  };

  // ── Recording ─────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordRef.current = recording;
      setRecording(true);
    } catch { setRecording(true); }
  };

  const stopRecording = async () => {
    setRecording(false);
    let uri: string | undefined;
    try {
      if (recordRef.current) {
        await recordRef.current.stopAndUnloadAsync();
        uri = recordRef.current.getURI() ?? undefined;
        recordRef.current = null;
      }
    } catch { /* ignore */ }
    addLocalMsg({ type: 'audio', duration: '0:15', mediaUri: uri });
  };

  // ── Message Actions (Context Menu) ─────────────────────────────────────────────
  const handleCopy = () => {
    if (!selectedMsg) return;
    const text = selectedMsg.type === 'text' ? selectedMsg.text : `[${selectedMsg.type.toUpperCase()}] ${selectedMsg.fileName || 'Media'}`;
    // Would use react-native-share or Clipboard API
    Alert.alert('Copied', text || '');
    setMenuVis(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Message', 'Choose an option', [
      {
        text: 'Delete for Me',
        onPress: () => {
          if (selectedMsg) {
            setMessages(prev => prev.filter(m => m.id !== selectedMsg.id));
            setMenuVis(false);
          }
        },
      },
      {
        text: 'Delete for Everyone',
        onPress: () => {
          // Would call API to delete for everyone
          if (selectedMsg) {
            setMessages(prev => prev.filter(m => m.id !== selectedMsg.id));
            setMenuVis(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleEdit = () => {
    if (!selectedMsg?.isOutgoing || selectedMsg.type !== 'text') {
      Alert.alert('Cannot Edit', 'Only you can edit your own text messages');
      setMenuVis(false);
      return;
    }
    setEditingId(selectedMsg.id);
    setEditText(selectedMsg.text || '');
    setMenuVis(false);
  };

  const handleStar = () => {
    if (!selectedMsg) return;
    const newStarred = new Set(starred);
    if (newStarred.has(selectedMsg.id)) {
      newStarred.delete(selectedMsg.id);
    } else {
      newStarred.add(selectedMsg.id);
    }
    setStarred(newStarred);
    setMenuVis(false);
  };

  const handlePin = () => {
    if (!selectedMsg) return;
    setPinned(pinned === selectedMsg.id ? null : selectedMsg.id);
    setMenuVis(false);
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

  // ── Group messages by date ────────────────────────────────────────────────────
  type ListItem = { key: string; type: 'separator'; label: string } | { key: string; type: 'message'; msg: ChatMessage };

  const listData: ListItem[] = [];
  let lastDay = '';
  for (const msg of messages) {
    const day = dayLabel(msg.isoTime);
    if (day !== lastDay) {
      listData.push({ key: `sep-${msg.isoTime}`, type: 'separator', label: day });
      lastDay = day;
    }
    listData.push({ key: msg.id, type: 'message', msg });
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'separator') return <DateSep label={item.label} />;
    const isStarred = starred.has(item.msg.id);
    const isPinned = pinned === item.msg.id;
    return (
      <TouchableWithoutFeedback 
        onLongPress={() => { setSelectedMsg(item.msg); setMenuVis(true); }}
      >
        <View>
          {isPinned && <View style={{ backgroundColor: C.accentLight, padding: rs(8), marginHorizontal: rs(8), borderRadius: rs(8), marginBottom: rs(4) }}>
            <Text style={{ fontSize: fs(10), color: C.accent, fontWeight: '600' }}>📌 Pinned Message</Text>
          </View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(6) }}>
            {isStarred && <Text style={{ fontSize: fs(16) }}>⭐</Text>}
            <View style={{ flex: 1 }}>
              <MsgBubble msg={item.msg} />
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  // ── Header avatar color ───────────────────────────────────────────────────────
  const avatarColor = '#1A6D82';

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={{ color: C.muted, marginTop: rs(12), fontSize: fs(14) }}>Loading conversation…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accent} />

      {/* ── Header ── */}
      <View style={[s.header, {
        paddingTop: insets.top > 0 ? insets.top + rs(8) : Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(20)) + rs(8) : rs(50),
      }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <BackIcon />
        </TouchableOpacity>

        <View style={s.headerAvatarWrap}>
          <View style={[s.headerAvatar, { backgroundColor: avatarColor + '30' }]}>
            <Text style={s.headerAvatarText}>{getInitials(studentName)}</Text>
          </View>
          {isOnline && <View style={s.headerOnlineDot} />}
        </View>

        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{studentName}</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {isOnline ? '🟢 Online' : subLabel || 'Offline'}
          </Text>
        </View>
      </View>

      {/* ── Error banner ── */}
      {error && (
        <View style={s.errBand}>
          <Text style={s.errText}>⚠️  {error}</Text>
          <TouchableOpacity onPress={() => { setError(null); loadHistory(1); }}>
            <Text style={s.errRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Load more spinner ── */}
      {loadingMore && (
        <View style={{ padding: rs(8), alignItems: 'center' }}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      )}

      {/* ── Messages ── */}
      <FlatList
        ref={flatRef}
        data={listData}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={[s.list, { paddingBottom: rs(8) }]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.15}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>No messages yet</Text>
            <Text style={s.emptySub}>Start the conversation with {studentName}.</Text>
          </View>
        }
      />

      {/* ── Compose / Recording ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View>
          {recording
            ? <RecordingBar onStop={stopRecording} />
            : <ComposeBar onSend={handleSendText} onAttach={() => setAttachVis(true)} onRecord={startRecording} />}
        </View>
      </KeyboardAvoidingView>

      <AttachMenu visible={attachVis} onClose={() => setAttachVis(false)} onSelect={handleSelectType} />

      {/* ── Context Menu ── */}
      <Modal transparent visible={menuVis} statusBarTranslucent animationType="fade" onRequestClose={() => setMenuVis(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVis(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: C.white, borderRadius: rs(12), paddingVertical: rs(6), minWidth: rs(200) }}>
                <TouchableOpacity 
                  style={cm.item} 
                  onPress={handleCopy}
                  disabled={selectedMsg?.type !== 'text'}
                >
                  <Text style={cm.label}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={cm.item} 
                  onPress={handleEdit}
                  disabled={!selectedMsg?.isOutgoing || selectedMsg?.type !== 'text'}
                >
                  <Text style={cm.label}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={cm.item} 
                  onPress={handleStar}
                >
                  <Text style={cm.label}>{starred.has(selectedMsg?.id || '') ? '⭐ Unstar' : '⭐ Star'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={cm.item} 
                  onPress={handlePin}
                >
                  <Text style={cm.label}>{pinned === selectedMsg?.id ? '📌 Unpin' : '📌 Pin'}</Text>
                </TouchableOpacity>
                <View style={cm.divider} />
                <TouchableOpacity 
                  style={cm.item} 
                  onPress={handleDelete}
                >
                  <Text style={[cm.label, { color: C.danger }]}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(14),
    paddingBottom: rs(14),
    gap: rs(10),
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.2,
    shadowRadius: rs(8),
    elevation: 6,
  },
  backBtn:          { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatarWrap: { position: 'relative', flexShrink: 0 },
  headerAvatar:     { width: rs(38), height: rs(38), borderRadius: rs(19), borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: fs(14), fontWeight: '700', color: C.white },
  headerOnlineDot:  { position: 'absolute', bottom: 1, right: 1, width: rs(11), height: rs(11), borderRadius: rs(6), backgroundColor: '#38A169', borderWidth: 2, borderColor: C.accent },
  headerInfo:       { flex: 1, gap: rs(2) },
  headerName:       { fontSize: fs(15), fontWeight: '700', color: C.white, letterSpacing: -0.1 },
  headerSub:        { fontSize: fs(11), color: 'rgba(255,255,255,0.72)', fontWeight: '500' },

  errBand:  { backgroundColor: '#FFF5F5', paddingHorizontal: rs(16), paddingVertical: rs(8), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#FEB2B2' },
  errText:  { fontSize: fs(12), color: C.danger, flex: 1 },
  errRetry: { fontSize: fs(12), color: C.accent, fontWeight: '700', marginLeft: rs(12) },

  list:     { paddingHorizontal: rs(12), paddingTop: rs(8) },

  empty:     { alignItems: 'center', paddingTop: rs(80), paddingHorizontal: rs(32) },
  emptyIcon: { fontSize: rs(48), marginBottom: rs(12) },
  emptyTitle:{ fontSize: fs(16), fontWeight: '700', color: C.dark, marginBottom: rs(6) },
  emptySub:  { fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: fs(20) },
});

// ─── Context Menu Styles ──────────────────────────────────────────────────────
const cm = StyleSheet.create({
  item:    { paddingHorizontal: rs(16), paddingVertical: rs(10), justifyContent: 'center' },
  label:   { fontSize: fs(14), color: C.dark, fontWeight: '500' },
  divider: { height: 0.8, backgroundColor: C.border, marginVertical: rs(4) },
});
