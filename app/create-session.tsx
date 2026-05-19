import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { createSession, openSession, SessionError } from '@/src/api';
import type { SportType } from '@/src/api';

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgInput: '#1A1819',
  accent: '#EDD83D',
  accentSubtle: 'rgba(237,216,61,0.08)',
  accentMid: 'rgba(237,216,61,0.15)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  error: '#E05C5C',
};

const MONTHS_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface SportOption {
  value: SportType;
  label: string;
  icon: string;
}

const SPORTS: SportOption[] = [
  { value: 'ATHLETICS', label: 'ATHLETICS', icon: 'run' },
  { value: 'CYCLING', label: 'CYCLING', icon: 'bike' },
  { value: 'TRAIL_RUNNING', label: 'TRAIL RUNNING', icon: 'hiking' },
  { value: 'SKI', label: 'SKI', icon: 'ski' },
  { value: 'SNOWBOARD', label: 'SNOWBOARD', icon: 'snowboard' },
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateDisplay(date: Date): string {
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Scroll Picker ────────────────────────────────────────────────────────────

const ITEM_H = 50;
const VISIBLE = 5;
const MIN_YEAR = new Date().getFullYear();
const ALL_YEARS = Array.from({ length: 8 }, (_, i) => String(MIN_YEAR + i));

interface ScrollPickerProps {
  values: string[];
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
}

function ScrollPicker({ values, selectedIndex, onIndexChange }: ScrollPickerProps) {
  const ref = useRef<ScrollView>(null);
  const isFirstRender = useRef(true);

  // Initial scroll after layout settles
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Programmatic scroll when parent changes index (e.g. day clamped after month change)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true });
  }, [selectedIndex]);

  return (
    <ScrollView
      ref={ref}
      style={ps.col}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      onMomentumScrollEnd={(e) => {
        const raw = e.nativeEvent.contentOffset.y / ITEM_H;
        const idx = Math.max(0, Math.min(Math.round(raw), values.length - 1));
        onIndexChange(idx);
      }}
    >
      {values.map((v, i) => (
        <View key={i} style={ps.itemWrap}>
          <Text style={[ps.itemText, i === selectedIndex && ps.itemTextSelected]}>{v}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

interface DateScrollPickerProps {
  date: Date;
  onChange: (d: Date) => void;
}

function DateScrollPicker({ date, onChange }: DateScrollPickerProps) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const day = date.getDate();

  const totalDays = daysInMonth(month, year);
  const days = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'));
  const dayIndex = Math.min(day - 1, totalDays - 1);
  const monthIndex = month;
  const yearIndex = Math.max(0, ALL_YEARS.indexOf(String(year)));

  function onDayChange(idx: number) {
    const d = new Date(date);
    d.setDate(idx + 1);
    onChange(d);
  }

  function onMonthChange(idx: number) {
    const d = new Date(date);
    d.setMonth(idx);
    const max = daysInMonth(idx, d.getFullYear());
    if (d.getDate() > max) d.setDate(max);
    onChange(d);
  }

  function onYearChange(idx: number) {
    const d = new Date(date);
    const newYear = MIN_YEAR + idx;
    d.setFullYear(newYear);
    const max = daysInMonth(d.getMonth(), newYear);
    if (d.getDate() > max) d.setDate(max);
    onChange(d);
  }

  return (
    <View>
      <View style={ps.pickerWrapper}>
        {/* Centre-row highlight */}
        <View pointerEvents="none" style={ps.highlight} />
        <ScrollPicker values={days} selectedIndex={dayIndex} onIndexChange={onDayChange} />
        <Text style={ps.sep}>/</Text>
        <ScrollPicker
          values={MONTHS_ABBR}
          selectedIndex={monthIndex}
          onIndexChange={onMonthChange}
        />
        <Text style={ps.sep}>/</Text>
        <ScrollPicker values={ALL_YEARS} selectedIndex={yearIndex} onIndexChange={onYearChange} />
      </View>
      {/* Column labels */}
      <View style={ps.labelsRow}>
        <Text style={[ps.colLabel, { flex: 1 }]}>DAY</Text>
        <View style={{ width: 20 }} />
        <Text style={[ps.colLabel, { flex: 1 }]}>MONTH</Text>
        <View style={{ width: 20 }} />
        <Text style={[ps.colLabel, { flex: 1 }]}>YEAR</Text>
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_H * VISIBLE,
    position: 'relative',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 12,
    right: 12,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(237,216,61,0.28)',
    backgroundColor: 'rgba(237,216,61,0.05)',
    borderRadius: 8,
  },
  col: {
    flex: 1,
    height: ITEM_H * VISIBLE,
  },
  itemWrap: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 17,
    color: 'rgba(162,167,165,0.28)',
    letterSpacing: 1,
    textAlign: 'center',
  },
  itemTextSelected: {
    color: '#E2DADB',
    fontSize: 22,
  },
  sep: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 22,
    color: '#2A2728',
    marginHorizontal: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
  },
  colLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateSessionScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [name, setName] = useState('');
  const [sport, setSport] = useState<SportType>('ATHLETICS');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [loadingContinue, setLoadingContinue] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = loadingContinue || loadingDraft;
  const currentSport = SPORTS.find((s) => s.value === sport) ?? SPORTS[0];

  function validate(): boolean {
    if (!name.trim()) {
      setError('Please enter an event name.');
      return false;
    }
    setError(null);
    return true;
  }

  async function handleContinueToSetup() {
    if (!token || !validate()) return;
    setLoadingContinue(true);
    try {
      const session = await createSession(token, {
        name: name.trim(),
        sport,
        session_date: date.toISOString(),
      });
      const opened = await openSession(token, session.id);
      router.replace({
        pathname: '/session-setup' as any,
        params: {
          session_id: opened.id,
          session_code: opened.session_code,
          session_name: opened.name,
          session_sport: opened.sport,
          session_status: opened.status,
        },
      });
    } catch (e) {
      setError(e instanceof SessionError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoadingContinue(false);
    }
  }

  async function handleSaveAsDraft() {
    if (!token || !validate()) return;
    setLoadingDraft(true);
    try {
      await createSession(token, {
        name: name.trim(),
        sport,
        session_date: date.toISOString(),
      });
      router.replace({
        pathname: '/(tabs)',
        params: { draftCreated: '1', draftName: name.trim() },
      });
    } catch (e) {
      setError(e instanceof SessionError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoadingDraft(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>NEW SESSION</Text>
          <Text style={styles.headerSub}>KRONNUS</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Event Name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>EVENT NAME</Text>
          <View style={styles.inputRow}>
            <Feather name="edit-2" size={15} color={C.textSecondary} />
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError(null);
              }}
              placeholder="e.g. City Marathon 2026"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>DATE</Text>
          <TouchableOpacity
            style={styles.selectRow}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Feather name="calendar" size={16} color={C.accent} />
            <Text style={styles.selectText}>{formatDateDisplay(date)}</Text>
            <Feather name="chevron-down" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sport Type */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>SPORT TYPE</Text>
          <TouchableOpacity
            style={styles.selectRow}
            onPress={() => setShowSportPicker(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={
                currentSport.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']
              }
              size={18}
              color={C.accent}
            />
            <Text style={styles.selectText}>{currentSport.label}</Text>
            <Feather name="chevron-down" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {error != null && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, isLoading && styles.btnDisabled]}
          onPress={handleContinueToSetup}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {loadingContinue ? (
            <ActivityIndicator size="small" color="#0F0F0F" />
          ) : (
            <>
              <Feather name="chevron-right" size={18} color="#0F0F0F" />
              <Text style={styles.continueBtnText}>CONTINUE TO SETUP</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.draftBtn, isLoading && styles.btnDisabled]}
          onPress={handleSaveAsDraft}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          {loadingDraft ? (
            <ActivityIndicator size="small" color={C.textSecondary} />
          ) : (
            <Text style={styles.draftBtnText}>SAVE AS DRAFT</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>SELECT DATE</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={12}>
              <Text style={styles.sheetDone}>DONE</Text>
            </TouchableOpacity>
          </View>
          <DateScrollPicker date={date} onChange={setDate} />
        </View>
      </Modal>

      {/* Sport Picker Modal */}
      <Modal
        visible={showSportPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSportPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSportPicker(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>SELECT SPORT</Text>
            <TouchableOpacity onPress={() => setShowSportPicker(false)} hitSlop={12}>
              <Feather name="x" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.sportList}>
            {SPORTS.map((s) => {
              const selected = sport === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.sportOption, selected && styles.sportOptionSelected]}
                  onPress={() => {
                    setSport(s.value);
                    setShowSportPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.sportOptionIcon, selected && styles.sportOptionIconSelected]}
                  >
                    <MaterialCommunityIcons
                      name={s.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                      size={18}
                      color={selected ? C.accent : C.textSecondary}
                    />
                  </View>
                  <Text
                    style={[styles.sportOptionLabel, selected && styles.sportOptionLabelSelected]}
                  >
                    {s.label}
                  </Text>
                  {selected && <Feather name="check" size={15} color={C.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bgHeader,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.5,
    color: C.textPrimary,
    textTransform: 'uppercase',
  },
  headerSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 24,
  },

  // Fields
  field: { gap: 10 },
  fieldLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 16,
    color: C.textPrimary,
    height: 52,
  },

  // Generic select trigger (date + sport share this)
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
  },
  selectText: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 16,
    color: C.textPrimary,
  },

  // Error
  errorText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.error,
    textAlign: 'center',
  },

  // CTA bar
  cta: {
    backgroundColor: C.bgHeader,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 58,
    gap: 6,
  },
  continueBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 18,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
  draftBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  draftBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  btnDisabled: {
    opacity: 0.55,
  },

  // Shared bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1A1819',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 14,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: C.textSecondary,
  },
  sheetDone: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 16,
    letterSpacing: 1,
    color: C.accent,
  },

  // Sport picker list (inside sheet)
  sportList: {
    paddingVertical: 8,
    gap: 4,
  },
  sportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 58,
    gap: 14,
  },
  sportOptionSelected: {
    backgroundColor: C.accentSubtle,
  },
  sportOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#252223',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportOptionIconSelected: {
    backgroundColor: C.accentMid,
  },
  sportOptionLabel: {
    flex: 1,
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 18,
    letterSpacing: 0.8,
    color: C.textMuted,
  },
  sportOptionLabelSelected: {
    color: C.accent,
  },
});
