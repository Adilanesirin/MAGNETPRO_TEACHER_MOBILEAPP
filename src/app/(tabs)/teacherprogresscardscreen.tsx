/**
 * TeacherProgressCardScreen.tsx
 * ─────────────────────────────────────────────────────────────────
 * Flow:
 *   Step 1 — Setup        : Select Term, Year, Syllabus, Report Type
 *   Step 2 — Select       : Pick students
 *   Step 3 — Fill Card    : Per-student progress card editor
 *                           (subjects, marks, grade, attendance,
 *                            co-curricular, conduct, remarks)
 *   Step 4 — Review & Send: Preview generated PDF → send to parents
 *
 * Parent receives: PDF generated from structured data, visible in
 * ProgressCardScreen.tsx via the existing card list.
 * ─────────────────────────────────────────────────────────────────
 */

import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Responsive helpers ───────────────────────────────────────────
const { width } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = width / BASE_WIDTH;
const rs = (n: number) => Math.round(n * Math.min(scale, 1.45));
const fs = (n: number) =>
  Math.round((n * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Colors ──────────────────────────────────────────────────────
const C = {
  accent:       '#0E7EA4',
  accentDark:   '#0A5F7A',
  accentMid:    '#1591B8',
  accentLight:  '#EDF6FA',
  accentBg:     '#F2F8FA',
  amber:        '#C97A3A',
  amberLight:   '#FEF3EC',
  success:      '#38A169',
  successLight: '#F0FFF4',
  danger:       '#E53E3E',
  bg:           '#F2F5F7',
  surface:      '#FFFFFF',
  dark:         '#1A2B35',
  body:         '#2C3E50',
  muted:        '#7AA0B0',
  border:       'rgba(14,126,164,0.10)',
  borderMed:    'rgba(14,126,164,0.18)',
  white:        '#FFFFFF',
};

// ─── Data ────────────────────────────────────────────────────────
const STUDENTS = [
  { id: '1',  admNo: 'S/7058', name: 'ALIYA MARIYAM',     div: '1-A', phone: '7907956375' },
  { id: '2',  admNo: 'S/6910', name: 'MUHAMMED SHEZIN P', div: '1-A', phone: '8281840198' },
  { id: '3',  admNo: 'S/7108', name: 'AADAM ASHRAF',      div: '1-A', phone: '9567869005' },
  { id: '4',  admNo: 'S/7023', name: 'ABDUL MUIZZ M',     div: '1-A', phone: '8129828203' },
  { id: '5',  admNo: 'S/7138', name: 'ABDUL NAFIH M',     div: '1-A', phone: '7012761317' },
  { id: '6',  admNo: 'S/7005', name: 'AIZAAISHA T P',     div: '1-A', phone: '7025711216' },
  { id: '7',  admNo: 'S/7051', name: 'AMALIYA MURALI',    div: '1-A', phone: '9633315710' },
  { id: '8',  admNo: 'S/7080', name: 'AYISHA P V',        div: '1-A', phone: '9207442577' },
  { id: '9',  admNo: 'S/6953', name: 'AYSHA ZIYA K K T',  div: '1-A', phone: '8129846366' },
  { id: '10', admNo: 'S/6915', name: 'AZIYA SHAMEEM',     div: '1-A', phone: '9633749024' },
  { id: '11', admNo: 'S/7204', name: 'YOUSUF M SHAFI',    div: '1-A', phone: '9895041234' },
  { id: '12', admNo: 'S/6986', name: 'RABEEH K C',        div: '1-A', phone: '9847012345' },
];

const TERMS        = ['Term 1', 'Term 2', 'Term 3', 'Annual'];
const YEARS        = ['2023-24', '2024-25', '2025-26'];
const SYLLABUSES   = ['CBSE', 'ICSE', 'State Board', 'Other'];
const REPORT_TYPES = ['Holistic Progress Card', 'Quarterly Report', 'Mid-Term Report', 'Final Report'];

// Grades scale
const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E'];
const GRADE_POINTS: Record<string, number> = {
  'A+': 10, 'A': 9, 'B+': 8, 'B': 7, 'C+': 6, 'C': 5, 'D': 4, 'E': 0,
};

// Fixed subjects (teacher fills marks/grade per student)
const DEFAULT_SUBJECTS = [
  { id: 'lang1', name: 'Language I',        maxMarks: 100, theoryMax: 80, practicalMax: 20 },
  { id: 'lang2', name: 'Language II',       maxMarks: 100, theoryMax: 80, practicalMax: 20 },
  { id: 'math',  name: 'Mathematics',       maxMarks: 100, theoryMax: 80, practicalMax: 20 },
  { id: 'sci',   name: 'Science',           maxMarks: 100, theoryMax: 80, practicalMax: 20 },
  { id: 'sst',   name: 'Social Studies',    maxMarks: 100, theoryMax: 80, practicalMax: 20 },
  { id: 'comp',  name: 'Computer Science',  maxMarks: 100, theoryMax: 80, practicalMax: 20 },
  { id: 'art',   name: 'Art & Craft',       maxMarks: 50,  theoryMax: 50, practicalMax: 0  },
  { id: 'pe',    name: 'Physical Education',maxMarks: 50,  theoryMax: 50, practicalMax: 0  },
];

const CO_CURRICULAR = [
  'Sports & Games', 'Cultural Activities', 'Debate / Elocution',
  'Science Club', 'Art & Craft Club', 'Music', 'Community Service',
];

const CONDUCT_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Satisfactory', 'Needs Improvement'];

// ─── Types ───────────────────────────────────────────────────────
interface SubjectEntry {
  subjectId: string;
  theory: string;
  practical: string;
  grade: string;
}

interface StudentCard {
  studentId: string;
  subjects: SubjectEntry[];
  attendancePresent: string;
  attendanceTotal: string;
  coCurricular: string[];
  conduct: string;
  classTeacherRemark: string;
  principalRemark: string;
  result: 'Pass' | 'Fail' | 'Promoted' | '';
}

type Step = 'setup' | 'select' | 'fill' | 'review';

// ─── Helpers ─────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  '#0E7EA4','#38A169','#DD6B20','#9F7AEA',
  '#E53E3E','#3182CE','#D69E2E','#2A8CA5',
];

function calcTotal(entry: SubjectEntry, sub: typeof DEFAULT_SUBJECTS[0]) {
  const t = parseInt(entry.theory)    || 0;
  const p = parseInt(entry.practical) || 0;
  return t + p;
}

function calcPercentage(cards: StudentCard) {
  let obtained = 0, total = 0;
  DEFAULT_SUBJECTS.forEach(sub => {
    const e = cards.subjects.find(s => s.subjectId === sub.id);
    if (e) { obtained += calcTotal(e, sub); total += sub.maxMarks; }
  });
  if (total === 0) return '—';
  return ((obtained / total) * 100).toFixed(1) + '%';
}

function blankCard(studentId: string): StudentCard {
  return {
    studentId,
    subjects: DEFAULT_SUBJECTS.map(s => ({
      subjectId: s.id, theory: '', practical: '', grade: '',
    })),
    attendancePresent: '',
    attendanceTotal: '',
    coCurricular: [],
    conduct: 'Good',
    classTeacherRemark: '',
    principalRemark: '',
    result: '',
  };
}

// ─── PDF HTML Generator ───────────────────────────────────────────
function buildProgressCardHtml(
  student: typeof STUDENTS[0],
  card: StudentCard,
  setup: { term: string; year: string; syllabus: string; reportType: string },
): string {
  const rows = DEFAULT_SUBJECTS.map(sub => {
    const e = card.subjects.find(s => s.subjectId === sub.id);
    const theory    = e?.theory    || '—';
    const practical = e?.practical || (sub.practicalMax === 0 ? 'N/A' : '—');
    const total     = e ? calcTotal(e, sub) : '—';
    const grade     = e?.grade || '—';
    return `
      <tr>
        <td>${sub.name}</td>
        <td class="ctr">${sub.theoryMax}</td>
        <td class="ctr">${theory}</td>
        <td class="ctr">${sub.practicalMax || 'N/A'}</td>
        <td class="ctr">${practical}</td>
        <td class="ctr">${sub.maxMarks}</td>
        <td class="ctr bold">${total}</td>
        <td class="ctr grade">${grade}</td>
      </tr>`;
  }).join('');

  const attendance = card.attendancePresent && card.attendanceTotal
    ? `${card.attendancePresent} / ${card.attendanceTotal}`
    : '— / —';

  const attPct = card.attendancePresent && card.attendanceTotal
    ? ((parseInt(card.attendancePresent) / parseInt(card.attendanceTotal)) * 100).toFixed(1) + '%'
    : '—';

  const coCurr = card.coCurricular.length > 0
    ? card.coCurricular.join(', ')
    : '—';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4f8; padding:20px; color:#1a2b35; }
  .card { background:#fff; border-radius:12px; overflow:hidden; max-width:700px; margin:0 auto; box-shadow:0 4px 24px rgba(0,0,0,0.10); }
  .header { background:linear-gradient(135deg,#0A5F7A,#1591B8); padding:24px 28px 20px; color:#fff; }
  .school-name { font-size:20px; font-weight:800; letter-spacing:0.5px; margin-bottom:4px; }
  .school-sub  { font-size:11px; opacity:0.7; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:16px; }
  .card-title  { font-size:15px; font-weight:700; opacity:0.9; margin-bottom:2px; }
  .term-badge  { display:inline-block; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.3); border-radius:20px; padding:3px 12px; font-size:11px; font-weight:700; margin-top:6px; }
  .info-grid   { display:grid; grid-template-columns:1fr 1fr; gap:0; background:#EDF6FA; border-bottom:1px solid rgba(14,126,164,0.12); }
  .info-cell   { padding:12px 20px; border-right:1px solid rgba(14,126,164,0.12); }
  .info-cell:last-child { border-right:none; }
  .info-label  { font-size:9px; font-weight:700; color:#7AA0B0; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:3px; }
  .info-value  { font-size:13px; font-weight:700; color:#1a2b35; }
  .section     { padding:18px 20px 0; }
  .section-title { font-size:10px; font-weight:700; color:#0E7EA4; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  .section-title::after { content:''; flex:1; height:1px; background:rgba(14,126,164,0.15); }
  table  { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:18px; }
  th     { background:#0E7EA4; color:#fff; padding:8px 6px; font-size:10px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; }
  td     { padding:8px 6px; border-bottom:1px solid rgba(14,126,164,0.08); }
  tr:last-child td { border-bottom:none; }
  tr:nth-child(even) td { background:#F8FBFC; }
  .ctr   { text-align:center; }
  .bold  { font-weight:700; }
  .grade { font-weight:800; color:#0E7EA4; }
  .stat-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:18px; }
  .stat-box  { background:#EDF6FA; border-radius:8px; padding:12px 14px; border:1px solid rgba(14,126,164,0.12); }
  .stat-label { font-size:9px; font-weight:700; color:#7AA0B0; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
  .stat-value { font-size:18px; font-weight:800; color:#0E7EA4; }
  .stat-sub   { font-size:10px; color:#7AA0B0; margin-top:2px; }
  .co-box  { background:#F8FBFC; border-radius:8px; padding:12px 14px; border:1px solid rgba(14,126,164,0.10); margin-bottom:18px; font-size:12px; color:#2C3E50; line-height:1.6; }
  .remark-box { background:#F8FBFC; border-radius:8px; padding:12px 14px; border:1px solid rgba(14,126,164,0.10); margin-bottom:14px; }
  .remark-label { font-size:9px; font-weight:700; color:#7AA0B0; letter-spacing:1px; text-transform:uppercase; margin-bottom:5px; }
  .remark-text  { font-size:12px; color:#2C3E50; line-height:1.6; }
  .footer { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; border-top:1px solid rgba(14,126,164,0.12); margin-top:8px; }
  .footer-cell { padding:16px 20px; text-align:center; border-right:1px solid rgba(14,126,164,0.10); }
  .footer-cell:last-child { border-right:none; }
  .sig-line { height:1px; background:#ccc; margin:24px 0 6px; }
  .sig-label { font-size:9px; color:#7AA0B0; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; }
  .result-badge { display:inline-block; padding:4px 16px; border-radius:20px; font-size:11px; font-weight:800; letter-spacing:0.5px; }
  .result-pass { background:#F0FFF4; color:#38A169; border:1px solid rgba(56,161,105,0.3); }
  .result-fail { background:#FFF5F5; color:#E53E3E; border:1px solid rgba(229,62,62,0.3); }
  .result-promoted { background:#EDF6FA; color:#0E7EA4; border:1px solid rgba(14,126,164,0.3); }
</style>
</head>
<body>
<div class="card">
  <!-- Header -->
  <div class="header">
    <div class="school-name">School Progress Report</div>
    <div class="school-sub">${setup.syllabus} Curriculum · Academic Year ${setup.year}</div>
    <div class="card-title">${setup.reportType}</div>
    <div class="term-badge">${setup.term}</div>
  </div>

  <!-- Student info -->
  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">Student Name</div>
      <div class="info-value">${student.name}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Admission No.</div>
      <div class="info-value">${student.admNo}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Class / Division</div>
      <div class="info-value">${student.div}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Result</div>
      <div class="info-value">
        <span class="result-badge ${card.result === 'Pass' || card.result === 'Promoted' ? 'result-pass' : card.result === 'Fail' ? 'result-fail' : 'result-promoted'}">
          ${card.result || '—'}
        </span>
      </div>
    </div>
  </div>

  <!-- Marks Table -->
  <div class="section">
    <div class="section-title">Academic Performance</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Subject</th>
          <th>Max<br>Theory</th>
          <th>Marks<br>Theory</th>
          <th>Max<br>Pract.</th>
          <th>Marks<br>Pract.</th>
          <th>Max<br>Total</th>
          <th>Total<br>Marks</th>
          <th>Grade</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <!-- Stats row -->
  <div class="section">
    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-label">Attendance</div>
        <div class="stat-value">${attendance}</div>
        <div class="stat-sub">${attPct} present</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Percentage</div>
        <div class="stat-value">${calcPercentage(card)}</div>
        <div class="stat-sub">Overall score</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Conduct</div>
        <div class="stat-value" style="font-size:13px;margin-top:4px">${card.conduct}</div>
        <div class="stat-sub">Behaviour rating</div>
      </div>
    </div>
  </div>

  <!-- Co-curricular -->
  <div class="section">
    <div class="section-title">Co-Curricular Activities</div>
    <div class="co-box">${coCurr}</div>
  </div>

  <!-- Remarks -->
  <div class="section">
    <div class="section-title">Remarks</div>
    <div class="remark-box">
      <div class="remark-label">Class Teacher's Remark</div>
      <div class="remark-text">${card.classTeacherRemark || '—'}</div>
    </div>
    <div class="remark-box">
      <div class="remark-label">Principal's Remark</div>
      <div class="remark-text">${card.principalRemark || '—'}</div>
    </div>
  </div>

  <!-- Footer signatures -->
  <div class="footer">
    <div class="footer-cell">
      <div class="sig-line"></div>
      <div class="sig-label">Class Teacher</div>
    </div>
    <div class="footer-cell">
      <div class="sig-line"></div>
      <div class="sig-label">Principal</div>
    </div>
    <div class="footer-cell">
      <div class="sig-line"></div>
      <div class="sig-label">Parent / Guardian</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Animated FadeSlide wrapper ───────────────────────────────────
function FadeSlide({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: any;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 360, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, bounciness: 3 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Chip Selector ───────────────────────────────────────────────
function ChipSelector({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={st.chipSection}>
      <Text style={st.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[st.chip, value === opt && st.chipActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.75}
          >
            <Text style={[st.chipText, value === opt && st.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Step indicator ──────────────────────────────────────────────
const STEP_LABELS = ['Setup', 'Students', 'Fill Cards', 'Send'];
function StepBar({ current }: { current: Step }) {
  const idx = (['setup','select','fill','review'] as Step[]).indexOf(current);
  return (
    <View style={st.stepBar}>
      {STEP_LABELS.map((label, i) => (
        <View key={label} style={st.stepItem}>
          <View style={[st.stepDot, i <= idx && st.stepDotActive, i < idx && st.stepDotDone]}>
            {i < idx
              ? <MaterialIcons name="check" size={rs(11)} color={C.white} />
              : <Text style={[st.stepNum, i <= idx && st.stepNumActive]}>{i + 1}</Text>
            }
          </View>
          <Text style={[st.stepLabel, i <= idx && st.stepLabelActive]}>{label}</Text>
          {i < STEP_LABELS.length - 1 && (
            <View style={[st.stepLine, i < idx && st.stepLineDone]} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Grade picker row ─────────────────────────────────────────────
function GradePicker({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: rs(4) }}>
      {GRADES.map(g => (
        <TouchableOpacity
          key={g}
          style={[st.gradePill, value === g && st.gradePillActive]}
          onPress={() => onChange(g)}
          activeOpacity={0.75}
        >
          <Text style={[st.gradePillText, value === g && st.gradePillTextActive]}>{g}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Subject Row ─────────────────────────────────────────────────
function SubjectRow({
  subject, entry, onChange,
}: {
  subject: typeof DEFAULT_SUBJECTS[0];
  entry: SubjectEntry;
  onChange: (e: SubjectEntry) => void;
}) {
  return (
    <View style={st.subjectRow}>
      <View style={st.subjectHeader}>
        <View style={st.subjectDot} />
        <Text style={st.subjectName}>{subject.name}</Text>
        <Text style={st.subjectMax}>/{subject.maxMarks}</Text>
      </View>
      <View style={st.subjectInputs}>
        <View style={st.markField}>
          <Text style={st.markLabel}>Theory ({subject.theoryMax})</Text>
          <TextInput
            style={st.markInput}
            placeholder="—"
            placeholderTextColor={C.muted}
            keyboardType="numeric"
            maxLength={3}
            value={entry.theory}
            onChangeText={t => onChange({ ...entry, theory: t })}
          />
        </View>
        {subject.practicalMax > 0 && (
          <View style={st.markField}>
            <Text style={st.markLabel}>Practical ({subject.practicalMax})</Text>
            <TextInput
              style={st.markInput}
              placeholder="—"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              maxLength={3}
              value={entry.practical}
              onChangeText={p => onChange({ ...entry, practical: p })}
            />
          </View>
        )}
        <View style={[st.markField, { minWidth: rs(60) }]}>
          <Text style={st.markLabel}>Total</Text>
          <View style={[st.markInput, st.markTotal]}>
            <Text style={st.markTotalText}>
              {(parseInt(entry.theory)||0) + (parseInt(entry.practical)||0) || '—'}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ marginTop: rs(6) }}>
        <Text style={st.markLabel}>Grade</Text>
        <GradePicker value={entry.grade} onChange={g => onChange({ ...entry, grade: g })} />
      </View>
    </View>
  );
}

// ─── Success Toast ────────────────────────────────────────────────
function SuccessToast({ visible, text }: { visible: boolean; text: string }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-40)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0,  useNativeDriver: true, bounciness: 8 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -40, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View style={[st.toast, { opacity, transform: [{ translateY }] }]}>
      <MaterialIcons name="check-circle" size={rs(18)} color={C.white} />
      <Text style={st.toastText}>{text}</Text>
    </Animated.View>
  );
}

// ─── Preview Modal (HTML progress card) ──────────────────────────
interface PreviewProps {
  visible: boolean;
  html: string;
  studentName: string;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
}
function PreviewModal({ visible, html, studentName, onClose, onSend, sending }: PreviewProps) {
  const insets = useSafeAreaInsets();
  // We render a simple scrollable HTML preview using WebView
  // (import WebView only if available; graceful fallback)
  let WebView: any = null;
  try { WebView = require('react-native-webview').WebView; } catch {}

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />
      <View style={[pm.header, { paddingTop: insets.top + rs(8) }]}>
        <TouchableOpacity style={pm.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={rs(20)} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={pm.title} numberOfLines={1}>{studentName}</Text>
          <Text style={pm.sub}>Progress Card Preview</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {WebView ? (
          <WebView
            source={{ html }}
            originWhitelist={['*']}
            scalesPageToFit={false}
            javaScriptEnabled
          />
        ) : (
          <ScrollView contentContainerStyle={pm.fallback}>
            <Text style={pm.fallbackText}>
              Install react-native-webview to preview the PDF card here.
            </Text>
          </ScrollView>
        )}
      </View>

      <View style={[pm.bottom, { paddingBottom: insets.bottom + rs(8) }]}>
        <TouchableOpacity style={pm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={pm.cancelText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[pm.sendBtn, sending && pm.sendBtnDisabled]}
          onPress={onSend}
          disabled={sending}
          activeOpacity={0.85}
        >
          <MaterialIcons name="send" size={rs(16)} color={C.white} />
          <Text style={pm.sendText}>{sending ? 'Sending…' : 'Send to Parent'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────
export default function TeacherProgressCardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // ── Setup state ─────────────────────────────────────────────
  const [step,       setStep]       = useState<Step>('setup');
  const [term,       setTerm]       = useState('Term 1');
  const [year,       setYear]       = useState('2024-25');
  const [syllabus,   setSyllabus]   = useState('CBSE');
  const [reportType, setReportType] = useState('Holistic Progress Card');

  // ── Student selection ──────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Fill state ─────────────────────────────────────────────
  const [cards,         setCards]         = useState<Record<string, StudentCard>>({});
  const [fillIndex,     setFillIndex]     = useState(0); // current student index in fill step

  // ── Review / send state ────────────────────────────────────
  const [previewHtml,   setPreviewHtml]   = useState('');
  const [previewStudent,setPreviewStudent]= useState('');
  const [previewOpen,   setPreviewOpen]   = useState(false);
  const [sendingId,     setSendingId]     = useState<string | null>(null);
  const [sentIds,       setSentIds]       = useState<Set<string>>(new Set());
  const [toast,         setToast]         = useState(false);
  const [toastText,     setToastText]     = useState('');

  const selectedStudents = STUDENTS.filter(s => selectedIds.has(s.id));
  const filtered = STUDENTS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.admNo.toLowerCase().includes(search.toLowerCase())
  );

  // ── Helpers ─────────────────────────────────────────────────
  const toggleStudent = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(s => s.id)));
  };

  const getCard = (studentId: string): StudentCard =>
    cards[studentId] ?? blankCard(studentId);

  const updateCard = (studentId: string, updater: (c: StudentCard) => StudentCard) => {
    setCards(prev => ({
      ...prev,
      [studentId]: updater(prev[studentId] ?? blankCard(studentId)),
    }));
  };

  const updateSubject = (studentId: string, entry: SubjectEntry) => {
    updateCard(studentId, c => ({
      ...c,
      subjects: c.subjects.map(s => s.subjectId === entry.subjectId ? entry : s),
    }));
  };

  const toggleCoCurricular = (studentId: string, activity: string) => {
    updateCard(studentId, c => ({
      ...c,
      coCurricular: c.coCurricular.includes(activity)
        ? c.coCurricular.filter(a => a !== activity)
        : [...c.coCurricular, activity],
    }));
  };

  // ── Navigation between steps ────────────────────────────────
  const goToFill = () => {
    setFillIndex(0);
    setStep('fill');
  };

  const goToReview = () => setStep('review');

  const currentStudent = selectedStudents[fillIndex];
  const currentCard    = currentStudent ? getCard(currentStudent.id) : null;

  // ── Preview ─────────────────────────────────────────────────
  const openPreview = (student: typeof STUDENTS[0]) => {
    const html = buildProgressCardHtml(student, getCard(student.id), { term, year, syllabus, reportType });
    setPreviewHtml(html);
    setPreviewStudent(student.name);
    setPreviewOpen(true);
  };

  // ── Send card to parent (API stub) ──────────────────────────
  const sendCard = async (student: typeof STUDENTS[0]) => {
    setSendingId(student.id);
    const html = buildProgressCardHtml(student, getCard(student.id), { term, year, syllabus, reportType });
    try {
      // TODO: Replace with real API call
      // await fetch('https://magnetpro.in/api/progress_card/send/', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({
      //     student_id: student.id,
      //     term, year, syllabus, report_type: reportType,
      //     card_html: html,
      //     card_data: getCard(student.id),
      //   }),
      // });
      await new Promise(r => setTimeout(r, 1100));
      setSentIds(prev => new Set([...prev, student.id]));
      setToastText(`Sent to ${student.name.split(' ')[0]}'s parent ✓`);
      setToast(true);
      setTimeout(() => setToast(false), 2800);
    } catch {
      Alert.alert('Failed', 'Could not send progress card. Please try again.');
    } finally {
      setSendingId(null);
      setPreviewOpen(false);
    }
  };

  const sendAll = async () => {
    const unsent = selectedStudents.filter(s => !sentIds.has(s.id));
    if (unsent.length === 0) return;
    Alert.alert(
      'Send All',
      `Send progress cards to all ${unsent.length} parents at once?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send All',
          onPress: async () => {
            for (const student of unsent) {
              await sendCard(student);
              await new Promise(r => setTimeout(r, 400));
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />

      {/* ── Header ── */}
      <LinearGradient colors={['#0A5F7A', '#1591B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.header}>
        <View style={st.headerTop}>
          <TouchableOpacity style={st.backBtn} onPress={() => navigation?.goBack()}>
            <MaterialIcons name="arrow-back" size={rs(20)} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.headerEyebrow}>Teacher Module</Text>
            <Text style={st.headerTitle}>Progress Cards</Text>
          </View>
          {selectedIds.size > 0 && (
            <View style={st.badge}>
              <Text style={st.badgeText}>{selectedIds.size}</Text>
            </View>
          )}
        </View>
        <StepBar current={step} />
      </LinearGradient>

      {/* ── Toast ── */}
      <SuccessToast visible={toast} text={toastText} />

      {/* ════════════════ STEP 1: SETUP ════════════════ */}
      {step === 'setup' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
          <FadeSlide delay={0}>
            <View style={st.sectionCard}>
              <View style={st.sectionCardHeader}>
                <MaterialIcons name="tune" size={rs(18)} color={C.accent} />
                <Text style={st.sectionCardTitle}>Report Setup</Text>
              </View>
              <Text style={st.sectionCardSub}>Configure the progress card before filling student data</Text>
            </View>
          </FadeSlide>

          <FadeSlide delay={60}>
            <View style={st.formCard}>
              <ChipSelector label="Academic Term"   options={TERMS}        value={term}       onChange={setTerm} />
              <ChipSelector label="Academic Year"   options={YEARS}        value={year}       onChange={setYear} />
              <ChipSelector label="Syllabus / Board" options={SYLLABUSES}  value={syllabus}   onChange={setSyllabus} />
              <ChipSelector label="Report Type"     options={REPORT_TYPES} value={reportType} onChange={setReportType} />
            </View>
          </FadeSlide>

          {/* Summary preview */}
          <FadeSlide delay={120}>
            <View style={st.summaryBanner}>
              <MaterialIcons name="info-outline" size={rs(16)} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={st.summaryBannerTitle}>{reportType}</Text>
                <Text style={st.summaryBannerSub}>{syllabus}  ·  {term}  ·  {year}</Text>
              </View>
            </View>
          </FadeSlide>

          <View style={{ height: rs(120) }} />
        </ScrollView>
      )}

      {/* ════════════════ STEP 2: SELECT STUDENTS ════════════════ */}
      {step === 'select' && (
        <View style={{ flex: 1 }}>
          <FadeSlide delay={0} style={st.searchRow}>
            <View style={st.searchBox}>
              <MaterialIcons name="search" size={rs(20)} color={C.muted} />
              <TextInput
                style={st.searchInput}
                placeholder="Search students..."
                placeholderTextColor={C.muted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <MaterialIcons name="close" size={rs(18)} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={st.selectAllBtn} onPress={toggleAll} activeOpacity={0.8}>
              <Text style={st.selectAllText}>
                {selectedIds.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'All'}
              </Text>
            </TouchableOpacity>
          </FadeSlide>

          <View style={st.countRow}>
            <Text style={st.countText}>{filtered.length} students</Text>
            {selectedIds.size > 0 && <Text style={st.selectedCount}>{selectedIds.size} selected</Text>}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[st.list, { paddingBottom: rs(120) }]}
            renderItem={({ item, index }) => {
              const color    = AVATAR_COLORS[index % AVATAR_COLORS.length];
              const selected = selectedIds.has(item.id);
              return (
                <TouchableOpacity
                  style={[st.studentCard, selected && st.studentCardSelected]}
                  onPress={() => toggleStudent(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[st.avatar, { backgroundColor: color + '20' }]}>
                    <Text style={[st.avatarText, { color }]}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.studentName} numberOfLines={1}>{item.name}</Text>
                    <Text style={st.studentAdm}>{item.admNo}  ·  {item.div}</Text>
                  </View>
                  <View style={[st.checkbox, selected && st.checkboxActive]}>
                    {selected && <MaterialIcons name="check" size={rs(14)} color={C.white} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ════════════════ STEP 3: FILL CARDS ════════════════ */}
      {step === 'fill' && currentStudent && currentCard && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Student navigator */}
          <View style={st.fillNav}>
            <TouchableOpacity
              style={[st.fillNavBtn, fillIndex === 0 && st.fillNavBtnDisabled]}
              onPress={() => setFillIndex(i => Math.max(0, i - 1))}
              disabled={fillIndex === 0}
              activeOpacity={0.8}
            >
              <MaterialIcons name="chevron-left" size={rs(20)} color={fillIndex === 0 ? C.muted : C.accent} />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={st.fillNavName} numberOfLines={1}>{currentStudent.name}</Text>
              <Text style={st.fillNavSub}>{fillIndex + 1} of {selectedStudents.length}  ·  {currentStudent.admNo}</Text>
            </View>

            <TouchableOpacity
              style={[st.fillNavBtn, fillIndex === selectedStudents.length - 1 && st.fillNavBtnDisabled]}
              onPress={() => setFillIndex(i => Math.min(selectedStudents.length - 1, i + 1))}
              disabled={fillIndex === selectedStudents.length - 1}
              activeOpacity={0.8}
            >
              <MaterialIcons name="chevron-right" size={rs(20)} color={fillIndex === selectedStudents.length - 1 ? C.muted : C.accent} />
            </TouchableOpacity>
          </View>

          {/* Progress dots */}
          <View style={st.dotsRow}>
            {selectedStudents.map((s, i) => {
              const filled = Object.keys(cards).includes(s.id);
              return (
                <TouchableOpacity key={s.id} onPress={() => setFillIndex(i)} activeOpacity={0.8}>
                  <View style={[
                    st.dot,
                    i === fillIndex && st.dotActive,
                    filled && i !== fillIndex && st.dotFilled,
                  ]} />
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[st.scrollContent, { paddingBottom: rs(140) }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Subjects */}
            <View style={st.formCard}>
              <Text style={st.formCardTitle}>
                <MaterialIcons name="menu-book" size={rs(14)} color={C.accent} /> Academic Marks
              </Text>
              {DEFAULT_SUBJECTS.map(sub => (
                <SubjectRow
                  key={sub.id}
                  subject={sub}
                  entry={currentCard.subjects.find(s => s.subjectId === sub.id) ?? { subjectId: sub.id, theory: '', practical: '', grade: '' }}
                  onChange={e => updateSubject(currentStudent.id, e)}
                />
              ))}
            </View>

            {/* Attendance */}
            <View style={st.formCard}>
              <Text style={st.formCardTitle}>
                <MaterialIcons name="event-available" size={rs(14)} color={C.accent} /> Attendance
              </Text>
              <View style={st.attendanceRow}>
                <View style={st.attendanceField}>
                  <Text style={st.markLabel}>Days Present</Text>
                  <TextInput
                    style={st.markInput}
                    placeholder="e.g. 182"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={3}
                    value={currentCard.attendancePresent}
                    onChangeText={t => updateCard(currentStudent.id, c => ({ ...c, attendancePresent: t }))}
                  />
                </View>
                <View style={st.attendanceField}>
                  <Text style={st.markLabel}>Total Working Days</Text>
                  <TextInput
                    style={st.markInput}
                    placeholder="e.g. 220"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={3}
                    value={currentCard.attendanceTotal}
                    onChangeText={t => updateCard(currentStudent.id, c => ({ ...c, attendanceTotal: t }))}
                  />
                </View>
              </View>
            </View>

            {/* Conduct */}
            <View style={st.formCard}>
              <Text style={st.formCardTitle}>
                <MaterialIcons name="star-outline" size={rs(14)} color={C.accent} /> Conduct & Result
              </Text>
              <Text style={st.fieldLabel}>Conduct</Text>
              <View style={st.conductRow}>
                {CONDUCT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[st.conductChip, currentCard.conduct === opt && st.conductChipActive]}
                    onPress={() => updateCard(currentStudent.id, c => ({ ...c, conduct: opt }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.conductChipText, currentCard.conduct === opt && st.conductChipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.fieldLabel, { marginTop: rs(14) }]}>Result</Text>
              <View style={st.conductRow}>
                {(['Pass', 'Fail', 'Promoted'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      st.conductChip,
                      currentCard.result === r && (r === 'Fail' ? st.conductChipDanger : st.conductChipActive),
                    ]}
                    onPress={() => updateCard(currentStudent.id, c => ({ ...c, result: r }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      st.conductChipText,
                      currentCard.result === r && (r === 'Fail' ? st.conductChipTextDanger : st.conductChipTextActive),
                    ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Co-curricular */}
            <View style={st.formCard}>
              <Text style={st.formCardTitle}>
                <MaterialIcons name="emoji-events" size={rs(14)} color={C.accent} /> Co-Curricular Activities
              </Text>
              <View style={st.coGrid}>
                {CO_CURRICULAR.map(act => {
                  const active = currentCard.coCurricular.includes(act);
                  return (
                    <TouchableOpacity
                      key={act}
                      style={[st.coChip, active && st.coChipActive]}
                      onPress={() => toggleCoCurricular(currentStudent.id, act)}
                      activeOpacity={0.8}
                    >
                      {active && <MaterialIcons name="check" size={rs(11)} color={C.white} />}
                      <Text style={[st.coChipText, active && st.coChipTextActive]}>{act}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Remarks */}
            <View style={st.formCard}>
              <Text style={st.formCardTitle}>
                <MaterialIcons name="rate-review" size={rs(14)} color={C.accent} /> Remarks
              </Text>
              <Text style={st.fieldLabel}>Class Teacher's Remark</Text>
              <TextInput
                style={[st.remarkInput, { marginBottom: rs(14) }]}
                multiline
                numberOfLines={3}
                placeholder="Enter teacher's remark for this student..."
                placeholderTextColor={C.muted}
                value={currentCard.classTeacherRemark}
                onChangeText={t => updateCard(currentStudent.id, c => ({ ...c, classTeacherRemark: t }))}
                textAlignVertical="top"
              />
              <Text style={st.fieldLabel}>Principal's Remark</Text>
              <TextInput
                style={st.remarkInput}
                multiline
                numberOfLines={3}
                placeholder="Enter principal's remark..."
                placeholderTextColor={C.muted}
                value={currentCard.principalRemark}
                onChangeText={t => updateCard(currentStudent.id, c => ({ ...c, principalRemark: t }))}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ════════════════ STEP 4: REVIEW & SEND ════════════════ */}
      {step === 'review' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.scrollContent, { paddingBottom: rs(120) }]} showsVerticalScrollIndicator={false}>
          <FadeSlide delay={0}>
            <View style={st.summaryBanner}>
              <MaterialIcons name="assignment" size={rs(18)} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={st.summaryBannerTitle}>{reportType}  ·  {syllabus}</Text>
                <Text style={st.summaryBannerSub}>{term}  ·  {year}  ·  {selectedStudents.length} students</Text>
              </View>
              <View style={[st.badge, { backgroundColor: C.success }]}>
                <Text style={st.badgeText}>{sentIds.size}/{selectedStudents.length}</Text>
              </View>
            </View>
          </FadeSlide>

          {selectedStudents.map((student, i) => {
            const card    = getCard(student.id);
            const sent    = sentIds.has(student.id);
            const sending = sendingId === student.id;
            const color   = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <FadeSlide key={student.id} delay={i * 40}>
                <View style={[st.reviewCard, sent && st.reviewCardSent]}>
                  <View style={st.reviewCardTop}>
                    <View style={[st.avatar, { backgroundColor: color + '20' }]}>
                      <Text style={[st.avatarText, { color }]}>{getInitials(student.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.studentName} numberOfLines={1}>{student.name}</Text>
                      <Text style={st.studentAdm}>{student.admNo}  ·  {calcPercentage(card)}</Text>
                    </View>
                    {sent && (
                      <View style={st.sentBadge}>
                        <MaterialIcons name="check-circle" size={rs(14)} color={C.success} />
                        <Text style={st.sentBadgeText}>Sent</Text>
                      </View>
                    )}
                  </View>

                  <View style={st.reviewCardRow}>
                    <Text style={st.reviewMetaText}>
                      {card.result || 'No result'} · {card.conduct} · {card.attendancePresent || '—'}/{card.attendanceTotal || '—'} days
                    </Text>
                  </View>

                  <View style={st.reviewActions}>
                    <TouchableOpacity style={st.previewBtn} onPress={() => openPreview(student)} activeOpacity={0.8}>
                      <MaterialIcons name="visibility" size={rs(14)} color={C.accent} />
                      <Text style={st.previewBtnText}>Preview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.sendStudentBtn, (sent || sending) && st.sendStudentBtnDone]}
                      onPress={() => !sent && !sending && sendCard(student)}
                      disabled={sent || sending}
                      activeOpacity={0.85}
                    >
                      {sending
                        ? <Text style={st.sendStudentBtnText}>Sending…</Text>
                        : sent
                          ? <><MaterialIcons name="check" size={rs(14)} color={C.white} /><Text style={st.sendStudentBtnText}>Sent</Text></>
                          : <><MaterialIcons name="send" size={rs(14)} color={C.white} /><Text style={st.sendStudentBtnText}>Send</Text></>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </FadeSlide>
            );
          })}

          {sentIds.size < selectedStudents.length && (
            <FadeSlide delay={selectedStudents.length * 40 + 80}>
              <TouchableOpacity style={st.sendAllBtn} onPress={sendAll} activeOpacity={0.85}>
                <MaterialIcons name="send" size={rs(18)} color={C.white} />
                <Text style={st.sendAllBtnText}>
                  Send All ({selectedStudents.length - sentIds.size} remaining)
                </Text>
              </TouchableOpacity>
            </FadeSlide>
          )}

          {sentIds.size === selectedStudents.length && selectedStudents.length > 0 && (
            <FadeSlide delay={200}>
              <View style={st.allSentBanner}>
                <MaterialIcons name="celebration" size={rs(28)} color={C.success} />
                <Text style={st.allSentTitle}>All Cards Sent!</Text>
                <Text style={st.allSentSub}>
                  Progress cards for all {selectedStudents.length} students have been sent to parents.
                </Text>
              </View>
            </FadeSlide>
          )}
        </ScrollView>
      )}

      {/* ── Bottom action bar ── */}
      <View style={[st.bottomBar, { paddingBottom: insets.bottom + rs(10) }]}>
        {step === 'setup' && (
          <TouchableOpacity style={st.primaryBtn} onPress={() => setStep('select')} activeOpacity={0.85}>
            <Text style={st.primaryBtnText}>Next — Select Students</Text>
            <MaterialIcons name="arrow-forward" size={rs(18)} color={C.white} />
          </TouchableOpacity>
        )}

        {step === 'select' && (
          <View style={st.bottomRow}>
            <TouchableOpacity style={st.backBtn2} onPress={() => setStep('setup')} activeOpacity={0.8}>
              <MaterialIcons name="arrow-back" size={rs(18)} color={C.accent} />
              <Text style={st.backBtn2Text}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.primaryBtn, { flex: 1 }, selectedIds.size === 0 && st.primaryBtnDisabled]}
              onPress={() => selectedIds.size > 0 && goToFill()}
              activeOpacity={selectedIds.size > 0 ? 0.85 : 1}
            >
              <Text style={st.primaryBtnText}>
                {selectedIds.size > 0 ? `Fill Cards — ${selectedIds.size} selected` : 'Select students first'}
              </Text>
              {selectedIds.size > 0 && <MaterialIcons name="arrow-forward" size={rs(18)} color={C.white} />}
            </TouchableOpacity>
          </View>
        )}

        {step === 'fill' && (
          <View style={st.bottomRow}>
            <TouchableOpacity style={st.backBtn2} onPress={() => setStep('select')} activeOpacity={0.8}>
              <MaterialIcons name="arrow-back" size={rs(18)} color={C.accent} />
              <Text style={st.backBtn2Text}>Back</Text>
            </TouchableOpacity>
            {fillIndex < selectedStudents.length - 1 ? (
              <TouchableOpacity style={[st.primaryBtn, { flex: 1 }]} onPress={() => setFillIndex(i => i + 1)} activeOpacity={0.85}>
                <Text style={st.primaryBtnText}>Next Student</Text>
                <MaterialIcons name="arrow-forward" size={rs(18)} color={C.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[st.primaryBtn, { flex: 1, backgroundColor: C.success }]} onPress={goToReview} activeOpacity={0.85}>
                <Text style={st.primaryBtnText}>Review & Send</Text>
                <MaterialIcons name="check" size={rs(18)} color={C.white} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 'review' && (
          <TouchableOpacity style={st.backBtn2} onPress={() => setStep('fill')} activeOpacity={0.8}>
            <MaterialIcons name="arrow-back" size={rs(18)} color={C.accent} />
            <Text style={st.backBtn2Text}>Back to Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Preview Modal */}
      <PreviewModal
        visible={previewOpen}
        html={previewHtml}
        studentName={previewStudent}
        onClose={() => setPreviewOpen(false)}
        onSend={() => {
          const s = selectedStudents.find(s => s.name === previewStudent);
          if (s) sendCard(s);
        }}
        sending={!!sendingId}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { paddingHorizontal: rs(20), paddingBottom: rs(14) },
  headerTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: rs(14), gap: rs(12) },
  backBtn:      {
    width: rs(34), height: rs(34), borderRadius: rs(10),
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  headerEyebrow:{ fontSize: fs(10), color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle:  { fontSize: fs(22), fontWeight: '800', color: C.white },
  badge:        { backgroundColor: C.amber, borderRadius: rs(14), minWidth: rs(28), paddingHorizontal: rs(8), paddingVertical: rs(4), alignItems: 'center' },
  badgeText:    { color: C.white, fontWeight: '800', fontSize: fs(12) },

  // Step bar
  stepBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: rs(4) },
  stepItem:     { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot:      { width: rs(22), height: rs(22), borderRadius: rs(11), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: rs(4), borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)' },
  stepDotActive:{ backgroundColor: C.white, borderColor: C.white },
  stepDotDone:  { backgroundColor: C.success, borderColor: C.success },
  stepNum:      { fontSize: fs(10), fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  stepNumActive:{ color: C.accent },
  stepLabel:    { fontSize: fs(9), fontWeight: '600', color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  stepLabelActive: { color: C.white, fontWeight: '700' },
  stepLine:     { position: 'absolute', top: rs(11), left: '55%', right: '-55%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: -1 },
  stepLineDone: { backgroundColor: C.success },

  scrollContent:{ paddingHorizontal: rs(16), paddingTop: rs(16) },

  // Section card
  sectionCard:  { backgroundColor: C.accentLight, borderRadius: rs(14), padding: rs(16), marginBottom: rs(12), borderWidth: 1, borderColor: C.borderMed },
  sectionCardHeader:{ flexDirection: 'row', alignItems: 'center', gap: rs(8), marginBottom: rs(4) },
  sectionCardTitle: { fontSize: fs(15), fontWeight: '700', color: C.dark },
  sectionCardSub:   { fontSize: fs(12), color: C.muted, lineHeight: fs(18) },

  // Form card
  formCard:     { backgroundColor: C.white, borderRadius: rs(16), padding: rs(16), marginBottom: rs(12), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  formCardTitle:{ fontSize: fs(13), fontWeight: '700', color: C.dark, marginBottom: rs(14) },

  // Chip selector
  chipSection:  { marginBottom: rs(14) },
  fieldLabel:   { fontSize: fs(10), fontWeight: '700', color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: rs(8) },
  chip:         { borderRadius: rs(20), paddingHorizontal: rs(14), paddingVertical: rs(7), backgroundColor: C.bg, marginRight: rs(8), borderWidth: 1.5, borderColor: C.borderMed },
  chipActive:   { backgroundColor: C.accent, borderColor: C.accent },
  chipText:     { fontSize: fs(12), fontWeight: '600', color: C.muted },
  chipTextActive:{ color: C.white },

  summaryBanner:{ flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: C.accentLight, borderRadius: rs(12), padding: rs(14), borderWidth: 1, borderColor: C.borderMed, marginBottom: rs(12) },
  summaryBannerTitle:{ fontSize: fs(13), fontWeight: '700', color: C.dark },
  summaryBannerSub:  { fontSize: fs(11), color: C.muted, marginTop: rs(2) },

  // Search / Student list
  searchRow:    { flexDirection: 'row', paddingHorizontal: rs(16), paddingTop: rs(14), paddingBottom: rs(6), gap: rs(10), alignItems: 'center' },
  searchBox:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(8), backgroundColor: C.white, borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(44), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  searchInput:  { flex: 1, fontSize: fs(14), color: C.dark },
  selectAllBtn: { backgroundColor: C.accentLight, borderRadius: rs(10), paddingHorizontal: rs(12), paddingVertical: rs(8), borderWidth: 1, borderColor: C.borderMed },
  selectAllText:{ fontSize: fs(12), fontWeight: '700', color: C.accent },
  countRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: rs(20), paddingBottom: rs(8) },
  countText:    { fontSize: fs(12), color: C.muted, fontWeight: '600' },
  selectedCount:{ fontSize: fs(12), color: C.amber, fontWeight: '700' },
  list:         { paddingHorizontal: rs(16) },
  studentCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: rs(14), padding: rs(14), marginBottom: rs(10), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, borderWidth: 1.5, borderColor: 'transparent' },
  studentCardSelected: { borderColor: C.accent, backgroundColor: C.accentLight },
  avatar:       { width: rs(42), height: rs(42), borderRadius: rs(21), justifyContent: 'center', alignItems: 'center', marginRight: rs(12) },
  avatarText:   { fontWeight: '800', fontSize: fs(14) },
  studentName:  { fontSize: fs(14), fontWeight: '700', color: C.dark, marginBottom: rs(2) },
  studentAdm:   { fontSize: fs(12), color: C.muted },
  checkbox:     { width: rs(24), height: rs(24), borderRadius: rs(12), borderWidth: 2, borderColor: C.borderMed, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:{ backgroundColor: C.accent, borderColor: C.accent },

  // Fill nav
  fillNav:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: rs(16), paddingVertical: rs(12), borderBottomWidth: 1, borderBottomColor: C.border, gap: rs(8) },
  fillNavBtn:   { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.borderMed },
  fillNavBtnDisabled: { opacity: 0.4 },
  fillNavName:  { fontSize: fs(14), fontWeight: '800', color: C.dark, textAlign: 'center' },
  fillNavSub:   { fontSize: fs(11), color: C.muted, textAlign: 'center' },
  dotsRow:      { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: rs(6), paddingVertical: rs(8), paddingHorizontal: rs(16), backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  dot:          { width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: C.borderMed },
  dotActive:    { backgroundColor: C.accent, width: rs(18) },
  dotFilled:    { backgroundColor: C.success },

  // Subject row
  subjectRow:   { marginBottom: rs(16), paddingBottom: rs(16), borderBottomWidth: 1, borderBottomColor: C.border },
  subjectHeader:{ flexDirection: 'row', alignItems: 'center', gap: rs(8), marginBottom: rs(10) },
  subjectDot:   { width: rs(6), height: rs(6), borderRadius: rs(3), backgroundColor: C.accent },
  subjectName:  { fontSize: fs(13), fontWeight: '700', color: C.dark, flex: 1 },
  subjectMax:   { fontSize: fs(11), color: C.muted, fontWeight: '600' },
  subjectInputs:{ flexDirection: 'row', gap: rs(8) },
  markField:    { flex: 1 },
  markLabel:    { fontSize: fs(10), fontWeight: '700', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: rs(5) },
  markInput:    { backgroundColor: C.bg, borderRadius: rs(10), padding: rs(10), fontSize: fs(14), fontWeight: '700', color: C.dark, borderWidth: 1.5, borderColor: C.borderMed, textAlign: 'center' },
  markTotal:    { backgroundColor: C.accentLight, borderColor: C.accent, justifyContent: 'center', alignItems: 'center' },
  markTotalText:{ fontSize: fs(14), fontWeight: '800', color: C.accent },

  // Grade pills
  gradePill:    { borderRadius: rs(16), paddingHorizontal: rs(10), paddingVertical: rs(5), backgroundColor: C.bg, marginRight: rs(6), borderWidth: 1.5, borderColor: C.borderMed },
  gradePillActive:{ backgroundColor: C.accent, borderColor: C.accent },
  gradePillText:  { fontSize: fs(12), fontWeight: '700', color: C.muted },
  gradePillTextActive: { color: C.white },

  // Attendance
  attendanceRow:{ flexDirection: 'row', gap: rs(12) },
  attendanceField:{ flex: 1 },

  // Conduct
  conductRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  conductChip:  { borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(7), backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.borderMed },
  conductChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  conductChipDanger: { backgroundColor: C.danger, borderColor: C.danger },
  conductChipText:   { fontSize: fs(12), fontWeight: '600', color: C.muted },
  conductChipTextActive:{ color: C.white },
  conductChipTextDanger:{ color: C.white },

  // Co-curricular
  coGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  coChip:       { flexDirection: 'row', alignItems: 'center', gap: rs(4), borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(7), backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.borderMed },
  coChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  coChipText:   { fontSize: fs(12), fontWeight: '600', color: C.muted },
  coChipTextActive: { color: C.white },

  // Remarks
  remarkInput:  { backgroundColor: C.bg, borderRadius: rs(12), padding: rs(12), fontSize: fs(13), color: C.dark, minHeight: rs(80), borderWidth: 1.5, borderColor: C.borderMed, lineHeight: fs(20) },

  // Review cards
  reviewCard:   { backgroundColor: C.white, borderRadius: rs(14), padding: rs(14), marginBottom: rs(10), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, borderWidth: 1.5, borderColor: 'transparent' },
  reviewCardSent:{ borderColor: C.success, backgroundColor: C.successLight },
  reviewCardTop:{ flexDirection: 'row', alignItems: 'center', gap: rs(12), marginBottom: rs(8) },
  reviewCardRow:{ marginBottom: rs(10) },
  reviewMetaText:{ fontSize: fs(12), color: C.muted },
  reviewActions:{ flexDirection: 'row', gap: rs(10) },
  previewBtn:   { flexDirection: 'row', alignItems: 'center', gap: rs(6), paddingHorizontal: rs(14), paddingVertical: rs(8), borderRadius: rs(10), borderWidth: 1.5, borderColor: C.borderMed, backgroundColor: C.accentLight },
  previewBtnText:{ fontSize: fs(12), fontWeight: '700', color: C.accent },
  sendStudentBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6), paddingVertical: rs(9), borderRadius: rs(10), backgroundColor: C.accent },
  sendStudentBtnDone:{ backgroundColor: C.success },
  sendStudentBtnText:{ fontSize: fs(13), fontWeight: '700', color: C.white },
  sentBadge:    { flexDirection: 'row', alignItems: 'center', gap: rs(4), backgroundColor: C.successLight, borderRadius: rs(10), paddingHorizontal: rs(8), paddingVertical: rs(4), borderWidth: 1, borderColor: 'rgba(56,161,105,0.2)' },
  sentBadgeText:{ fontSize: fs(11), fontWeight: '700', color: C.success },

  sendAllBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(10), backgroundColor: C.accent, borderRadius: rs(14), paddingVertical: rs(14), marginBottom: rs(14) },
  sendAllBtnText:{ fontSize: fs(15), fontWeight: '700', color: C.white },
  allSentBanner:{ alignItems: 'center', paddingVertical: rs(28), gap: rs(8) },
  allSentTitle: { fontSize: fs(20), fontWeight: '800', color: C.success },
  allSentSub:   { fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: fs(20), paddingHorizontal: rs(24) },

  // Bottom bar
  bottomBar:    { paddingHorizontal: rs(16), paddingTop: rs(12), backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: rs(8) },
  bottomRow:    { flexDirection: 'row', gap: rs(10) },
  primaryBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8), backgroundColor: C.accent, borderRadius: rs(14), paddingVertical: rs(14) },
  primaryBtnDisabled: { backgroundColor: C.muted + '80' },
  primaryBtnText:{ fontSize: fs(14), fontWeight: '700', color: C.white },
  backBtn2:     { flexDirection: 'row', alignItems: 'center', gap: rs(6), borderWidth: 1.5, borderColor: C.borderMed, borderRadius: rs(14), paddingHorizontal: rs(14), paddingVertical: rs(12) },
  backBtn2Text: { fontSize: fs(14), fontWeight: '700', color: C.accent },

  // Toast
  toast:        { position: 'absolute', top: rs(16), left: rs(20), right: rs(20), zIndex: 99, flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.success, borderRadius: rs(14), padding: rs(14), elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  toastText:    { color: C.white, fontSize: fs(13), fontWeight: '700', flex: 1 },
});

// ─── Preview Modal Styles ─────────────────────────────────────────
const pm = StyleSheet.create({
  header:    { backgroundColor: C.accentDark, flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(16), paddingBottom: rs(14), gap: rs(12) },
  closeBtn:  { width: rs(34), height: rs(34), borderRadius: rs(10), backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  title:     { fontSize: fs(15), fontWeight: '800', color: C.white },
  sub:       { fontSize: fs(11), color: 'rgba(255,255,255,0.6)' },
  bottom:    { flexDirection: 'row', gap: rs(10), paddingHorizontal: rs(16), paddingTop: rs(12), backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: rs(6), borderWidth: 1.5, borderColor: C.borderMed, borderRadius: rs(14), paddingHorizontal: rs(16), paddingVertical: rs(12) },
  cancelText:{ fontSize: fs(14), fontWeight: '700', color: C.accent },
  sendBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8), backgroundColor: C.accent, borderRadius: rs(14), paddingVertical: rs(14) },
  sendBtnDisabled: { backgroundColor: C.muted + '80' },
  sendText:  { fontSize: fs(14), fontWeight: '700', color: C.white },
  fallback:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: rs(24) },
  fallbackText: { fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: fs(20) },
});