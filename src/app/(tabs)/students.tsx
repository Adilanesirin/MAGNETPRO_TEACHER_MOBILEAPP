import { theme } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Linking,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: number;
  name: string;
  admission_no?: string;
  adm_no?: string;
  division?: string;
  div?: string;
  phone?: string;
  mobile?: string;
  father_name?: string;
  father?: string;
  mother_name?: string;
  mother?: string;
  role?: string;
}

interface StoredUser {
  id: number;
  token?: string;
  institution_id?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function fetchStudentsFromApi(): Promise<Student[]> {
  const user = await getStoredUser();
  if (!user) throw new Error('Session expired. Please log in again.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

  const params = new URLSearchParams({
    role:           'teacher',
    user_id:        String(user.id),
    institution_id: user.institution_id ?? '',
  });

  const res = await fetch(`${BASE_URL}/chat/contacts/?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) throw new Error(`Failed to load students (${res.status})`);

  const data = await res.json();
  if (Array.isArray(data))           return data;
  if (Array.isArray(data.results))   return data.results;
  if (Array.isArray(data.contacts))  return data.contacts;
  if (Array.isArray(data.students))  return data.students;
  return [];
}

// Normalise field names — API may use different keys across versions
function normStudent(s: Student) {
  return {
    id:        s.id,
    name:      s.name ?? '',
    admNo:     s.admission_no ?? s.adm_no ?? '',
    division:  s.division ?? s.div ?? '',
    phone:     s.phone ?? s.mobile ?? '',
    father:    s.father_name ?? s.father ?? '',
    mother:    s.mother_name ?? s.mother ?? '',
  };
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
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
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
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

  const [students,   setStudents]   = useState<ReturnType<typeof normStudent>[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const loadStudents = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const raw = await fetchStudentsFromApi();
      setStudents(raw.map(normStudent));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, []);

  const onRefresh = () => { setRefreshing(true); loadStudents(true); };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(q)   ||
    s.admNo.toLowerCase().includes(q)  ||
    s.father.toLowerCase().includes(q)
  );

  // ── Call helper ──────────────────────────────────────────────────────────────
  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  // ── Render item ──────────────────────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: ReturnType<typeof normStudent>; index: number }) => {
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    return (
      <FadeSlide delay={index * 50}>
        <TouchableOpacity style={styles.card} activeOpacity={0.85}>
          <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
            <Text style={[styles.avatarText, { color }]}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.adm}>
              {[item.admNo, item.division].filter(Boolean).join('  •  ')}
            </Text>
            {item.father ? (
              <Text style={styles.parent} numberOfLines={1}>Father: {item.father}</Text>
            ) : null}
          </View>
          {item.phone ? (
            <TouchableOpacity
              style={[styles.callBtn, { borderColor: color + '40' }]}
              onPress={() => handleCall(item.phone)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="call" size={20} color={color} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.callBtn, { borderColor: theme.colors.border, opacity: 0.3 }]}>
              <MaterialIcons name="call" size={20} color={theme.colors.textSecondary} />
            </View>
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
          <Text style={styles.title}>Student List</Text>
          <Text style={styles.subtitle}>
            {students.length > 0 && students[0].division
              ? `Class · ${students[0].division}`
              : 'Your class'}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{students.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={22} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, adm no, father name…"
          placeholderTextColor={theme.colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

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
            <MaterialIcons name="search-off" size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>
              {search ? 'No students match your search' : 'No students found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.colors.background },
  center:      { justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title:       { fontSize: 26, fontWeight: 'bold', color: theme.colors.text },
  subtitle:    { fontSize: 14, color: theme.colors.textSecondary, marginTop: 3 },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText:   { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 25,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  list:        { paddingHorizontal: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText:   { fontWeight: 'bold', fontSize: 16 },
  info:         { flex: 1 },
  name:         { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 3 },
  adm:          { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 },
  parent:       { fontSize: 12, color: theme.colors.textSecondary },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  retryText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
});