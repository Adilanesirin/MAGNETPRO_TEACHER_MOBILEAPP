import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ScrollView,
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

// ─── Responsive Helpers ────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.5));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Brand Colors ─────────────────────────────────────────────────────────────
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
  bubble:      '#E6F4F9',
  sent:        '#DCF2EA',
  sentText:    '#1A7A5E',
  amber:       '#C97A3A',
  success:     '#2ECC9A',
  danger:      '#E05A5A',
  overlay:     'rgba(0,0,0,0.45)',
  pdf:         '#E05A5A',
  doc:         '#2F80ED',
  audio:       '#9B59B6',
  video:       '#E67E22',
};

// ─── API Config ───────────────────────────────────────────────────────────────
const BASE_URL = 'https://magnetpro.in/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'pdf';

interface SentMessage {
  id: string;
  type: MsgType;
  text?: string;
  mediaUri?: string;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

interface Contact {
  id: number;
  name: string;
  role: string;
}

// ─── API Module ───────────────────────────────────────────────────────────────
async function getStoredUser(): Promise<{ id: number; institution_id: string } | null> {
  try {
    const raw = await AsyncStorage.getItem('magnetpro_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchContacts(): Promise<Contact[]> {
  const user = await getStoredUser();
  if (!user) return [];

  const params = new URLSearchParams({
    role: 'teacher',
    user_id: String(user.id),
    institution_id: user.institution_id,
  });

  const res = await fetch(`${BASE_URL}/chat/contacts/?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error(`Contacts fetch failed: ${res.status}`);
  const data = await res.json();

  // API may return array directly or nested under a key — handle both
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
  const res = await fetch(`${BASE_URL}/chat/send-bulk/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || err?.detail || `Send failed: ${res.status}`);
  }
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SendIcon = ({ active }: { active: boolean }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M22 2L11 13" stroke={active ? C.white : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={active ? C.white : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PlayIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M5 3l14 9-14 9V3z" fill={color} />
  </Svg>
);

const MicIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="2" width="6" height="13" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M5 10a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 19v3M9 22h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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
    <Path d="M12 12v4m0-4h1.5a1.5 1.5 0 010 3H12" stroke={C.pdf} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 12h2v1.5M16 14.5h1.5M16 16h2" stroke={C.pdf} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const EmojiIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={C.muted} strokeWidth="1.8" />
    <Path d="M8 14s1.5 2 4 2 4-2 4-2" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="9" y1="9" x2="9.01" y2="9" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="15" y1="9" x2="15.01" y2="9" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

const PlusIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const CheckIcon = ({ double = false }: { double?: boolean }) => (
  <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 12l5 5L20 7" stroke={double ? C.accent : C.mutedLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {double && <Path d="M1 12l5 5" stroke={C.accent} strokeWidth="2" strokeLinecap="round" />}
  </Svg>
);

// ─── Waveform ─────────────────────────────────────────────────────────────────
const Waveform = ({ played = 0.4, outgoing = true }: { played?: number; outgoing?: boolean }) => {
  const bars = [8, 14, 20, 16, 28, 18, 12, 24, 10, 20, 30, 14, 22, 8, 18, 26, 12, 20, 10, 28, 16, 22, 18, 14];
  return (
    <View style={wv.container}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            wv.bar,
            { height: rs(h) },
            i / bars.length < played
              ? outgoing ? wv.barPlayedOut : wv.barPlayedIn
              : outgoing ? wv.barUnplayedOut : wv.barUnplayedIn,
          ]}
        />
      ))}
    </View>
  );
};
const wv = StyleSheet.create({
  container:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(2) },
  bar:            { flex: 1, borderRadius: rs(2) },
  barPlayedOut:   { backgroundColor: C.accentDark },
  barUnplayedOut: { backgroundColor: 'rgba(14,126,164,0.25)' },
  barPlayedIn:    { backgroundColor: C.accent },
  barUnplayedIn:  { backgroundColor: 'rgba(14,126,164,0.18)' },
});

// ─── Status Tick ──────────────────────────────────────────────────────────────
const StatusTick = ({ status }: { status: SentMessage['status'] }) => {
  if (status === 'sending') return <ActivityIndicator size="small" color={C.mutedLight} style={{ width: rs(16), height: rs(16) }} />;
  if (status === 'sent') return <CheckIcon double={false} />;
  if (status === 'delivered') return <CheckIcon double={true} />;
  return (
    <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l5 5L20 7" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M1 12l5 5" stroke={C.accent} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
};

// ─── Date Separator ───────────────────────────────────────────────────────────
const DateSeparator = ({ label }: { label: string }) => (
  <View style={ds.wrap}>
    <View style={ds.line} />
    <View style={ds.pill}><Text style={ds.text}>{label}</Text></View>
    <View style={ds.line} />
  </View>
);
const ds = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: rs(10), paddingHorizontal: rs(16) },
  line: { flex: 1, height: 0.8, backgroundColor: C.border },
  pill: { backgroundColor: C.accentLight, borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(4), marginHorizontal: rs(10) },
  text: { fontSize: fs(10), fontWeight: '600', color: C.accent, letterSpacing: 0.4 },
});

// ─── Audio Bubble ─────────────────────────────────────────────────────────────
const AudioBubble = ({ msg }: { msg: SentMessage }) => {
  const soundRef   = useRef<Audio.Sound | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [loading,  setLoading]  = useState(false);
  const totalDur = msg.duration ?? '0:00';
  const DEMO_URI = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  const audioUri = msg.mediaUri ?? DEMO_URI;

  useEffect(() => { return () => { soundRef.current?.unloadAsync(); }; }, []);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status.isLoaded) return;
    if (status.durationMillis) {
      const prog = status.positionMillis / status.durationMillis;
      setProgress(prog);
      const secs = Math.floor(status.positionMillis / 1000);
      setCurrentTime(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    }
    if (status.didJustFinish) {
      setPlaying(false); setProgress(0); setCurrentTime('0:00');
      soundRef.current?.setPositionAsync(0);
    }
  }, []);

  const handlePlayPause = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (!soundRef.current) {
        setLoading(true);
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true }, onPlaybackStatusUpdate);
        soundRef.current = sound;
        setLoading(false); setPlaying(true);
      } else {
        const status = await soundRef.current.getStatusAsync() as any;
        if (status.isPlaying) { await soundRef.current.pauseAsync(); setPlaying(false); }
        else { await soundRef.current.playAsync(); setPlaying(true); }
      }
    } catch (e) { setLoading(false); console.warn('Audio playback error:', e); }
  };

  const PauseIcon = () => (
    <Svg width={rs(13)} height={rs(13)} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={C.white} />
    </Svg>
  );

  return (
    <View style={sb.audioBubble}>
      <TouchableOpacity style={sb.audioPlayBtn} onPress={handlePlayPause} activeOpacity={0.8}>
        {loading ? <ActivityIndicator size="small" color={C.white} /> : playing ? <PauseIcon /> : <PlayIcon color={C.white} size={13} />}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        {msg.text ? <Text style={sb.audioLabel} numberOfLines={1}>{msg.text}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(8), marginTop: rs(4) }}>
          <Waveform played={progress} outgoing />
          <Text style={sb.audioDur}>{playing ? currentTime : totalDur}</Text>
        </View>
      </View>
      <View style={sb.audioMeta}>
        <Text style={sb.timeText}>{msg.timestamp}</Text>
        <StatusTick status={msg.status} />
      </View>
    </View>
  );
};

// ─── Sent Message Bubble ──────────────────────────────────────────────────────
const SentBubble = ({ msg }: { msg: SentMessage }) => {
  const renderContent = () => {
    switch (msg.type) {
      case 'text':
        return (
          <View style={sb.textBubble}>
            <Text style={sb.msgText}>{msg.text}</Text>
            <View style={sb.metaRow}>
              <Text style={sb.timeText}>{msg.timestamp}</Text>
              <StatusTick status={msg.status} />
            </View>
          </View>
        );
      case 'image':
        return (
          <View style={sb.mediaBubble}>
            {msg.mediaUri
              ? <Image source={{ uri: msg.mediaUri }} style={sb.mediaImg} resizeMode="cover" />
              : <View style={[sb.mediaImg, sb.mediaPlaceholder]}><Text style={{ color: C.white, fontSize: fs(13) }}>📷 Photo</Text></View>
            }
            {msg.caption ? <Text style={sb.caption}>{msg.caption}</Text> : null}
            <View style={[sb.metaRow, { paddingHorizontal: rs(8), paddingBottom: rs(6) }]}>
              <Text style={sb.timeText}>{msg.timestamp}</Text>
              <StatusTick status={msg.status} />
            </View>
          </View>
        );
      case 'audio':
        return <AudioBubble msg={msg} />;
      case 'video':
        return (
          <View style={sb.mediaBubble}>
            <View style={[sb.mediaImg, sb.videoThumb]}>
              <View style={sb.videoPlayCircle}><PlayIcon color={C.white} size={18} /></View>
              <View style={sb.videoDurBadge}><Text style={sb.videoDurText}>{msg.duration}</Text></View>
            </View>
            {msg.caption ? <Text style={sb.caption}>{msg.caption}</Text> : null}
            <View style={[sb.metaRow, { paddingHorizontal: rs(8), paddingBottom: rs(6) }]}>
              <Text style={sb.timeText}>{msg.timestamp}</Text>
              <StatusTick status={msg.status} />
            </View>
          </View>
        );
      case 'pdf':
      case 'document':
        return (
          <View style={sb.fileBubble}>
            <View style={[sb.fileIconBox, { backgroundColor: msg.type === 'pdf' ? C.pdf + '18' : C.doc + '18' }]}>
              {msg.type === 'pdf' ? <PdfIcon /> : <FileIcon />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sb.fileName} numberOfLines={2}>{msg.fileName}</Text>
              <Text style={sb.fileSize}>{msg.fileSize}</Text>
            </View>
            <View style={sb.fileMeta}>
              <Text style={sb.timeText}>{msg.timestamp}</Text>
              <StatusTick status={msg.status} />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={sb.row}>
      <View style={sb.bubbleWrap}>{renderContent()}</View>
    </View>
  );
};

const sb = StyleSheet.create({
  row:              { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: rs(10) },
  bubbleWrap:       { maxWidth: '85%' },
  textBubble:       { backgroundColor: C.bubble, borderRadius: rs(18), borderBottomRightRadius: rs(4), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, borderColor: C.borderMid },
  msgText:          { fontSize: fs(13), color: C.dark, lineHeight: fs(20), marginBottom: rs(4) },
  mediaBubble:      { backgroundColor: C.bubble, borderRadius: rs(18), borderBottomRightRadius: rs(4), padding: rs(8), borderWidth: 0.8, borderColor: C.borderMid, overflow: 'hidden' },
  mediaImg:         { width: SCREEN_W * 0.62, height: SCREEN_W * 0.44, borderRadius: rs(12) },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentDark },
  caption:          { fontSize: fs(12), color: C.dark, lineHeight: fs(18), padding: rs(6), paddingHorizontal: rs(8) },
  audioBubble:      { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.bubble, borderRadius: rs(18), borderBottomRightRadius: rs(4), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, borderColor: C.borderMid, minWidth: SCREEN_W * 0.55 },
  audioPlayBtn:     { width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  audioLabel:       { fontSize: fs(11), color: C.muted, fontWeight: '500' },
  audioDur:         { fontSize: fs(11), color: C.mutedLight, fontWeight: '600', flexShrink: 0 },
  audioMeta:        { flexDirection: 'column', alignItems: 'flex-end', gap: rs(4), paddingLeft: rs(4) },
  videoThumb:       { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentDark },
  videoPlayCircle:  { width: rs(48), height: rs(48), borderRadius: rs(24), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  videoDurBadge:    { position: 'absolute', bottom: rs(8), right: rs(10), backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: rs(5), paddingHorizontal: rs(6), paddingVertical: rs(2) },
  videoDurText:     { fontSize: fs(10), color: C.white, fontWeight: '600' },
  fileBubble:       { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: C.bubble, borderRadius: rs(18), borderBottomRightRadius: rs(4), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, borderColor: C.borderMid, minWidth: SCREEN_W * 0.55 },
  fileIconBox:      { width: rs(44), height: rs(44), borderRadius: rs(12), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileName:         { fontSize: fs(13), fontWeight: '600', color: C.dark, marginBottom: rs(2), flexShrink: 1 },
  fileSize:         { fontSize: fs(11), color: C.muted },
  fileMeta:         { flexDirection: 'column', alignItems: 'flex-end', gap: rs(4) },
  metaRow:          { flexDirection: 'row', alignItems: 'center', gap: rs(4), justifyContent: 'flex-end', marginTop: rs(2) },
  timeText:         { fontSize: fs(10), color: C.muted, fontWeight: '500' },
});

// ─── Attach Menu ──────────────────────────────────────────────────────────────
const AttachMenu = ({
  visible, onClose, onSelectType,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: 'image' | 'video' | 'audio' | 'document' | 'pdf') => void;
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(opacAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacAnim,  { toValue: 0,   duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const ITEMS = [
    { label: 'Photo',    sub: 'Camera or Gallery',   type: 'image'    as const, icon: <ImagePickIcon />,          bg: C.accent + '15' },
    { label: 'Video',    sub: 'Camera or Library',   type: 'video'    as const, icon: <VideoPickIcon />,          bg: C.video  + '15' },
    { label: 'Audio',    sub: 'Voice or File',        type: 'audio'    as const, icon: <MicIcon color={C.audio} />, bg: C.audio  + '15' },
    { label: 'Document', sub: '.docx  .xlsx  .pptx', type: 'document' as const, icon: <FileIcon color={C.doc} />,  bg: C.doc    + '15' },
    { label: 'PDF',      sub: '.pdf file',            type: 'pdf'      as const, icon: <PdfIcon />,                bg: C.pdf    + '15' },
  ];

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[am.overlay, { opacity: opacAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
        <Animated.View style={[am.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={am.handle} />
          <Text style={am.title}>Send Attachment</Text>
          <View style={am.grid}>
            {ITEMS.map((item) => (
              <TouchableOpacity key={item.type} style={am.item} onPress={() => { onClose(); onSelectType(item.type); }} activeOpacity={0.75}>
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
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { backgroundColor: C.white, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), paddingTop: rs(10), paddingHorizontal: rs(20), paddingBottom: rs(32) },
  handle:    { width: rs(40), height: rs(4), backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: rs(2), alignSelf: 'center', marginBottom: rs(16) },
  title:     { fontSize: fs(13), fontWeight: '700', color: C.muted, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: rs(20) },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: rs(12) },
  item:      { width: (SCREEN_W - rs(40) - rs(48)) / 3, alignItems: 'center', gap: rs(6) },
  iconBox:   { width: rs(56), height: rs(56), borderRadius: rs(18), alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: fs(12), fontWeight: '700', color: C.dark },
  itemSub:   { fontSize: fs(10), color: C.muted, textAlign: 'center' },
});

// ─── Caption Modal ────────────────────────────────────────────────────────────
const CaptionModal = ({
  visible, type, onSend, onCancel,
}: {
  visible: boolean;
  type: MsgType;
  onSend: (caption: string) => void;
  onCancel: () => void;
}) => {
  const [caption, setCaption] = useState('');

  const label: Record<MsgType, string> = {
    image: '📷 Photo selected', video: '🎬 Video selected',
    audio: '🎙️ Audio file selected', document: '📄 Document selected',
    pdf: '📑 PDF selected', text: '',
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
              <TouchableOpacity style={cm.cancelBtn} onPress={onCancel}>
                <Text style={cm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.sendBtn} onPress={() => { onSend(caption); setCaption(''); }}>
                <SendIcon active />
                <Text style={cm.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const cm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(24) },
  card:       { width: '100%', backgroundColor: C.white, borderRadius: rs(20), padding: rs(20), gap: rs(14) },
  fileLabel:  { fontSize: fs(14), fontWeight: '700', color: C.dark },
  input:      { backgroundColor: C.bg, borderRadius: rs(14), padding: rs(12), fontSize: fs(13), color: C.dark, minHeight: rs(70), textAlignVertical: 'top' },
  btnRow:     { flexDirection: 'row', gap: rs(10) },
  cancelBtn:  { flex: 1, backgroundColor: C.bg, borderRadius: rs(14), paddingVertical: rs(12), alignItems: 'center' },
  cancelText: { fontSize: fs(13), fontWeight: '600', color: C.muted },
  sendBtn:    { flex: 2, backgroundColor: C.accent, borderRadius: rs(14), paddingVertical: rs(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8) },
  sendText:   { fontSize: fs(13), fontWeight: '700', color: C.white },
});

// ─── Compose Bar ──────────────────────────────────────────────────────────────
const ComposeBar = ({
  onSendText, onAttach, onRecordAudio,
}: {
  onSendText: (text: string) => void;
  onAttach: () => void;
  onRecordAudio: () => void;
}) => {
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

  return (
    <View style={cb.wrap}>
      <TouchableOpacity style={cb.iconBtn} onPress={onAttach} activeOpacity={0.75}>
        <PlusIcon />
      </TouchableOpacity>
      <View style={cb.inputWrap}>
        <TextInput
          style={cb.input}
          placeholder="Type a diary message…"
          placeholderTextColor={C.mutedLight}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity style={cb.emojiBtn} activeOpacity={0.75}>
          <EmojiIcon />
        </TouchableOpacity>
      </View>
      {hasText ? (
        <TouchableOpacity style={cb.sendBtn} onPress={handleSend} activeOpacity={0.8}>
          <SendIcon active />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={cb.micBtn} onPress={onRecordAudio} activeOpacity={0.8}>
          <MicIcon />
        </TouchableOpacity>
      )}
    </View>
  );
};
const cb = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8), paddingHorizontal: rs(12), paddingVertical: rs(8), backgroundColor: C.white, borderTopWidth: 0.8, borderTopColor: C.border },
  iconBtn:   { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(1) },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.bg, borderRadius: rs(22), paddingLeft: rs(14), paddingRight: rs(6), paddingVertical: rs(6), borderWidth: 0.8, borderColor: C.border },
  input:     { flex: 1, fontSize: fs(13), color: C.dark, maxHeight: rs(110), paddingRight: rs(4) },
  emojiBtn:  { width: rs(32), height: rs(32), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtn:   { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(1) },
  micBtn:    { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(1) },
});

// ─── Recording Bar ────────────────────────────────────────────────────────────
const RecordingBar = ({ onStop }: { onStop: () => void }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const loop = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ]).start(loop);
    };
    loop();
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { pulseAnim.stopAnimation(); clearInterval(timer); };
  }, []);

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <View style={rb.wrap}>
      <Animated.View style={[rb.dot, { transform: [{ scale: pulseAnim }] }]} />
      <Text style={rb.timer}>{fmt(elapsed)}</Text>
      <Text style={rb.label}>Recording…  Slide to cancel</Text>
      <TouchableOpacity style={rb.stopBtn} onPress={onStop}>
        <Text style={rb.stopText}>Stop & Send</Text>
      </TouchableOpacity>
    </View>
  );
};
const rb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: rs(10), paddingHorizontal: rs(16), paddingVertical: rs(12), backgroundColor: C.white, borderTopWidth: 0.8, borderTopColor: C.border },
  dot:      { width: rs(10), height: rs(10), borderRadius: rs(5), backgroundColor: C.danger },
  timer:    { fontSize: fs(14), fontWeight: '700', color: C.dark, minWidth: rs(44) },
  label:    { flex: 1, fontSize: fs(12), color: C.muted },
  stopBtn:  { backgroundColor: C.accent, borderRadius: rs(16), paddingHorizontal: rs(14), paddingVertical: rs(8) },
  stopText: { fontSize: fs(12), fontWeight: '700', color: C.white },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const TeacherDiaryScreen = ({ route }: any) => {
  const classLabel = route?.params?.classLabel ?? 'Class 1A';
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const scrollRef  = useRef<ScrollView>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages,       setMessages]       = useState<SentMessage[]>([]);
  const [attachVisible,  setAttachVisible]  = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [pendingType,    setPendingType]    = useState<MsgType>('image');
  const [pendingMedia,   setPendingMedia]   = useState<Partial<SentMessage> | null>(null);
  const [recording,      setRecording]      = useState(false);

  // ── API state ──────────────────────────────────────────────────────────────
  const [contacts,       setContacts]       = useState<Contact[]>([]);
  const [teacherId,      setTeacherId]      = useState<number | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError,   setContactsError]   = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── Load teacher info + contacts on mount ──────────────────────────────────
  useEffect(() => {
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Send a message optimistically, then call API ───────────────────────────
  const addMsg = async (msg: Omit<SentMessage, 'id' | 'timestamp' | 'status'>) => {
    if (contactsLoading) {
      Alert.alert('Loading', 'Student list is still loading. Please wait a moment.');
      return;
    }
    if (contactsError || contacts.length === 0) {
      Alert.alert('No students', 'Could not load student list. Cannot send message.');
      return;
    }
    if (!teacherId) {
      Alert.alert('Session error', 'Teacher ID not found. Please log in again.');
      return;
    }

    const msgId  = `m_${Date.now()}`;
    const newMsg: SentMessage = { ...msg, id: msgId, timestamp: now(), status: 'sending' };

    setMessages(prev => [...prev, newMsg]);
    scrollToBottom();

    // Only text messages are sent via the bulk API.
    // For media, you'd upload the file first then send the URL as content.
    const content = msg.type === 'text'
      ? (msg.text ?? '')
      : msg.type === 'audio'
        ? `[Voice note] ${msg.text ?? ''}`
        : msg.type === 'image'
          ? `[Photo] ${msg.caption ?? ''}`
          : msg.type === 'video'
            ? `[Video] ${msg.caption ?? ''}`
            : `[File] ${msg.fileName ?? ''}`;

    const studentIds = contacts.map(c => c.id);

    try {
      await sendBulkMessage({
        teacher_id:  teacherId,
        student_ids: studentIds,
        content,
      });
      // Mark as sent
      setMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m)
      );
      // Simulate delivery after 2 s
      setTimeout(() => {
        setMessages(prev =>
          prev.map(m => m.id === msgId ? { ...m, status: 'delivered' } : m)
        );
      }, 2000);
    } catch (err: any) {
      console.warn('sendBulkMessage error:', err);
      // Mark as failed by keeping 'sending' and showing alert
      setMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, status: 'sending' } : m)
      );
      Alert.alert('Send failed', err?.message ?? 'Please try again.');
    }
  };

  const handleSendText = (text: string) => addMsg({ type: 'text', text });

  const handleSendMedia = (caption: string) => {
    setCaptionVisible(false);
    if (!pendingMedia) return;
    addMsg({ ...pendingMedia, caption } as any);
    setPendingMedia(null);
  };

  // ── Attachment picking ─────────────────────────────────────────────────────
  const handleSelectType = async (type: 'image' | 'video' | 'audio' | 'document' | 'pdf') => {
    setAttachVisible(false);
    await new Promise(res => setTimeout(res, 400));

    if (type === 'audio') {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      addMsg({ type: 'audio', mediaUri: file.uri, duration: '0:00', text: file.name });
      return;
    }

    if (type === 'image') {
      Alert.alert('Send Photo', 'Choose a source', [
        {
          text: '📷 Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
            if (result.canceled) return;
            setPendingMedia({ type: 'image', mediaUri: result.assets[0].uri });
            setPendingType('image'); setCaptionVisible(true);
          },
        },
        {
          text: '🖼️ Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
            if (result.canceled) return;
            setPendingMedia({ type: 'image', mediaUri: result.assets[0].uri });
            setPendingType('image'); setCaptionVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    if (type === 'video') {
      Alert.alert('Send Video', 'Choose a source', [
        {
          text: '📹 Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: 300 });
            if (result.canceled) return;
            const asset = result.assets[0];
            const d = asset.duration ? Math.round(asset.duration) : 0;
            setPendingMedia({ type: 'video', mediaUri: asset.uri, duration: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` });
            setPendingType('video'); setCaptionVisible(true);
          },
        },
        {
          text: '🎞️ Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: 300 });
            if (result.canceled) return;
            const asset = result.assets[0];
            const d = asset.duration ? Math.round(asset.duration) : 0;
            setPendingMedia({ type: 'video', mediaUri: asset.uri, duration: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` });
            setPendingType('video'); setCaptionVisible(true);
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
    addMsg({ type, fileName: file.name, fileSize: sizeKB, mediaUri: file.uri });
  };

  // ── Recording ──────────────────────────────────────────────────────────────
  const handleStartRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
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
    } catch (e) { console.warn('Stop recording error:', e); }
    addMsg({ type: 'audio', duration: '0:15', text: 'Voice note', mediaUri: uri });
  };

  // ── Today's date label ─────────────────────────────────────────────────────
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const studentCount = contacts.length || (route?.params?.studentCount ?? 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accent} />

      {/* Header */}
      <View style={[s.header, {
        paddingTop: insets.top > 0
          ? insets.top + rs(8)
          : Platform.OS === 'android'
            ? (StatusBar.currentHeight ?? rs(20)) + rs(8)
            : rs(50),
      }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>📓</Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>Class Diary</Text>
          <Text style={s.headerSub}>
            {classLabel}  ·  {contactsLoading ? 'Loading…' : `${studentCount} students`}
          </Text>
        </View>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeText}>SEND</Text>
        </View>
      </View>

      {/* Notice / status bar */}
      {contactsLoading ? (
        <View style={[s.noticeBand, { flexDirection: 'row', justifyContent: 'center', gap: rs(8) }]}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={s.noticeText}>Loading student list…</Text>
        </View>
      ) : contactsError ? (
        <View style={[s.noticeBand, { backgroundColor: C.danger + '15' }]}>
          <Text style={[s.noticeText, { color: C.danger }]}>⚠️  {contactsError}</Text>
        </View>
      ) : (
        <View style={s.noticeBand}>
          <Text style={s.noticeText}>
            📢  Messages you send are visible to all {studentCount} parents in {classLabel}
          </Text>
        </View>
      )}

      {/* Chat area */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        <DateSeparator label={`Today · ${todayLabel}`} />
        {messages.length === 0 && !contactsLoading && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📓</Text>
            <Text style={s.emptyTitle}>No messages yet</Text>
            <Text style={s.emptySub}>Send a diary update, photo, or voice note to all parents.</Text>
          </View>
        )}
        {messages.map((msg) => <SentBubble key={msg.id} msg={msg} />)}
        <View style={{ height: rs(8) }} />
      </ScrollView>

      {/* Compose / Recording */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : rs(4) }}>
          {recording
            ? <RecordingBar onStop={handleStopRecording} />
            : (
              <ComposeBar
                onSendText={handleSendText}
                onAttach={() => setAttachVisible(true)}
                onRecordAudio={handleStartRecording}
              />
            )
          }
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      <AttachMenu visible={attachVisible} onClose={() => setAttachVisible(false)} onSelectType={handleSelectType} />
      <CaptionModal visible={captionVisible} type={pendingType} onSend={handleSendMedia} onCancel={() => setCaptionVisible(false)} />
    </SafeAreaView>
  );
};

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
  backBtn:         { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatar:    { width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatarText:{ fontSize: fs(18) },
  headerInfo:      { flex: 1, gap: rs(2) },
  headerName:      { fontSize: fs(15), fontWeight: '700', color: C.white, letterSpacing: -0.1 },
  headerSub:       { fontSize: fs(11), color: 'rgba(255,255,255,0.72)', fontWeight: '500' },
  headerBadge:     { backgroundColor: C.success, borderRadius: rs(8), paddingHorizontal: rs(8), paddingVertical: rs(3) },
  headerBadgeText: { fontSize: fs(9), fontWeight: '800', color: C.white, letterSpacing: 1 },

  noticeBand:   { backgroundColor: C.accentLight, paddingHorizontal: rs(16), paddingVertical: rs(8), borderBottomWidth: 0.8, borderBottomColor: C.borderMid },
  noticeText:   { fontSize: fs(11), color: C.accent, fontWeight: '500', textAlign: 'center' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: rs(12), paddingTop: rs(8), paddingBottom: rs(12) },

  emptyState:  { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(32) },
  emptyIcon:   { fontSize: rs(48), marginBottom: rs(12) },
  emptyTitle:  { fontSize: fs(16), fontWeight: '700', color: C.dark, marginBottom: rs(6) },
  emptySub:    { fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: fs(20) },
});

export default TeacherDiaryScreen;