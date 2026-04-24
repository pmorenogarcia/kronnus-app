import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  gold: '#EDD83D',
  silver: '#A2A7A5',
  bronze: '#8B5E3C',
};

interface Competitor {
  rank: number;
  name: string;
  time: string;
}

interface Session {
  id: string;
  name: string;
  date: string;
  competitors: number;
  podium?: Competitor[];
}

const RECENT_SESSIONS: Session[] = [
  {
    id: '1',
    name: 'City Marathon 2026',
    date: '12 MAR 2026',
    competitors: 8,
    podium: [
      { rank: 1, name: 'Miguel Santos', time: '01:24:38' },
      { rank: 2, name: 'Ana Ferreira', time: '01:26:14' },
      { rank: 3, name: 'Carlos Lima', time: '01:31:07' },
    ],
  },
  {
    id: '2',
    name: 'Trail Serra da Estrela',
    date: '08 MAR 2026',
    competitors: 5,
  },
];

const RANK_COLORS: Record<number, string> = {
  1: C.gold,
  2: C.silver,
  3: C.bronze,
};

const RANK_TEXT_COLORS: Record<number, string> = {
  1: '#0F0F0F',
  2: '#131313',
  3: C.textPrimary,
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const displayName = 'USER';
  const initials = '??';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoRow}>
          <View style={styles.logoIconWrapper}>
            <Feather name="clock" size={20} color="#0F0F0F" />
          </View>
          <View>
            <Text style={styles.logoName}>KRONNUS</Text>
            <Text style={styles.logoTagline}>JUST IN TIME</Text>
          </View>
        </View>
        <View style={styles.avatarWrapper}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View style={styles.welcome}>
          <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
          <Text style={styles.welcomeName}>{displayName}</Text>
        </View>

        {/* Action cards */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.createCard} activeOpacity={0.8}>
            <Feather name="plus" size={28} color="#0F0F0F" />
            <View style={styles.cardLabelGroup}>
              <Text style={styles.createCardTitle}>CREATE</Text>
              <Text style={styles.createCardSub}>NEW SESSION</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.joinCard} activeOpacity={0.8}>
            <Feather name="link" size={28} color={C.textMuted} />
            <View style={styles.cardLabelGroup}>
              <Text style={styles.joinCardTitle}>JOIN</Text>
              <Text style={styles.joinCardSub}>ENTER CODE</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent sessions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
          <View style={styles.sessionCountBadge}>
            <Text style={styles.sessionCountText}>{RECENT_SESSIONS.length}</Text>
          </View>
        </View>

        <View style={styles.sessionList}>
          {RECENT_SESSIONS.map((session) => (
            <TouchableOpacity key={session.id} style={styles.sessionCard} activeOpacity={0.7}>
              <View style={styles.sessionCardHeader}>
                <View style={styles.sessionMeta}>
                  <Text style={styles.sessionName}>{session.name}</Text>
                  <Text style={styles.sessionInfo}>
                    {session.date} · {session.competitors} COMPETITORS
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textSecondary} />
              </View>

              {session.podium && (
                <View style={styles.podium}>
                  {session.podium.map((entry) => (
                    <View key={entry.rank} style={styles.podiumRow}>
                      <View
                        style={[
                          styles.rankBadge,
                          { backgroundColor: RANK_COLORS[entry.rank] ?? C.textSecondary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.rankText,
                            { color: RANK_TEXT_COLORS[entry.rank] ?? C.textPrimary },
                          ]}
                        >
                          {entry.rank}
                        </Text>
                      </View>
                      <Text style={styles.competitorName}>{entry.name}</Text>
                      <Text style={styles.competitorTime}>{entry.time}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EDD83D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoName: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.6,
    color: '#E2DADB',
  },
  logoTagline: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: '#6D696A',
    textTransform: 'uppercase',
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6D696A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    color: '#E2DADB',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Welcome
  welcome: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 4,
  },
  welcomeLabel: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  welcomeName: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 42,
    letterSpacing: -0.4,
    color: C.textPrimary,
    lineHeight: 46,
  },

  // Action cards
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 12,
  },
  createCard: {
    flex: 1,
    backgroundColor: '#EDD83D',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  joinCard: {
    flex: 1,
    backgroundColor: C.bgCardAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  cardLabelGroup: {
    gap: 2,
  },
  createCardTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 22,
    letterSpacing: 0.8,
    color: '#0F0F0F',
  },
  createCardSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(19,19,19,0.6)',
    textTransform: 'uppercase',
  },
  joinCardTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 22,
    letterSpacing: 0.8,
    color: C.textPrimary,
  },
  joinCardSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    letterSpacing: 1.8,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  sessionCountBadge: {
    backgroundColor: 'rgba(237,216,61,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(237,216,61,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sessionCountText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    color: C.accent,
  },

  // Session list
  sessionList: {
    paddingHorizontal: 24,
    gap: 10,
  },
  sessionCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sessionMeta: {
    gap: 3,
    flex: 1,
  },
  sessionName: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 18,
    letterSpacing: 0.4,
    color: C.textPrimary,
  },
  sessionInfo: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Podium
  podium: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    gap: 6,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 11,
  },
  competitorName: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textPrimary,
  },
  competitorTime: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: C.textMuted,
  },
});
