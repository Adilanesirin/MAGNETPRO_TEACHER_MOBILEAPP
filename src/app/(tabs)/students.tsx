import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

const STUDENTS = [
  { id: '1',  admNo: 'S/7058', name: 'ALIYA MARIYAM',      div: '1-A', phone: '7907956375', father: 'MUTHARI SHANID',        mother: 'VALAIYAVAIAPPIL AFEEDHA' },
  { id: '2',  admNo: 'S/6910', name: 'MUHAMMED SHEZIN P',  div: '1-A', phone: '8281840198', father: 'SHUAIB CHAKKATIL',       mother: 'ASNA ASHRAF P' },
  { id: '3',  admNo: 'S/7108', name: 'AADAM ASHRAF',        div: '1-A', phone: '9567869005', father: 'ASHRAF ARAMULLAN',       mother: 'SAFFEDA MUHAMMED P P' },
  { id: '4',  admNo: 'S/7023', name: 'ABDUL MUIZZ M',       div: '1-A', phone: '8129828203', father: 'MUHAMMED SHERIEF',       mother: 'SHEEREEN MUHAMMED SHERIEF' },
  { id: '5',  admNo: 'S/7138', name: 'ABDUL NAFIH M',       div: '1-A', phone: '7012761317', father: 'MUSAMMIL V C',           mother: 'MUNFERA M' },
  { id: '6',  admNo: 'S/7005', name: 'AIZAAISHA T P',       div: '1-A', phone: '7025711216', father: 'SIDDEEQUE PUNNAN',       mother: 'ASOORA T P' },
  { id: '7',  admNo: 'S/7051', name: 'AMALIYA MURALI',      div: '1-A', phone: '9633315710', father: 'MURALI M',               mother: 'ASWATHI KRISHNAN K' },
  { id: '8',  admNo: 'S/7080', name: 'AYISHA P V',          div: '1-A', phone: '9207442577', father: 'SHAFI OTTAKKANNAN',      mother: 'SOUDATH P V' },
  { id: '9',  admNo: 'S/6953', name: 'AYSHA ZIYA K K T',   div: '1-A', phone: '8129846366', father: 'SAHIR CHEILEN',          mother: 'KADAKKAN KADAVATH THAYALFPURAYIL SUMIYATH' },
  { id: '10', admNo: 'S/6915', name: 'AZIYA SHAMEEM',       div: '1-A', phone: '9633749024', father: 'SHAMEEM A C',            mother: 'MUBASHIRA C P' },
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

const COLORS = [
  '#1A6D82', '#38A169', '#DD6B20', '#9F7AEA', '#E53E3E',
  '#3182CE', '#D69E2E', '#2A8CA5', '#48BB78', '#FC8181',
];

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

export default function StudentsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filtered = STUDENTS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.admNo.toLowerCase().includes(search.toLowerCase()) ||
    s.father.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item, index }: { item: typeof STUDENTS[0]; index: number }) => {
    const color = COLORS[index % COLORS.length];
    return (
      <FadeSlide delay={index * 60}>
        <TouchableOpacity style={styles.card} activeOpacity={0.85}>
          <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
            <Text style={[styles.avatarText, { color }]}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.adm}>{item.admNo}  •  {item.div}</Text>
            <Text style={styles.parent} numberOfLines={1}>
              Father: {item.father}
            </Text>
          </View>
          <TouchableOpacity style={[styles.callBtn, { borderColor: color + '40' }]}>
            <MaterialIcons name="call" size={20} color={color} />
          </TouchableOpacity>
        </TouchableOpacity>
      </FadeSlide>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Student List</Text>
          <Text style={styles.subtitle}>Class 1  •  Division A</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{STUDENTS.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={22} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, adm no, father name..."
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

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="search-off" size={48} color={theme.colors.border} />
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 3 },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
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
  list: { paddingHorizontal: 20 },
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
  avatarText: { fontWeight: 'bold', fontSize: 16 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 3 },
  adm: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 },
  parent: { fontSize: 12, color: theme.colors.textSecondary },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: theme.colors.textSecondary, fontSize: 16 },
});
