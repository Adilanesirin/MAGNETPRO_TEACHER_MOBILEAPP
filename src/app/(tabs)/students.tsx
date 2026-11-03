import { theme } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── API Config ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://magnetpro.in/api';
const POLL_INTERVAL = 30_000; // 30 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawContact {
  id: number;
  name: string;
  role?: string;
  class?: string;
  div?: string;
  division?: string;
  room_id?: number;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  is_online?: boolean;
  admno?: string;
  admission_no?: string;
  adm_no?: string;
  phone?: string;
  mobile?: string;
  father_name?: string;
  father?: string;
}

interface Student {
  id: number;
  name: string;
  admNo: string;
  classNo: string;
  division: string;
  phone: string;
  father: string;
  roomId: number | null;
  lastMessage: string;
  lastMessageTime: string | null;
  unreadCount: number;
  isOnline: boolean;
}

interface StoredUser {
  id: number;
  token?: string;
  institution_id?: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

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
  } catch {
    return null;
  }
}

async function fetchContactsFromApi(): Promise<RawContact[]> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired. Please log in again.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

  const params = new URLSearchParams({
    role: 'teacher',
    user_id: String(user.id),
    institution_id: user.institution_id ?? '',
  });

  const res = await fetch(`${BASE_URL}/chat/contacts/?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) throw new Error(`Failed to load students (${res.status})`);

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.contacts)) return data.contacts;
  if (Array.isArray(data.students)) return data.students;
  return [];
}

async function getOrCreateRoom(studentId: number): Promise<number> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

  const res = await fetch(`${BASE_URL}/chat/get-room/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ teacher_id: user.id, student_id: studentId }),
  });

  if (!res.ok) throw new Error(`Room fetch failed (${res.status})`);
  const data = await res.json();
  const roomId =
    data?.room_id ??
    data?.id ??
    data?.room?.id ??
    data?.room?.room_id ??
    data?.data?.room_id ??
    data?.data?.id ??
    data?.result?.room_id;

  if (roomId == null) {
    throw new Error('Room fetch succeeded but no room_id was returned.');
  }

  return Number(roomId);
}

// ─── Normalise ────────────────────────────────────────────────────────────────

function normContact(c: RawContact): Student {
  return {
    id:              c.id,
    name:            c.name ?? '',
    admNo:           c.admno ?? c.admission_no ?? c.adm_no ?? '',
    classNo:         c.class ?? '',
    division:        c.division ?? c.div ?? '',
    phone:           c.phone ?? c.mobile ?? '',
    father:          c.father_name ?? c.father ?? '',
    roomId:          c.room_id ?? null,
    lastMessage:     c.last_message ?? '',
    lastMessageTime: c.last_message_time ?? null,
    unreadCount:     c.unread_count ?? 0,
    isOnline:        c.is_online ?? false,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-GB', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}

const AVATAR_COLORS = [
  '#1A6D82', '#38A169', '#DD6B20', '#9F7AEA', '#E53E3E',
  '#3182CE', '#D69E2E', '#2A8CA5', '#48BB78', '#FC8181',
];

// ─── Animated row ─────────────────────────────────────────────────────────────

function FadeSlide({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StudentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [students,     setStudents]     = useState<Student[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [unreadOnly,   setUnreadOnly]   = useState(false);
  const [openingId,    setOpeningId]    = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Total unread count for header badge ──────────────────────────────────────
  const totalUnread = students.reduce((acc, s) => acc + s.unreadCount, 0);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const loadStudents = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const raw = await fetchContactsFromApi();
      const normed = raw.map(normContact);

      // Sort by latest message time (most recent first)
      normed.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setStudents(normed);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Initial load + polling ────────────────────────────────────────────────────
  useEffect(() => {
    loadStudents();

    pollRef.current = setInterval(() => {
      loadStudents(true); // silent refresh every 30s
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadStudents]);

  const onRefresh = () => { setRefreshing(true); loadStudents(true); };

  // ── Open chat ─────────────────────────────────────────────────────────────────
  const handleOpenChat = async (student: Student) => {
    try {
      setOpeningId(student.id);

      // Use cached room_id if available, otherwise fetch from API
      let roomId = student.roomId;
      if (!roomId) {
        roomId = await getOrCreateRoom(student.id);
      }
      console.log('[open chat] student_id:', student.id, 'room_id:', roomId);

      // Mark as read locally (optimistic update)
      setStudents(prev =>
        prev.map(s => s.id === student.id ? { ...s, unreadCount: 0 } : s)
      );

      // Navigate to individual chat screen
      router.push({
        pathname: '/(tabs)/personalchat',
        params: {
          roomId:      String(roomId),
          studentId:   String(student.id),
          studentName: student.name,
          admNo:       student.admNo,
          classNo:     student.classNo,
          division:    student.division,
          isOnline:    student.isOnline ? '1' : '0',
        },
      });
    } catch (err: any) {
      // If room creation fails, still navigate with student info
      router.push({
        pathname: '/(tabs)/personalchat',
        params: {
          roomId:      'new',
          studentId:   String(student.id),
          studentName: student.name,
        },
      });
    } finally {
      setOpeningId(null);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = students
    .filter(s =>
      s.name.toLowerCase().includes(q)   ||
      s.admNo.toLowerCase().includes(q)  ||
      s.father.toLowerCase().includes(q)
    )
    .filter(s => (unreadOnly ? s.unreadCount > 0 : true));

  // ── Render item ──────────────────────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: Student; index: number }) => {
    const color     = AVATAR_COLORS[item.id % AVATAR_COLORS.length];
    const isOpening = openingId === item.id;
    const hasUnread = item.unreadCount > 0;

    return (
      <FadeSlide delay={Math.min(index * 40, 400)}>
        <TouchableOpacity
          style={[styles.card, hasUnread && styles.cardUnread]}
          activeOpacity={0.82}
          onPress={() => handleOpenChat(item)}
          disabled={isOpening}
        >
          {/* Avatar with online dot */}
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
              <Text style={[styles.avatarText, { color }]}>{getInitials(item.name)}</Text>
            </View>
            {item.isOnline && <View style={styles.onlineDot} />}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, hasUnread && styles.nameBold]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.lastMessageTime ? (
                <Text style={[styles.timeText, hasUnread && styles.timeUnread]}>
                  {formatTime(item.lastMessageTime)}
                </Text>
              ) : null}
            </View>

            <Text style={styles.adm}>
              {[item.admNo, item.classNo, item.division].filter(Boolean).join('  •  ')}
            </Text>

            <View style={styles.lastMsgRow}>
              <Text
                style={[styles.lastMsg, hasUnread && styles.lastMsgBold]}
                numberOfLines={1}
              >
                Tap to chat
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Opening spinner */}
          {isOpening && (
            <ActivityIndicator size="small" color={color} style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>
      </FadeSlide>
    );
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="cloud-off" size={52} color={theme.colors.border} />
        <Text style={styles.errorTitle}>Could not load students</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadStudents()}>
          <MaterialIcons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>STUDENTS</Text>
          <Text style={styles.subtitle}>
            {students.length > 0 && students[0].classNo
              ? `Class ${students[0].classNo}${students[0].division ? ` · ${students[0].division}` : ''}`
              : 'Your class'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {totalUnread > 0 && (
            <View style={styles.totalUnreadBadge}>
              <MaterialIcons name="chat" size={13} color="#fff" />
              <Text style={styles.totalUnreadText}>{totalUnread}</Text>
            </View>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{students.length}</Text>
          </View>
        </View>
      </View>

      {/* Search + Unread filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, adm no, father…"
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, unreadOnly && styles.filterBtnActive]}
          onPress={() => setUnreadOnly(v => !v)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="mark-chat-unread"
            size={18}
            color={unreadOnly ? '#fff' : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Filter label */}
      {unreadOnly && (
        <View style={styles.filterLabel}>
          <Text style={styles.filterLabelText}>
            Showing {filtered.length} unread conversation{filtered.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={() => setUnreadOnly(false)}>
            <Text style={styles.filterLabelClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons
              name={unreadOnly ? 'mark-chat-read' : 'search-off'}
              size={48}
              color={theme.colors.border}
            />
            <Text style={styles.emptyText}>
              {unreadOnly
                ? 'No unread messages'
                : search
                ? 'No students match your search'
                : 'No students found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  center:     { justifyContent: 'center', alignItems: 'center', gap: 12 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title:      { fontSize: 26, fontWeight: 'bold', color: theme.colors.text },
  subtitle:   { fontSize: 14, color: theme.colors.textSecondary, marginTop: 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalUnreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E53E3E',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  totalUnreadText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  countBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  countText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  filterBtnActive: { backgroundColor: theme.colors.primary },

  // Filter label
  filterLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 8,
  },
  filterLabelText:  { fontSize: 12, color: theme.colors.textSecondary },
  filterLabelClear: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },

  // List
  list: { paddingHorizontal: 16, paddingTop: 6 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardUnread: {
    elevation: 4,
    shadowOpacity: 0.1,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },

  // Avatar
  avatarWrap:  { position: 'relative', marginRight: 14 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText:  { fontWeight: 'bold', fontSize: 17 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38A169',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Info
  info:       { flex: 1, minWidth: 0 },
  nameRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name:       { fontSize: 15, fontWeight: '600', color: theme.colors.text, flex: 1, marginRight: 8 },
  nameBold:   { fontWeight: '700' },
  timeText:   { fontSize: 11, color: theme.colors.textSecondary, flexShrink: 0 },
  timeUnread: { color: theme.colors.primary, fontWeight: '600' },

  adm:        { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 3 },

  lastMsgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMsg:    { fontSize: 13, color: theme.colors.textSecondary, flex: 1, marginRight: 8 },
  lastMsgBold:{ color: theme.colors.text, fontWeight: '600' },

  // Unread badge
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Empty / states
  empty:        { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText:    { color: theme.colors.textSecondary, fontSize: 16 },
  loadingText:  { color: theme.colors.textSecondary, fontSize: 15, marginTop: 8 },
  errorTitle:   { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  errorSub:     { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
