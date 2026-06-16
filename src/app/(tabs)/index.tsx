import { theme } from '@/constants/theme';

import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const STUDENTS_TO_REVIEW = [
  { id: '1', initials: 'AA', name: 'AADAM ASHRAF',    adm: 'S/7108', rate: '67%', bad: true },
  { id: '2', initials: 'AM', name: 'ABDUL MUIZZ M',   adm: 'S/7023', rate: '67%', bad: true },
  { id: '3', initials: 'AM', name: 'ALIYA MARIYAM',   adm: 'S/7058', rate: '83%', bad: false },
  { id: '4', initials: 'RK', name: 'RABEEH K C',      adm: 'S/6986', rate: '83%', bad: false },
  { id: '5', initials: 'YM', name: 'YOUSUF M SHAFI',  adm: 'S/7204', rate: '83%', bad: false },
];

function FadeSlide({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [teacherName, setTeacherName] = React.useState('Teacher');

  React.useEffect(() => {
    AsyncStorage.getItem('magnetpro_user').then((raw) => {
      if (raw) {
        const user = JSON.parse(raw);
        setTeacherName(user?.name || user?.username || 'Teacher');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <FadeSlide delay={0}>
        <LinearGradient
          colors={['#1A6D82', '#2A8CA5']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.teacherName}>{teacherName}</Text>
              <Text style={styles.subtext}>36 students enrolled</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={async () => {
                await AsyncStorage.removeItem('magnetpro_user');
                router.replace('/login');
              }}
            >
              <MaterialIcons name="logout" size={18} color="#fff" />
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          {/* Floating Stats */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>36</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.colors.success }]}>0</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.colors.danger }]}>0</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.colors.holiday }]}>97%</Text>
              <Text style={styles.statLabel}>Monthly</Text>
            </View>
          </View>
        </LinearGradient>
      </FadeSlide>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        {/* Quick Actions */}
        <FadeSlide delay={200}>
          <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/attendance')}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.success + '20' }]}>
                <MaterialIcons name="fact-check" size={28} color={theme.colors.success} />
              </View>
              <Text style={styles.actionTitle}>Mark Attendance</Text>
              <Text style={styles.actionSub}>Daily report</Text>
              <MaterialIcons name="chevron-right" size={20} color={theme.colors.success} style={styles.arrow} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/students')}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '20' }]}>
                <MaterialIcons name="people" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionTitle}>Student List</Text>
              <Text style={styles.actionSub}>View class</Text>
              <MaterialIcons name="chevron-right" size={20} color={theme.colors.primary} style={styles.arrow} />
            </TouchableOpacity>
          </View>

          {/* Progress Cards Card — full-width */}
          <TouchableOpacity
            style={styles.progressCard}
            onPress={() => router.push('/teacherprogresscardscreen')}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBox, { backgroundColor: '#1A6D8220' }]}>
              <MaterialIcons name="assessment" size={28} color="#1A6D82" />
            </View>
            <View style={styles.diaryTextWrap}>
              <Text style={styles.actionTitle}>Progress Cards</Text>
              <Text style={styles.actionSub}>Select students &amp; send progress reports to parents</Text>
            </View>
            <View style={[styles.diaryBadge, { backgroundColor: '#1A6D82' }]}>
              <Text style={styles.diaryBadgeText}>SEND</Text>
            </View>
          </TouchableOpacity>

          {/* Diary Card — full-width */}
          <TouchableOpacity
            style={styles.diaryCard}
            onPress={() => router.push('/teacherdiaryscreen')}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBox, { backgroundColor: '#C97A3A20' }]}>
              <MaterialIcons name="menu-book" size={28} color="#C97A3A" />
            </View>
            <View style={styles.diaryTextWrap}>
              <Text style={styles.actionTitle}>Class Diary</Text>
              <Text style={styles.actionSub}>Send messages, photos, audio &amp; files to parents</Text>
            </View>
            <View style={styles.diaryBadge}>
              <Text style={styles.diaryBadgeText}>SEND</Text>
            </View>
          </TouchableOpacity>
        </FadeSlide>

        {/* Students to Review */}
        <FadeSlide delay={350}>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>STUDENTS TO REVIEW</Text>
          <Text style={styles.sectionSub}>Attendance follow-up list</Text>
          {STUDENTS_TO_REVIEW.map((s, i) => (
            <FadeSlide key={s.id} delay={400 + i * 70}>
              <TouchableOpacity style={styles.reviewCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{s.initials}</Text>
                </View>
                <View style={styles.reviewInfo}>
                  <Text style={styles.reviewName}>{s.name}</Text>
                  <Text style={styles.reviewAdm}>Adm No: {s.adm}</Text>
                </View>
                <Text style={[styles.reviewRate, { color: s.bad ? theme.colors.danger : theme.colors.warning }]}>
                  {s.rate}
                </Text>
              </TouchableOpacity>
            </FadeSlide>
          ))}
        </FadeSlide>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 4 },
  teacherName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  subtext: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    justifyContent: 'space-between',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: theme.colors.border },
  statNum: { fontSize: 22, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingTop: 28 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1, marginBottom: 6 },
  sectionSub: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 14 },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  actionSub: { fontSize: 12, color: theme.colors.textSecondary },
  diaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    gap: 14,
  },
   progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    gap: 14,
  },
  diaryTextWrap: { flex: 1 },
  diaryBadge: {
    backgroundColor: '#C97A3A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  diaryBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  arrow: { position: 'absolute', bottom: 16, right: 16 },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 3 },
  reviewAdm: { fontSize: 12, color: theme.colors.textSecondary },
  reviewRate: { fontSize: 16, fontWeight: 'bold' },
});