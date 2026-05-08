import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/src/hooks';
import type { AppSettings } from '@/src/hooks';

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
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

// ─── Toggle ───────────────────────────────────────────────────────────────────

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
  knob: { width: 20, height: 20, borderRadius: 10 },
  knobOn: { backgroundColor: C.toggleKnob, alignSelf: 'flex-end' },
  knobOff: { backgroundColor: C.toggleKnobOff, alignSelf: 'flex-start' },
});

// ─── SettingRow ───────────────────────────────────────────────────────────────

interface SettingRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  description?: string;
  right: React.ReactNode;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function SettingRow({
  icon,
  label,
  description,
  right,
  onPress,
  isFirst,
  isLast,
}: SettingRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.settingRow,
        isFirst && styles.settingRowFirst,
        isLast && styles.settingRowLast,
        !isLast && styles.settingRowBorder,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.settingIcon}>
        <Feather name={icon} size={15} color={C.textMuted} />
      </View>
      <View style={styles.settingLabelGroup}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <View style={styles.settingRight}>{right}</View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSetting } = useSettings();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <Text style={styles.headerSub}>KRONNUS</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Appearance ── */}
        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            icon="moon"
            label="Dark Mode"
            description="Always on — light mode coming soon"
            right={<Toggle value disabled />}
            isFirst
            isLast
          />
        </View>

        <View style={styles.settingGroup}>
          <SettingRow
            icon="globe"
            label="Language"
            description="Multi-language support coming soon"
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
                    <Text style={[styles.langOptionText, selected && styles.langOptionSelected]}>
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
        <Text style={styles.sectionLabel}>SOUND</Text>
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
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

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
  headerCenter: { alignItems: 'center', gap: 2 },
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

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },

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

  settingGroup: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  settingRowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  settingRowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingLabelGroup: { flex: 1, gap: 2 },
  settingLabel: { fontFamily: 'Barlow-SemiBold', fontSize: 15, color: C.textPrimary },
  settingDescription: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
  },
  settingRight: { flexShrink: 0 },

  langValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langValueText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
    color: C.textMuted,
  },
  langPicker: { borderTopWidth: 1, borderTopColor: C.border },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingLeft: 62,
  },
  langOptionBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  langOptionText: { fontFamily: 'Barlow-Regular', fontSize: 15, color: C.textMuted },
  langOptionSelected: { fontFamily: 'Barlow-SemiBold', color: C.accent },
});
