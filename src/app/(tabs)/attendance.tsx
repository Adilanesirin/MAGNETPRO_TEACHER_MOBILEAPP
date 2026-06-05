import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

const STUDENTS = [
  { id: '1',  name: 'ALIYA MARIYAM' },
  { id: '2',  name: 'MUHAMMED SHEZIN P' },
  { id: '3',  name: 'AADAM ASHRAF' },
  { id: '4',  name: 'ABDUL MUIZZ M' },
  { id: '5',  name: 'ABDUL NAFIH M' },
  { id: '6',  name: 'AIZAAISHA T P' },
  { id: '7',  name: 'AMALIYA MURALI' },
  { id: '8',  name: 'AYISHA P V' },
  { id: '9',  name: 'AYSHA ZIYA K K T' },
  { id: '10', name: 'AZIYA SHAMEEM' },
];

type Status = 'P' | 'A' | 'HD' | 'H' | null;

const STATUS_CONFIG = {
  P:  { label: 'P',  color: theme.colors.success,  bg: theme.colors.success  + '20' },
  A:  { label: 'A',  color: theme.colors.danger,   bg: theme.colors.danger   + '20' },
  HD: { label: 'HD', color: theme.colors.warning,  bg: theme.colors.warning  + '20' },
  H:  { label: 'H',  color: theme.colors.holiday,  bg: theme.colors.holiday  + '20' },
};

function FadeSlide({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
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
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: visible ? 0 : 30, useNativeDriver: true, bounciness: 6 }),
    ]).start();
  }, [visible]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function StudentRow({ student, index, attendance, onToggle }: {
  student: { id: string; name: string };
  index: number;
  attendance: Status;
  onToggle: (id: string, status: Status) => void;
}) {
  return (
    <FadeSlide delay={index * 50}>
      <View style={styles.row}>
        <Text style={styles.rollNo}>{index + 1}</Text>
        <View style={styles.nameBox}>
          <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
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
                onPress={() => onToggle(student.id, s)}
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

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [attendance, setAttendance] = useState<Record<string, Status>>({});

  const toggle = useCallback((id: string, status: Status) => {
    setAttendance(prev => ({ ...prev, [id]: prev[id] === status ? null : status }));
  }, []);

  const counts = {
    P:  Object.values(attendance).filter(v => v === 'P').length,
    A:  Object.values(attendance).filter(v => v === 'A').length,
    HD: Object.values(attendance).filter(v => v === 'HD').length,
    H:  Object.values(attendance).filter(v => v === 'H').length,
  };
  const marked = Object.values(attendance).filter(Boolean).length;

  const handleMarkAll = (status: Status) => {
    const all: Record<string, Status> = {};
    STUDENTS.forEach(s => { all[s.id] = status; });
    setAttendance(all);
  };

  const handleSubmit = () => {
    Alert.alert('Attendance Submitted', `Present: ${counts.P}  |  Absent: ${counts.A}  |  Half-Day: ${counts.HD}  |  Holiday: ${counts.H}`, [{ text: 'OK' }]);
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mark Attendance</Text>
          <Text style={styles.subtitle}>Class 1 A  •  {today}</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <View key={key} style={[styles.summaryBox, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.summaryNum, { color: cfg.color }]}>{counts[key as Status & string]}</Text>
            <Text style={[styles.summaryLabel, { color: cfg.color }]}>{key === 'HD' ? 'Half' : key === 'H' ? 'Holiday' : key === 'P' ? 'Present' : 'Absent'}</Text>
          </View>
        ))}
      </View>

      {/* Bulk Mark */}
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

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: v.color }]} />
            <Text style={styles.legendText}>{k === 'HD' ? 'Half Day' : k === 'H' ? 'Holiday' : k === 'P' ? 'Present' : 'Absent'}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={STUDENTS}
        keyExtractor={i => i.id}
        renderItem={({ item, index }) => (
          <StudentRow
            student={item}
            index={index}
            attendance={attendance[item.id] ?? null}
            onToggle={toggle}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      />

      {/* Submit FAB */}
      <View style={[styles.fab, { bottom: insets.bottom + 88 }]}>
        <FabSlide visible={marked > 0}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.9}>
            <Text style={styles.submitText}>Submit  ({marked}/{STUDENTS.length})</Text>
            <MaterialIcons name="check-circle" size={22} color="#fff" />
          </TouchableOpacity>
        </FabSlide>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: theme.colors.text },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryNum: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  bulkLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  bulkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  bulkBtnText: { fontSize: 12, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 14,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.colors.textSecondary },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  rollNo: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  nameBox: { flex: 1, marginRight: 10 },
  studentName: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  btnGroup: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  fab: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 32,
    gap: 10,
    elevation: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
