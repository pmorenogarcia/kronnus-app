import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { listSessions } from '@/src/api';
import { useSettings } from '@/src/hooks';
import type { AppSettings } from '@/src/hooks';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentBg: 'rgba(237,216,61,0.10)',
  accentBorder: 'rgba(237,216,61,0.22)',
  accentRing: 'rgba(237,216,61,0.35)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  error: '#E05C5C',
  toggleActive: '#EDD83D',
  toggleInactive: '#2A2728',
  toggleKnob: '#0F0F0F',
  toggleKnobOff: '#6D696A',
  toggleDisabled: '#1E1C1D',
};

const LANGUAGE_OPTIONS: { value: AppSettings['language']; label: string; native: string }[] = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ca', label: 'Català', native: 'Català' },
  { value: 'es', label: 'Español', native: 'Español' },
];

// ─── Toggle switch ────────────────────────────────────────────────────────────

interface ToggleProps {
  value: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

function Toggle({ value, onToggle, disabled }: ToggleProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View
        style={[
          toggleStyles.track,
          value && !disabled ? toggleStyles.trackOn : toggleStyles.trackOff,
          disabled && toggleStyles.trackDisabled,
        ]}
      >
        <View style={[toggleStyles.knob, value ? toggleStyles.knobOn : toggleStyles.knobOff]} />
      </View>
    </TouchableOpacity>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOn: { backgroundColor: C.toggleActive },
  trackOff: { backgroundColor: C.toggleInactive },
  trackDisabled: { backgroundColor: C.toggleDisabled, opacity: 0.5 },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  knobOn: { backgroundColor: C.toggleKnob, alignSelf: 'flex-end' },
  knobOff: { backgroundColor: C.toggleKnobOff, alignSelf: 'flex-start' },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─── Setting row ──────────────────────────────────────────────────────────────

interface SettingRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  description?: string;
  right: React.ReactNode;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  danger?: boolean;
}

function SettingRow({
  icon,
  label,
  description,
  right,
  onPress,
  isFirst,
  isLast,
  danger,
}: SettingRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.settingRow,
        isFirst && styles.settingRowFirst,
        isLast && styles.settingRowLast,
        !isLast && styles.settingRowBorderBottom,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Feather name={icon} size={15} color={danger ? C.error : C.textMuted} />
      </View>
      <View style={styles.settingLabelGroup}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <View style={styles.settingRight}>{right}</View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, signOut } = useAuth();
  const { settings, loaded: settingsLoaded, updateSetting } = useSettings();

  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      listSessions(token)
        .then((list) => setSessionCount(list.length))
        .catch(() => {});
    }, [token]),
  );

  const displayName = user?.username ?? (user?.email ? user.email.split('@')[0] : null);
  const handle = user?.username ? `@${user.username}` : (user?.email ?? '');
  const initial = (user?.username?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  const isLoading = !user || !settingsLoaded;

  if (isLoading) {
    return (
      <View style={[styles.root, styles.loadingWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.accent} size="small" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <Text style={styles.headerSub}>KRONNUS</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardTop}>
            {/* Avatar */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            </View>

            {/* Name + handle + pill */}
            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName?.toUpperCase() ?? '—'}
              </Text>
              <Text style={styles.profileHandle} numberOfLines={1}>
                {handle}
              </Text>
              {sessionCount !== null && (
                <View style={styles.statPill}>
                  <Text style={styles.statPillCount}>{sessionCount}</Text>
                  <Text style={styles.statPillLabel}> SESSIONS</Text>
                </View>
              )}
            </View>

            {/* Edit button */}
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push('/edit-profile' as never)}
              activeOpacity={0.75}
            >
              <Feather name="edit-2" size={13} color={C.accent} />
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Appearance ── */}
        <SectionHeader label="APPEARANCE" />
        <View style={styles.settingGroup}>
          <SettingRow
            icon="moon"
            label="Dark Mode"
            description="(to be implemented · always on for now)"
            right={<Toggle value disabled />}
            isFirst
            isLast
          />
        </View>

        <View style={styles.settingGroup}>
          <SettingRow
            icon="globe"
            label="Language"
            description="(to be implemented)"
            right={
              <View style={styles.langValue}>
                <Text style={styles.langValueText}>
                  {LANGUAGE_OPTIONS.find((o) => o.value === settings.language)?.native ?? 'English'}
                </Text>
                <Feather
                  name={langOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={C.textMuted}
                />
              </View>
            }
            onPress={() => setLangOpen((v) => !v)}
            isFirst
            isLast={!langOpen}
          />

          {/* Inline language picker */}
          {langOpen && (
            <View style={styles.langPicker}>
              {LANGUAGE_OPTIONS.map((opt, idx) => {
                const selected = settings.language === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.langOption,
                      idx < LANGUAGE_OPTIONS.length - 1 && styles.langOptionBorder,
                    ]}
                    onPress={() => {
                      void updateSetting('language', opt.value);
                      setLangOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.langOptionText, selected && styles.langOptionTextSelected]}
                    >
                      {opt.native}
                    </Text>
                    {selected && <Feather name="check" size={14} color={C.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Sound ── */}
        <SectionHeader label="SOUND" />
        <View style={styles.settingGroup}>
          <SettingRow
            icon="volume-2"
            label="Sound Effects"
            description="Haptic feedback on checkpoint captures"
            right={
              <Toggle
                value={settings.soundEffects}
                onToggle={() => void updateSetting('soundEffects', !settings.soundEffects)}
              />
            }
            isFirst
            isLast
          />
        </View>

        {/* ── Account ── */}
        <SectionHeader label="ACCOUNT" />
        <View style={styles.settingGroup}>
          <SettingRow
            icon="log-out"
            label="Log Out"
            right={<Feather name="chevron-right" size={14} color={C.error} />}
            onPress={() => void signOut()}
            danger
            isFirst
            isLast
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadingWrap: { justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    backgroundColor: C.bgHeader,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.5,
    color: C.textPrimary,
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },

  // Profile card
  profileCard: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 8,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarWrap: {
    padding: 3,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: C.accentRing,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 24,
    color: C.accent,
    lineHeight: 28,
  },
  profileMeta: { flex: 1, gap: 4, paddingTop: 2 },
  profileName: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 22,
    letterSpacing: 0.5,
    color: C.textPrimary,
    lineHeight: 26,
  },
  profileHandle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textSecondary,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  statPillCount: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    color: C.accent,
  },
  statPillLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: C.textSecondary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.accentBg,
  },
  editBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    color: C.accent,
  },

  // Section labels
  sectionLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },

  // Setting group
  settingGroup: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  settingRowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  settingRowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  settingRowBorderBottom: { borderBottomWidth: 1, borderBottomColor: C.border },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingIconDanger: { backgroundColor: 'rgba(224,92,92,0.10)' },
  settingLabelGroup: { flex: 1, gap: 2 },
  settingLabel: {
    fontFamily: 'Barlow-SemiBold',
    fontSize: 15,
    color: C.textPrimary,
  },
  settingLabelDanger: { color: C.error },
  settingDescription: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
  },
  settingRight: { flexShrink: 0 },

  // Language inline picker
  langValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langValueText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
    color: C.textMuted,
  },
  langPicker: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingLeft: 62,
  },
  langOptionBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  langOptionText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textMuted,
  },
  langOptionTextSelected: {
    fontFamily: 'Barlow-SemiBold',
    color: C.accent,
  },
});
