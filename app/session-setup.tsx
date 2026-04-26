import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { startSession, SessionError } from '@/src/api';
import type { CheckpointRole } from '@/src/api';
import { useSessionWebSocket } from '@/src/hooks';

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentSubtle: 'rgba(237,216,61,0.08)',
  accentMid: 'rgba(237,216,61,0.15)',
  accentBorder: 'rgba(237,216,61,0.25)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  online: '#EDD83D',
  error: '#E05C5C',
};

interface RoleOption {
  value: CheckpointRole;
  label: string;
  shortLabel: string;
  icon: string;
}

const ROLES: RoleOption[] = [
  { value: 'START', label: 'START', shortLabel: 'START', icon: 'flag-outline' },
  { value: 'SPLIT', label: 'INTERM.', shortLabel: 'INTERM.', icon: 'timer-outline' },
  { value: 'END', label: 'FINISH', shortLabel: 'FINISH', icon: 'flag-checkered' },
];

const ROLE_BADGE_STYLE: Record<CheckpointRole, { bg: string; text: string }> = {
  START: { bg: '#252223', text: C.textMuted },
  SPLIT: { bg: '#252223', text: C.textMuted },
  END: { bg: C.accentMid, text: C.accent },
};

interface Competitor {
  id: string;
  name: string;
}

export default function SessionSetupScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { session_id, session_code, session_name } = useLocalSearchParams<{
    session_id: string;
    session_code: string;
    session_name: string;
    session_sport: string;
  }>();

  const code = session_code ?? '——';
  const name = session_name ?? 'Session';

  const [deviceRole, setDeviceRole] = useState<CheckpointRole>('END');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { remoteDevices, isConnected } = useSessionWebSocket({
    sessionId: session_id ?? '',
    token: token ?? '',
    enabled: !!session_id && !!token,
  });

  function addCompetitor() {
    const trimmed = newCompetitorName.trim();
    if (!trimmed) return;
    setCompetitors((prev) => [...prev, { id: String(Date.now()), name: trimmed }]);
    setNewCompetitorName('');
    setShowAddModal(false);
  }

  function removeCompetitor(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join my Kronnus session!\n\nSession code: ${code}\n\nDownload Kronnus to participate as a checkpoint operator.`,
        title: `Kronnus — ${name}`,
      });
    } catch {
      // User dismissed
    }
  }

  async function handleStartSession() {
    if (!token || !session_id) return;
    setStarting(true);
    setStartError(null);
    try {
      await startSession(token, session_id);
    } catch (e) {
      if (e instanceof SessionError) {
        setStartError(e.message);
        setStarting(false);
        return;
      }
    }
    router.replace({
      pathname: '/(tabs)/timing' as any,
      params: { role: deviceRole, session_name: name, session_code: code },
    });
  }

  const deviceCount = 1 + remoteDevices.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={18} color={C.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>SESSION SETUP</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {name.toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={18} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Session Code row */}
        <View style={styles.codeRow}>
          <View style={styles.codeLeft}>
            <Text style={styles.codeSmallLabel}>SESSION CODE</Text>
            <View style={styles.codeValueRow}>
              <Text style={styles.codeValue}>{code}</Text>
              {copied && <Text style={styles.copiedLabel}>COPIED!</Text>}
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
                activeOpacity={0.7}
                onPress={handleCopy}
              >
                <Feather
                  name={copied ? 'check' : 'copy'}
                  size={14}
                  color={copied ? C.accent : C.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Feather name="share-2" size={14} color="#0F0F0F" />
            <Text style={styles.shareBtnText}>SHARE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* This Device's Role */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{"THIS DEVICE'S ROLE"}</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const selected = deviceRole === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, selected && styles.roleCardSelected]}
                  onPress={() => setDeviceRole(r.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.roleIconWrap, selected && styles.roleIconWrapSelected]}>
                    <MaterialCommunityIcons
                      name={r.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                      size={18}
                      color={selected ? C.accent : C.textSecondary}
                    />
                  </View>
                  <Text style={[styles.roleCardLabel, selected && styles.roleCardLabelSelected]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Connected Devices */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>CONNECTED DEVICES</Text>
            <View style={styles.deviceCountBadge}>
              <View style={[styles.liveDot, isConnected && styles.liveDotConnected]} />
              <Text style={styles.deviceCountText}>{deviceCount}</Text>
            </View>
          </View>

          <View style={styles.deviceList}>
            {/* This device */}
            <View style={[styles.deviceRow, styles.deviceRowThis]}>
              <View style={styles.onlineDot} />
              <Text style={styles.deviceName}>
                This device
                <Text style={styles.deviceThisTag}> · Admin</Text>
              </Text>
              <View
                style={[styles.roleBadge, { backgroundColor: ROLE_BADGE_STYLE[deviceRole].bg }]}
              >
                <Text style={[styles.roleBadgeText, { color: ROLE_BADGE_STYLE[deviceRole].text }]}>
                  {ROLES.find((r) => r.value === deviceRole)?.shortLabel ?? deviceRole}
                </Text>
              </View>
            </View>

            {/* Remote devices joined via WS */}
            {remoteDevices.map((device) => {
              const badge = ROLE_BADGE_STYLE[device.role];
              const shortLabel =
                ROLES.find((r) => r.value === device.role)?.shortLabel ?? device.role;
              return (
                <View key={device.id} style={styles.deviceRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: badge.text }]}>{shortLabel}</Text>
                  </View>
                </View>
              );
            })}

            {remoteDevices.length === 0 && (
              <Text style={styles.emptyText}>Waiting for other devices to join…</Text>
            )}
          </View>
        </View>

        {/* Competitors */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>COMPETITORS</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={12} color={C.accent} />
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.competitorList}>
            {competitors.map((c, index) => (
              <View key={c.id} style={styles.competitorRow}>
                <View style={styles.competitorBadge}>
                  <Text style={styles.competitorBadgeNum}>{index + 1}</Text>
                </View>
                <Text style={styles.competitorName}>{c.name}</Text>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeCompetitor(c.id)}
                  hitSlop={10}
                  activeOpacity={0.6}
                >
                  <Feather name="minus" size={16} color={C.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}

            {competitors.length === 0 && (
              <Text style={styles.emptyText}>No competitors added yet</Text>
            )}
          </View>
        </View>

        {startError != null && <Text style={styles.errorText}>{startError}</Text>}
      </ScrollView>

      {/* Start Session */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.startBtn, starting && styles.btnDisabled]}
          onPress={handleStartSession}
          activeOpacity={0.85}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator size="small" color="#0F0F0F" />
          ) : (
            <>
              <Feather name="play" size={18} color="#0F0F0F" />
              <Text style={styles.startBtnText}>START SESSION</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Competitor Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)} />
        <View style={[styles.addSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>ADD COMPETITOR</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={12}>
              <Feather name="x" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetBody}>
            <TextInput
              style={styles.competitorInput}
              value={newCompetitorName}
              onChangeText={setNewCompetitorName}
              placeholder="Competitor name"
              placeholderTextColor={C.textSecondary}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={addCompetitor}
            />
            <TouchableOpacity
              style={[styles.addConfirmBtn, !newCompetitorName.trim() && styles.btnDisabled]}
              onPress={addCompetitor}
              disabled={!newCompetitorName.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.addConfirmBtnText}>ADD</Text>
            </TouchableOpacity>
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
  headerBtn: {
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
    flex: 1,
    marginHorizontal: 12,
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
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 0,
  },

  // Code row
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  codeLeft: {
    gap: 4,
  },
  codeSmallLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  codeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeValue: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 30,
    letterSpacing: 1,
    color: C.accent,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnDone: {
    borderColor: 'rgba(237,216,61,0.35)',
    backgroundColor: 'rgba(237,216,61,0.08)',
  },
  copiedLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.accent,
    textTransform: 'uppercase',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  shareBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 14,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 20,
  },

  // Sections
  section: {
    gap: 12,
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Device count badge
  deviceCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237,216,61,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(237,216,61,0.15)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.textSecondary,
  },
  liveDotConnected: {
    backgroundColor: C.online,
  },
  deviceCountText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    color: C.accent,
  },

  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    gap: 8,
    height: 68,
  },
  roleCardSelected: {
    borderColor: C.accent,
    borderWidth: 2,
    backgroundColor: C.accentSubtle,
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#252223',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapSelected: {
    backgroundColor: C.accentMid,
  },
  roleCardLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  roleCardLabelSelected: {
    color: C.accent,
  },

  // Connected devices
  deviceList: {
    gap: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  deviceRowThis: {
    borderColor: 'rgba(237,216,61,0.2)',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.online,
    flexShrink: 0,
  },
  deviceName: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textPrimary,
  },
  deviceThisTag: {
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textSecondary,
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  roleBadgeText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Competitors
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  addBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: C.accent,
  },
  competitorList: {
    gap: 8,
  },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  competitorBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#252223',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  competitorBadgeNum: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 13,
    color: C.textMuted,
  },
  competitorName: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textPrimary,
  },
  removeBtn: {
    padding: 4,
  },
  emptyText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Error
  errorText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.error,
    textAlign: 'center',
    paddingVertical: 4,
  },

  // Footer / Start button
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bgHeader,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 58,
    gap: 8,
  },
  startBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 18,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
  btnDisabled: { opacity: 0.4 },

  // Add competitor modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  addSheet: {
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
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: C.textSecondary,
  },
  sheetBody: {
    gap: 12,
  },
  competitorInput: {
    backgroundColor: '#131313',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: 'Barlow-Regular',
    fontSize: 16,
    color: C.textPrimary,
  },
  addConfirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 12,
    height: 52,
  },
  addConfirmBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 16,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
});
