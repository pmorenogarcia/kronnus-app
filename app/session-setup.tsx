import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  addCompetitor as apiAddCompetitor,
  getSessionState,
  setCheckpointRole,
  SessionError,
} from '@/src/api';
import type { CheckpointRole, Competitor } from '@/src/api';
import { useSessionSocket, useTimeSync } from '@/src/hooks';

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
  offline: '#3A3638',
  error: '#E05C5C',
  synced: '#4CAF8A',
};

interface RoleOption {
  value: CheckpointRole;
  shortLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const ROLES: RoleOption[] = [
  { value: 'START', shortLabel: 'START', icon: 'flag-outline' },
  { value: 'SPLIT', shortLabel: 'SPLIT', icon: 'timer-outline' },
  { value: 'END', shortLabel: 'END', icon: 'flag-checkered' },
];

interface DeviceEntry {
  user_id: string;
  username: string;
  role: CheckpointRole;
  synced: boolean;
  connected: boolean;
}

function getUserIdFromToken(token: string): string {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload)) as { sub?: string };
    return decoded.sub ?? '';
  } catch {
    return '';
  }
}

export default function SessionSetupScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { session_id, session_code, session_name } = useLocalSearchParams<{
    session_id: string;
    session_code: string;
    session_name: string;
  }>();

  const code = session_code ?? '——';
  const name = session_name ?? 'Session';

  const userId = useMemo(() => (token ? getUserIdFromToken(token) : ''), [token]);

  // WebSocket + time sync (coordinator syncs automatically on mount)
  const socket = useSessionSocket(session_id ?? null);
  const { lastMessage, send, status } = socket;
  useTimeSync(socket, userId);

  // Device state — keyed by user_id for O(1) WS event updates
  const [devices, setDevices] = useState<Map<string, DeviceEntry>>(new Map());

  // Keep a ref mirroring devices so WS effects can read latest without stale closure
  const devicesRef = useRef<Map<string, DeviceEntry>>(new Map());
  devicesRef.current = devices;

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompBib, setNewCompBib] = useState('');
  const [addingComp, setAddingComp] = useState(false);
  const [addCompError, setAddCompError] = useState<string | null>(null);

  // UI state
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Initial state load ───────────────────────────────────────────────────────

  const mergeCheckpoints = useCallback(
    (serverCheckpoints: { user_id: string; username: string; role: string; synced: boolean }[]) => {
      setDevices((prev) => {
        const next = new Map(prev);
        for (const cp of serverCheckpoints) {
          const existing = next.get(cp.user_id);
          next.set(cp.user_id, {
            user_id: cp.user_id,
            username: cp.username,
            role: cp.role as CheckpointRole,
            // WS events may have already marked synced=true before this REST response arrives
            synced: existing?.synced || cp.synced,
            connected: existing?.connected ?? true,
          });
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!token || !code || code === '——') return;
    let cancelled = false;
    getSessionState(token, code)
      .then((state) => {
        if (!cancelled) mergeCheckpoints(state.checkpoints);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, code, mergeCheckpoints]);

  // ─── WebSocket event handling ─────────────────────────────────────────────────

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'DEVICE_CONNECTED': {
        // Fetch latest state to get username for the newly connected device
        if (token && code && code !== '——') {
          getSessionState(token, code)
            .then((state) => mergeCheckpoints(state.checkpoints))
            .catch(() => {});
        }
        break;
      }

      case 'DEVICE_DISCONNECTED': {
        const { user_id } = lastMessage.payload;
        setDevices((prev) => {
          const next = new Map(prev);
          const d = next.get(user_id);
          if (d) next.set(user_id, { ...d, connected: false });
          return next;
        });
        break;
      }

      case 'SYNC_COMPLETE': {
        const { user_id } = lastMessage.payload;
        setDevices((prev) => {
          const next = new Map(prev);
          const d = next.get(user_id);
          if (d) next.set(user_id, { ...d, synced: true });
          return next;
        });
        break;
      }

      case 'ROLE_ASSIGNED': {
        const { user_id, role } = lastMessage.payload;
        setDevices((prev) => {
          const next = new Map(prev);
          const d = next.get(user_id);
          if (d) next.set(user_id, { ...d, role: role as CheckpointRole });
          return next;
        });
        break;
      }

      case 'SESSION_START': {
        const myRole = devicesRef.current.get(userId)?.role ?? 'SPLIT';
        router.replace({
          pathname: '/(tabs)/timing' as never,
          params: { role: myRole, session_name: name, session_code: code },
        });
        break;
      }

      case 'SESSION_START_REJECTED': {
        setStartError(lastMessage.payload.reason);
        setStarting(false);
        break;
      }
    }
  }, [lastMessage, token, code, userId, name, mergeCheckpoints]);

  // ─── Derived state ────────────────────────────────────────────────────────────

  const deviceList = useMemo(() => Array.from(devices.values()), [devices]);

  const canStart = useMemo(() => {
    const connected = deviceList.filter((d) => d.connected);
    return (
      connected.some((d) => d.role === 'START' && d.synced) &&
      connected.some((d) => d.role === 'END' && d.synced)
    );
  }, [deviceList]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleRoleChange = useCallback(
    async (targetUserId: string, role: CheckpointRole) => {
      if (!token || !code || code === '——') return;
      // Optimistic update
      setDevices((prev) => {
        const next = new Map(prev);
        const d = next.get(targetUserId);
        if (d) next.set(targetUserId, { ...d, role });
        return next;
      });
      try {
        await setCheckpointRole(token, code, targetUserId, role);
      } catch {
        // Server will broadcast ROLE_ASSIGNED if successful; UI self-corrects
      }
    },
    [token, code],
  );

  function handleStartSession() {
    if (!canStart) return;
    setStarting(true);
    setStartError(null);
    send('SESSION_START', {});
    // Navigation happens in the SESSION_START WS handler above
  }

  async function handleAddCompetitor() {
    const name_ = newCompName.trim();
    if (!name_ || !token || !code || code === '——') return;
    setAddingComp(true);
    setAddCompError(null);
    try {
      const comp = await apiAddCompetitor(token, code, name_, newCompBib.trim() || undefined);
      setCompetitors((prev) => [...prev, comp]);
      setNewCompName('');
      setNewCompBib('');
      setShowAddModal(false);
    } catch (e) {
      setAddCompError(e instanceof SessionError ? e.message : 'Failed to add competitor.');
    } finally {
      setAddingComp(false);
    }
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
      // user dismissed
    }
  }

  function closeModal() {
    setShowAddModal(false);
    setNewCompName('');
    setNewCompBib('');
    setAddCompError(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const isWsConnected = status === 'connected';

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

        {/* WS status indicator */}
        <View style={styles.headerBtn}>
          <View style={[styles.wsIndicator, isWsConnected && styles.wsIndicatorOn]} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session Code */}
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

        {/* Connected Devices */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>CONNECTED DEVICES</Text>
            <View style={styles.deviceCountBadge}>
              <View style={[styles.liveDot, isWsConnected && styles.liveDotOn]} />
              <Text style={styles.deviceCountText}>{deviceList.length}</Text>
            </View>
          </View>

          <View style={styles.deviceList}>
            {deviceList.map((entry) => (
              <DeviceCard
                key={entry.user_id}
                entry={entry}
                isMe={entry.user_id === userId}
                onRoleChange={handleRoleChange}
              />
            ))}

            {deviceList.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="wifi" size={18} color={C.textSecondary} />
                <Text style={styles.emptyText}>Waiting for devices to connect…</Text>
              </View>
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
                <View style={styles.competitorBib}>
                  <Text style={styles.competitorBibText}>
                    {c.bib_number ? `#${c.bib_number}` : String(index + 1)}
                  </Text>
                </View>
                <Text style={styles.competitorName}>{c.display_name}</Text>
              </View>
            ))}

            {competitors.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="users" size={18} color={C.textSecondary} />
                <Text style={styles.emptyText}>No competitors added yet</Text>
              </View>
            )}
          </View>
        </View>

        {startError != null && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={C.error} />
            <Text style={styles.errorText}>{startError}</Text>
          </View>
        )}
      </ScrollView>

      {/* Start Session Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!canStart && deviceList.length > 0 && (
          <Text style={styles.startHint}>
            Assign START + END roles and wait for all devices to sync
          </Text>
        )}
        <TouchableOpacity
          style={[styles.startBtn, (!canStart || starting) && styles.startBtnDisabled]}
          onPress={handleStartSession}
          activeOpacity={0.85}
          disabled={!canStart || starting}
        >
          {starting ? (
            <ActivityIndicator size="small" color="#0F0F0F" />
          ) : (
            <>
              <Feather name="play" size={18} color={canStart ? '#0F0F0F' : C.textSecondary} />
              <Text style={[styles.startBtnText, !canStart && styles.startBtnTextDisabled]}>
                START SESSION
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Competitor Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal} />
        <View style={[styles.addSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>ADD COMPETITOR</Text>
            <TouchableOpacity onPress={closeModal} hitSlop={12}>
              <Feather name="x" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetBody}>
            <TextInput
              style={styles.sheetInput}
              value={newCompName}
              onChangeText={setNewCompName}
              placeholder="Display name *"
              placeholderTextColor={C.textSecondary}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextInput
              style={styles.sheetInput}
              value={newCompBib}
              onChangeText={setNewCompBib}
              placeholder="Bib number (optional)"
              placeholderTextColor={C.textSecondary}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleAddCompetitor}
            />

            {addCompError != null && <Text style={styles.sheetError}>{addCompError}</Text>}

            <TouchableOpacity
              style={[
                styles.addConfirmBtn,
                (!newCompName.trim() || addingComp) && styles.btnDisabled,
              ]}
              onPress={handleAddCompetitor}
              disabled={!newCompName.trim() || addingComp}
              activeOpacity={0.85}
            >
              {addingComp ? (
                <ActivityIndicator size="small" color="#0F0F0F" />
              ) : (
                <Text style={styles.addConfirmBtnText}>ADD COMPETITOR</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── DeviceCard sub-component ─────────────────────────────────────────────────

interface DeviceCardProps {
  entry: DeviceEntry;
  isMe: boolean;
  onRoleChange: (userId: string, role: CheckpointRole) => void;
}

function DeviceCard({ entry, isMe, onRoleChange }: DeviceCardProps) {
  return (
    <View style={[styles.deviceCard, !entry.connected && styles.deviceCardDisconnected]}>
      {/* Top row: status + name + sync badge */}
      <View style={styles.deviceCardTop}>
        <View style={[styles.statusDot, entry.connected ? styles.dotOnline : styles.dotOffline]} />
        <Text
          style={[styles.deviceUsername, !entry.connected && styles.textDimmed]}
          numberOfLines={1}
        >
          {entry.username}
          {isMe && <Text style={styles.youLabel}> · You</Text>}
        </Text>
        {entry.synced ? (
          <View style={styles.syncedBadge}>
            <Feather name="check" size={10} color={C.accent} />
            <Text style={styles.syncedText}>SYNCED</Text>
          </View>
        ) : entry.connected ? (
          <Text style={styles.syncingText}>syncing…</Text>
        ) : (
          <Text style={styles.disconnectedText}>offline</Text>
        )}
      </View>

      {/* Role selector */}
      <View style={styles.roleSelector}>
        {ROLES.map((r) => {
          const selected = entry.role === r.value;
          return (
            <TouchableOpacity
              key={r.value}
              style={[styles.rolePill, selected && styles.rolePillSelected]}
              onPress={() => onRoleChange(entry.user_id, r.value)}
              disabled={!entry.connected}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={r.icon}
                size={12}
                color={selected ? C.accent : C.textSecondary}
                style={styles.rolePillIcon}
              />
              <Text style={[styles.rolePillText, selected && styles.rolePillTextSelected]}>
                {r.shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

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
  headerCenter: { alignItems: 'center', gap: 2, flex: 1, marginHorizontal: 12 },
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
  wsIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.textSecondary,
  },
  wsIndicatorOn: { backgroundColor: C.online },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  // Code row
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  codeLeft: { gap: 4 },
  codeSmallLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  codeValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeValue: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 32,
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
  divider: { height: 1, backgroundColor: C.border, marginBottom: 20 },

  // Sections
  section: { marginBottom: 24 },
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
    marginBottom: 12,
  },

  // Device count badge
  deviceCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textSecondary },
  liveDotOn: { backgroundColor: C.online },
  deviceCountText: { fontFamily: 'BarlowCondensed-Bold', fontSize: 12, color: C.accent },

  // Device list
  deviceList: { gap: 8 },

  // Device card
  deviceCard: {
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  deviceCardDisconnected: { opacity: 0.5 },
  deviceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotOnline: { backgroundColor: C.online },
  dotOffline: { backgroundColor: C.offline },
  deviceUsername: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textPrimary,
  },
  textDimmed: { color: C.textSecondary },
  youLabel: { fontFamily: 'Barlow-Regular', fontSize: 15, color: C.textSecondary },
  syncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237,216,61,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(237,216,61,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  syncedText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: C.accent,
  },
  syncingText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    fontStyle: 'italic',
  },
  disconnectedText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Role selector
  roleSelector: { flexDirection: 'row', gap: 6 },
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  rolePillSelected: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentSubtle,
  },
  rolePillIcon: { marginRight: 1 },
  rolePillText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  rolePillTextSelected: { color: C.accent },

  // Empty state
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 20,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textSecondary,
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
  competitorList: { gap: 8 },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  competitorBib: {
    minWidth: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#252223',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  competitorBibText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 13,
    color: C.textMuted,
    letterSpacing: 0.5,
  },
  competitorName: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textPrimary,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(224,92,92,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginTop: 4,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.error,
    lineHeight: 19,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bgHeader,
    gap: 10,
  },
  startHint: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'center',
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
  startBtnDisabled: {
    backgroundColor: '#252223',
    borderWidth: 1,
    borderColor: C.border,
  },
  startBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 18,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
  startBtnTextDisabled: { color: C.textSecondary },
  btnDisabled: { opacity: 0.4 },

  // Add Competitor modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
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
  sheetBody: { gap: 12 },
  sheetInput: {
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: 'Barlow-Regular',
    fontSize: 16,
    color: C.textPrimary,
  },
  sheetError: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.error,
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
