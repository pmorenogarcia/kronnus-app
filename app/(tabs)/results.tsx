import { Feather } from '@expo/vector-icons';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { getResults, getSessionState } from '@/src/api';
import type { CompetitorResult } from '@/src/api';
import { formatElapsedMs, formatGap } from '@/src/utils';

// ─── Design tokens (Paper) ───────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgBar: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentBg: 'rgba(237,216,61,0.08)',
  accentBorder: 'rgba(237,216,61,0.25)',
  silver: '#A2A7A5',
  silverBg: 'rgba(162,167,165,0.08)',
  silverBorder: 'rgba(162,167,165,0.25)',
  bronze: '#C4894E',
  bronzeBg: 'rgba(196,137,78,0.08)',
  bronzeBorder: 'rgba(196,137,78,0.25)',
  border: '#2A2728',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function rankColor(rank: number): string {
  if (rank === 1) return C.accent;
  if (rank === 2) return C.silver;
  return C.bronze;
}

function rankBg(rank: number): string {
  if (rank === 1) return C.accentBg;
  if (rank === 2) return C.silverBg;
  return C.bronzeBg;
}

function rankBorder(rank: number): string {
  if (rank === 1) return C.accentBorder;
  if (rank === 2) return C.silverBorder;
  return C.bronzeBorder;
}

function podiumStepHeight(rank: number): number {
  if (rank === 1) return 80;
  if (rank === 2) return 56;
  return 40;
}

// ─── Podium slot ─────────────────────────────────────────────────────────────

interface PodiumSlotProps {
  result: CompetitorResult;
  rank: number;
  isCenter?: boolean;
}

function PodiumSlot({ result, rank, isCenter = false }: PodiumSlotProps) {
  const color = rankColor(rank);
  const bg = rankBg(rank);
  const border = rankBorder(rank);
  const avatarSize = isCenter ? 64 : 52;
  const rankLabel = rank === 1 ? '1ST' : rank === 2 ? '2ND' : '3RD';

  return (
    <View style={[styles.podiumSlot, isCenter && styles.podiumSlotCenter]}>
      <View style={styles.podiumInfo}>
        <View style={[styles.podiumRankBadge, { backgroundColor: bg, borderColor: border }]}>
          <Text style={[styles.podiumRankLabel, { color }]}>{rankLabel}</Text>
        </View>
        <View
          style={[
            styles.podiumAvatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              borderColor: border,
              backgroundColor: bg,
            },
          ]}
        >
          <Text style={[styles.podiumAvatarText, { color, fontSize: isCenter ? 22 : 18 }]}>
            {getInitials(result.display_name)}
          </Text>
        </View>
        <Text style={[styles.podiumName, isCenter && styles.podiumNameCenter]} numberOfLines={1}>
          {result.display_name}
        </Text>
        <Text style={[styles.podiumTime, { color: isCenter ? color : C.textMuted }]}>
          {formatElapsedMs(result.total_ms)}
        </Text>
      </View>
      <View
        style={[
          styles.podiumStep,
          {
            height: podiumStepHeight(rank),
            backgroundColor: bg,
            borderTopColor: border,
          },
        ]}
      >
        <Text style={[styles.podiumStepNumber, { color }]}>{rank}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { session_code } = useLocalSearchParams<{ session_code?: string }>();
  const code = session_code ?? '';

  const [results, setResults] = useState<CompetitorResult[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [sessionFinished, setSessionFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  const pollingRef = useRef(true);

  useEffect(() => {
    if (!token || !code) return;
    const t = token;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const [{ results: list }, stateResp] = await Promise.all([
          getResults(t, code),
          getSessionState(t, code),
        ]);
        if (cancelled) return;
        setResults(list);
        setSessionName(stateResp.session.name);
        if (stateResp.session.status === 'FINISHED') {
          setSessionFinished(true);
          pollingRef.current = false;
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch {
        // silent — keep showing stale data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    intervalId = setInterval(() => {
      if (pollingRef.current) load();
    }, 5_000);

    return () => {
      cancelled = true;
      pollingRef.current = false;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [token, code]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const finishers = results.filter((r) => !r.dnf).sort((a, b) => a.total_ms - b.total_ms);
  const dnfList = results.filter((r) => r.dnf);
  const podium = finishers.slice(0, 3);
  const leaderMs = finishers[0]?.total_ms ?? 0;

  // ─── Share ────────────────────────────────────────────────────────────────

  async function handleShare() {
    const header = `Kronnus Results — ${sessionName || code}`;
    const lines = finishers.map(
      (r, i) => `${i + 1}. ${r.display_name}  ${formatElapsedMs(r.total_ms)}`,
    );
    const dnfLines = dnfList.map((r) => `DNF  ${r.display_name}`);
    const text = [header, '', ...lines, ...(dnfLines.length ? ['', ...dnfLines] : [])].join('\n');
    try {
      await Share.share({ message: text });
    } catch {
      // dismissed
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Tabs.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>RESULTS</Text>
          <Text style={styles.topBarSub}>KRONNUS</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.7}>
          <Feather name="share" size={16} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Session bar */}
      <View style={styles.sessionBar}>
        <View style={styles.sessionBarLeft}>
          {sessionName ? (
            <Text style={styles.sessionName} numberOfLines={1}>
              {sessionName}
            </Text>
          ) : null}
          <Text style={styles.sessionCode}>{code}</Text>
        </View>
        <View style={[styles.statusPill, sessionFinished && styles.statusPillFinished]}>
          <View style={[styles.statusDot, sessionFinished && styles.statusDotFinished]} />
          <Text style={[styles.statusText, sessionFinished && styles.statusTextFinished]}>
            {sessionFinished ? 'FINISHED' : 'LIVE'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {/* ── Podium ── */}
          {podium.length > 0 && (
            <View style={styles.podiumSection}>
              <Text style={styles.sectionLabel}>TOP FINISHERS</Text>
              <View style={styles.podiumRow}>
                {/* 2nd — left */}
                {podium[1] ? (
                  <PodiumSlot result={podium[1]} rank={2} />
                ) : (
                  <View style={styles.podiumSlot} />
                )}
                {/* 1st — centre, elevated */}
                <PodiumSlot result={podium[0]} rank={1} isCenter />
                {/* 3rd — right */}
                {podium[2] ? (
                  <PodiumSlot result={podium[2]} rank={3} />
                ) : (
                  <View style={styles.podiumSlot} />
                )}
              </View>
            </View>
          )}

          {/* Divider */}
          {podium.length > 0 && <View style={styles.divider} />}

          {/* ── Full results table ── */}
          <View style={styles.tableSection}>
            <View style={styles.tableHeader}>
              <Text style={styles.sectionLabel}>FULL RESULTS</Text>
              <Text style={styles.tableCount}>{results.length} ENTRIES</Text>
            </View>

            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="clock" size={32} color={C.textSecondary} />
                <Text style={styles.emptyTitle}>No results yet</Text>
                <Text style={styles.emptySubtitle}>Waiting for competitors to finish</Text>
              </View>
            ) : (
              <>
                {finishers.map((r, i) => (
                  <View
                    key={r.competitor_id}
                    style={[styles.tableRow, i === 0 && styles.tableRowFirst]}
                  >
                    <View style={[styles.rowRankCircle, i === 0 && styles.rowRankCircleFirst]}>
                      <Text style={[styles.rowRankText, i === 0 && styles.rowRankTextFirst]}>
                        {i + 1}
                      </Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {r.display_name}
                      </Text>
                      {r.bib_number ? <Text style={styles.rowBib}>#{r.bib_number}</Text> : null}
                      {r.segments.length > 0 && (
                        <View style={styles.segmentList}>
                          {r.segments.map((seg, si) => (
                            <View key={si} style={styles.segmentRow}>
                              <Text style={styles.segmentLabel}>
                                {seg.from_role} → {seg.to_role}
                              </Text>
                              <Text style={styles.segmentTime}>
                                {formatElapsedMs(seg.elapsed_ms)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <View style={styles.rowTimes}>
                      <Text style={[styles.rowTime, i === 0 && styles.rowTimeFirst]}>
                        {formatElapsedMs(r.total_ms)}
                      </Text>
                      {i > 0 && (
                        <Text style={styles.rowGap}>{formatGap(r.total_ms - leaderMs)}</Text>
                      )}
                    </View>
                  </View>
                ))}

                {dnfList.map((r) => (
                  <View key={r.competitor_id} style={[styles.tableRow, styles.tableRowDnf]}>
                    <View style={styles.rowDnfBadge}>
                      <Text style={styles.rowDnfText}>DNF</Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, styles.rowNameDnf]} numberOfLines={1}>
                        {r.display_name}
                      </Text>
                      {r.bib_number ? <Text style={styles.rowBib}>#{r.bib_number}</Text> : null}
                    </View>
                    <View style={styles.rowTimes}>
                      <Text style={styles.rowTimeDash}>—</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.bgBar,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    alignItems: 'center',
    gap: 2,
  },
  topBarTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.5,
    color: C.textPrimary,
    textTransform: 'uppercase',
  },
  topBarSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // ── Session bar ──
  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sessionBarLeft: {
    gap: 2,
    flex: 1,
    marginRight: 12,
  },
  sessionName: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    letterSpacing: 0.5,
    color: C.textPrimary,
  },
  sessionCode: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: C.textSecondary,
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillFinished: {
    backgroundColor: C.silverBg,
    borderColor: C.silverBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  statusDotFinished: {
    backgroundColor: C.textSecondary,
  },
  statusText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.accent,
    textTransform: 'uppercase',
  },
  statusTextFinished: {
    color: C.textSecondary,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },

  // ── Section label ──
  sectionLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // ── Podium section ──
  podiumSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 18,
    gap: 6,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
  },
  podiumSlotCenter: {
    flex: 1.2,
  },
  podiumInfo: {
    alignItems: 'center',
    gap: 7,
    paddingBottom: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  podiumRankBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  podiumRankLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  podiumAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  podiumAvatarText: {
    fontFamily: 'BarlowCondensed-Black',
    letterSpacing: 0.5,
  },
  podiumName: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  podiumNameCenter: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
  },
  podiumTime: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    textAlign: 'center',
  },
  podiumStep: {
    width: '100%',
    borderTopWidth: 1.5,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumStepNumber: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 26,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },

  // ── Table section ──
  tableSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tableCount: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    gap: 12,
  },
  tableRowFirst: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentBg,
  },
  tableRowDnf: {
    opacity: 0.55,
  },
  rowRankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowRankCircleFirst: {
    backgroundColor: C.accent,
  },
  rowRankText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 14,
    color: C.textMuted,
  },
  rowRankTextFirst: {
    color: '#0F0F0F',
  },
  rowDnfBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowDnfText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: C.textSecondary,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textPrimary,
    lineHeight: 18,
  },
  rowNameDnf: {
    color: C.textSecondary,
  },
  rowBib: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: C.textSecondary,
  },
  rowTimes: {
    alignItems: 'flex-end',
    gap: 3,
  },
  rowTime: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: C.textMuted,
  },
  rowTimeFirst: {
    fontFamily: 'SpaceMono-Bold',
    color: C.accent,
  },
  rowTimeDash: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: C.textSecondary,
  },
  rowGap: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: C.textSecondary,
  },
  segmentList: {
    marginTop: 4,
    gap: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 9,
    letterSpacing: 1,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  segmentTime: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: C.textMuted,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 24,
    letterSpacing: 0.5,
    color: C.textPrimary,
  },
  emptySubtitle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
