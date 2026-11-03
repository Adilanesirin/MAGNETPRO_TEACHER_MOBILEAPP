import { theme } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



// ─── API ──────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://magnetpro.in/api';

async function getToken(): Promise<string> {
  const raw = await AsyncStorage.getItem('magnetpro_user');
  if (!raw) throw new Error('Not logged in');
  const data = JSON.parse(raw);
  console.log('Stored user data:', JSON.stringify(data)); // remove after confirming token key
  const token = data.access;
  if (!token) throw new Error('No token found in stored session');
  return token;
}

async function fetchContacts(token: string): Promise<Student[]> {
  const res = await fetch(`${BASE_URL}/chat/contacts/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.log('Contacts error response:', errBody);
    throw new Error(`Contacts fetch failed: ${res.status}`);
  }
  const data = await res.json();

  // The contacts endpoint returns an array; each item has admno + name fields.
  // Adjust the field names below if the actual response uses different keys.
  const list: any[] = Array.isArray(data) ? data : data.results ?? data.contacts ?? [];
  return list.map((c: any, i: number) => ({
    id: c.admno ?? c.id ?? String(i + 1),
    admno: c.admno ?? c.id ?? String(i + 1),
    name: (c.name ?? c.full_name ?? c.username ?? 'Unknown').toUpperCase(),
  }));
}

async function fetchAttendance(
  token: string,
  year: number,
  month: number,
): Promise<Record<string, Status>> {
  const res = await fetch(`${BASE_URL}/attendance/get/?year=${year}&month=${month}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Attendance fetch failed: ${res.status}`);
  const data = await res.json();
  const records: any[] = data.records ?? [];
  const todayStr = toDateStr(new Date());
  const map: Record<string, Status> = {};
  records
    .filter((r: any) => r.date === todayStr)
    .forEach((r: any) => {
      if (r.admno) map[r.admno] = r.status as Status;
    });
  return map;
}

async function submitAttendance(
  token: string,
  records: { admno: string; date: string; status: Status }[],
): Promise<void> {
  const res = await fetch(`${BASE_URL}/attendance/add/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed (${res.status}): ${text}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'P' | 'A' | 'HD' | 'H' | null;

interface Student {
  id: string;
  admno: string;
  name: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  P:  { label: 'P',  color: theme.colors.success,  bg: theme.colors.success  + '20' },
  A:  { label: 'A',  color: theme.colors.danger,   bg: theme.colors.danger   + '20' },
  HD: { label: 'HD', color: theme.colors.warning,  bg: theme.colors.warning  + '20' },
  H:  { label: 'H',  color: theme.colors.holiday,  bg: theme.colors.holiday  + '20' },
};

// ─── Animations ───────────────────────────────────────────────────────────────
function FadeSlide({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
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

function FabSlide({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: visible ? 1 : 0,  duration: 300, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: visible ? 0 : 30, useNativeDriver: true, bounciness: 6 }),
    ]).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ student, index, attendance, onToggle }: {
  student: Student;
  index: number;
  attendance: Status;
  onToggle: (admno: string, status: Status) => void;
}) {
  return (
    <FadeSlide delay={index * 40}>
      <View style={styles.row}>
        <Text style={styles.rollNo}>{index + 1}</Text>
        <View style={styles.nameBox}>
          <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
          <Text style={styles.admnoText}>{student.admno}</Text>
        </View>
        <View style={styles.btnGroup}>
          {(['P', 'A', 'HD', 'H'] as Status[]).map(s => {
            const cfg = STATUS_CONFIG[s!];
            const active = attendance === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  active && { backgroundColor: cfg.color, borderColor: cfg.color },
                  !active && { borderColor: cfg.color + '60' },
                ]}
                onPress={() => onToggle(student.admno, s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusText, { color: active ? '#fff' : cfg.color }]}>
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </FadeSlide>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();

  const [students, setStudents]     = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [token, setToken]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // NEW: tracks whether today's marked attendance has already been submitted.
  // Used only to hide the submit button after a successful submit.
  const [submittedToday, setSubmittedToday] = useState(false);

  // NEW: drives the submit button's own fill (it doubles as the progress bar)
  // and its press-in scale feedback.
  const submitFillAnim  = useRef(new Animated.Value(0)).current;
  const submitScaleAnim = useRef(new Animated.Value(1)).current;

  const today = new Date();
  const todayStr  = toDateStr(today);
  const todayLabel = today.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Bootstrap: login → contacts → existing attendance ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const tok = await getToken();
        if (cancelled) return;
        setToken(tok);

        const [contactList, existingAtt] = await Promise.all([
          fetchContacts(tok),
          fetchAttendance(tok, today.getFullYear(), today.getMonth() + 1),
        ]);
        if (cancelled) return;

        setStudents(contactList);
        setAttendance(existingAtt);

        // If every student already has a status recorded for today, treat
        // today's attendance as already submitted (hide the submit button).
        if (contactList.length > 0 && Object.keys(existingAtt).length === contactList.length) {
          setSubmittedToday(true);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Toggle ── (editing after a submit re-enables the submit button)
  const toggle = useCallback((admno: string, status: Status) => {
    setAttendance(prev => ({ ...prev, [admno]: prev[admno] === status ? null : status }));
    setSubmittedToday(false);
  }, []);

  // ── Counts ──
  const counts = {
    P:  Object.values(attendance).filter(v => v === 'P').length,
    A:  Object.values(attendance).filter(v => v === 'A').length,
    HD: Object.values(attendance).filter(v => v === 'HD').length,
    H:  Object.values(attendance).filter(v => v === 'H').length,
  };
  const marked = Object.values(attendance).filter(Boolean).length;
  const absentStudents = students.filter(s => attendance[s.admno] === 'A');

  // NEW: the submit button fills proportionally to how much is marked, and
  // locks into its solid "ready" gradient once everyone has a status.
  const submitReady = students.length > 0 && marked === students.length;
  const submitProgress = students.length > 0 ? marked / students.length : 0;

  useEffect(() => {
    Animated.timing(submitFillAnim, {
      toValue: submitProgress,
      duration: 350,
      useNativeDriver: false, // animating width, can't use the native driver
    }).start();
  }, [submitProgress]);

  const handleSubmitPressIn = () => {
    Animated.spring(submitScaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handleSubmitPressOut = () => {
    Animated.spring(submitScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  // ── Bulk Mark ──
  const handleMarkAll = (status: Status) => {
    const all: Record<string, Status> = {};
    students.forEach(s => { all[s.admno] = status; });
    setAttendance(all);
    setSubmittedToday(false);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!token) { Alert.alert('Error', 'Not authenticated. Please restart.'); return; }

    const unmarked = students.filter(s => !attendance[s.admno]);
    if (unmarked.length > 0) {
      Alert.alert(
        'Incomplete',
        `${unmarked.length} student(s) not marked. Mark all before submitting.`,
        [{ text: 'OK' }],
      );
      return;
    }

    // Let the teacher review who's marked absent before it's actually submitted,
    // so a wrong tap can be caught and cancelled instead of only seeing it after.
    const preSubmitAbsenteeLines = absentStudents.length > 0
      ? '\n\nAbsent:\n' + absentStudents.map(s => `• ${s.name} (${s.admno})`).join('\n')
      : '\n\nNo absentees.';

    Alert.alert(
      'Submit Attendance',
      `Present: ${counts.P}  |  Absent: ${counts.A}  |  Half-Day: ${counts.HD}  |  Holiday: ${counts.H}${preSubmitAbsenteeLines}\n\nConfirm submission for ${todayLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            try {
              setSubmitting(true);
              const records = students
                .filter(s => attendance[s.admno])
                .map(s => ({
                  admno: s.admno,
                  date: todayStr,
                  status: attendance[s.admno]!,
                }));
              await submitAttendance(token, records);

              Alert.alert(
                'Success',
                'Attendance submitted successfully!',
                // NEW: once acknowledged, hide the submit button
                [{ text: 'OK', onPress: () => setSubmittedToday(true) }],
              );
            } catch (e: any) {
              Alert.alert('Submit Failed', e.message ?? 'Could not submit attendance.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  // ── Retry ──
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // re-trigger useEffect by faking a state bump — simplest: reload via key approach
    // Instead we duplicate the logic inline:
    (async () => {
      try {
        const tok = await getToken();
        setToken(tok);
        const [contactList, existingAtt] = await Promise.all([
          fetchContacts(tok),
          fetchAttendance(tok, today.getFullYear(), today.getMonth() + 1),
        ]);
        setStudents(contactList);
        setAttendance(existingAtt);
        setSubmittedToday(
          contactList.length > 0 && Object.keys(existingAtt).length === contactList.length
        );
      } catch (e: any) {
        setError(e.message ?? 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading attendance…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="error-outline" size={48} color={theme.colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main ──
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mark Attendance</Text>
          <Text style={styles.subtitle}>Class 1 A  •  {todayLabel}</Text>
        </View>
      </View>

      {/* Summary — unchanged */}
      <View style={styles.summaryRow}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <View key={key} style={[styles.summaryBox, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.summaryNum, { color: cfg.color }]}>{counts[key as keyof typeof counts]}</Text>
            <Text style={[styles.summaryLabel, { color: cfg.color }]}>
              {key === 'HD' ? 'Half' : key === 'H' ? 'Holiday' : key === 'P' ? 'Present' : 'Absent'}
            </Text>
          </View>
        ))}
      </View>

      {/* Bulk Mark — unchanged */}
      <View style={styles.bulkRow}>
        <Text style={styles.bulkLabel}>Bulk Mark:</Text>
        {(['P', 'A', 'HD', 'H'] as Status[]).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.bulkBtn, { borderColor: STATUS_CONFIG[s!].color }]}
            onPress={() => handleMarkAll(s)}
          >
            <Text style={[styles.bulkBtnText, { color: STATUS_CONFIG[s!].color }]}>All {s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend — unchanged */}
      <View style={styles.legend}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: v.color }]} />
            <Text style={styles.legendText}>
              {k === 'HD' ? 'Half Day' : k === 'H' ? 'Holiday' : k === 'P' ? 'Present' : 'Absent'}
            </Text>
          </View>
        ))}
      </View>

      {/* Student List — same styling, just given flex so the footer below can dock properly */}
      <FlatList
        data={students}
        keyExtractor={i => i.id}
        renderItem={({ item, index }) => (
          <StudentRow
            student={item}
            index={index}
            attendance={attendance[item.admno] ?? null}
            onToggle={toggle}
          />
        )}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <MaterialIcons name="people-outline" size={40} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        }
        ListFooterComponent={
          // NEW: absentee list shown after a successful submit
          submittedToday && absentStudents.length > 0 ? (
            <View style={styles.absenteeCard}>
              <Text style={styles.absenteeHeaderText}>
                Absentees Today ({absentStudents.length})
              </Text>
              {absentStudents.map(s => (
                <View key={s.admno} style={styles.absenteeRow}>
                  <Text style={styles.absenteeName}>{s.name}</Text>
                  <Text style={styles.absenteeAdm}>{s.admno}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      {/* Submit — the button itself is the progress indicator: it fills as
          marks come in, then locks into the solid brand gradient once every
          student has a status. Disappears once submittedToday is true. */}
      <FabSlide visible={!submittedToday && marked > 0}>
        <View style={[styles.fab, { paddingBottom: insets.bottom + 16 }]}>
          <Animated.View style={{ transform: [{ scale: submitScaleAnim }] }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleSubmit}
              onPressIn={handleSubmitPressIn}
              onPressOut={handleSubmitPressOut}
              disabled={submitting}
              style={[styles.submitTrack, submitReady && styles.submitTrackReady]}
            >
              {/* Fill layer — width tracks progress; solid gradient once ready */}
              <Animated.View
                style={[
                  styles.submitFill,
                  submitReady
                    ? { width: '100%' }
                    : {
                        width: submitFillAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                ]}
              >
                <LinearGradient
                  colors={submitReady ? ['#1A6D82', '#2A8CA5'] : [theme.colors.primary + '33', theme.colors.primary + '33']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>

              {/* Foreground content */}
              <View style={[styles.submitContent, !submitReady && styles.submitContentPending]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : submitReady ? (
                  <>
                    <View style={styles.submitReadyLeft}>
                      <Text style={styles.submitTextReady}>Submit Attendance</Text>
                      <View style={styles.submitCountPill}>
                        <Text style={styles.submitCountText}>{marked}/{students.length}</Text>
                      </View>
                    </View>
                    <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                  </>
                ) : (
                  <>
                    <MaterialIcons name="edit-note" size={17} color={theme.colors.primary} />
                    <Text style={styles.submitTextPending}>
                      {marked}/{students.length} marked — finish to submit
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </FabSlide>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.colors.background },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 15, color: theme.colors.textSecondary },
  errorText:   { marginTop: 12, fontSize: 14, color: theme.colors.danger, textAlign: 'center' },
  retryBtn:    {
    marginTop: 20, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24, backgroundColor: theme.colors.primary,
  },
  retryText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  header:   { paddingHorizontal: 24, paddingVertical: 16 },
  title:    { fontSize: 26, fontWeight: 'bold', color: theme.colors.text },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },

  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  summaryBox: { flex: 1, padding: 12, borderRadius: 16, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '600' },

  bulkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  bulkLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  bulkBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1.5 },
  bulkBtnText: { fontSize: 12, fontWeight: '700' },

  legend: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12, gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.colors.textSecondary },

  // NEW: list now takes flex so the footer below docks at the bottom instead
  // of floating over the list content
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 10, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  rollNo:      { width: 24, fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  nameBox:     { flex: 1, marginRight: 10 },
  studentName: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  admnoText:   { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  btnGroup:    { flexDirection: 'row', gap: 6 },
  statusBtn:   {
    width: 34, height: 34, borderRadius: 10,
    borderWidth: 1.5, justifyContent: 'center',
    alignItems: 'center', backgroundColor: 'transparent',
  },
  statusText: { fontSize: 11, fontWeight: '800' },

  // NEW: absentee list card (only rendered after a successful submit)
  absenteeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  absenteeHeaderText: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  absenteeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  absenteeName: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  absenteeAdm:  { fontSize: 12, color: theme.colors.textSecondary },

  emptyBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary },

  // Submit — CHANGED: was `position: absolute` (floating pill over the list);
  // now it's a normal docked footer that sits below the FlatList.
  fab: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  // Track: the button's own background IS the progress indicator — a pale
  // shell that fills left-to-right as students get marked, then locks into
  // the solid brand gradient once everyone has a status.
  submitTrack: {
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.border + '70',
    justifyContent: 'center',
  },
  submitTrackReady: {
    elevation: 8,
    shadowColor: '#1A6D82',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  submitFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 20,
  },
  submitContentPending: { justifyContent: 'center', gap: 8 },
  submitReadyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitTextReady: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  submitTextPending: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  submitCountPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  submitCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});