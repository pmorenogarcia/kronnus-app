import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentBg: 'rgba(237,216,61,0.10)',
  accentBorder: 'rgba(237,216,61,0.22)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
};

export default function ContactScreen() {
  const insets = useSafeAreaInsets();

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
          <Text style={styles.headerTitle}>CONTACT</Text>
          <Text style={styles.headerSub}>KRONNUS</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Body */}
      <View style={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.iconCircle}>
          <Feather name="mail" size={28} color={C.accent} />
        </View>
        <Text style={styles.bodyTitle}>GET IN TOUCH</Text>
        <Text style={styles.bodySubtitle}>
          Questions, feedback or support?{'\n'}Reach out below.
        </Text>

        <TouchableOpacity
          style={styles.emailCard}
          activeOpacity={0.75}
          onPress={() => void Linking.openURL('mailto:pmorenogarcia@uoc.edu')}
        >
          <View style={styles.emailIconWrap}>
            <Feather name="at-sign" size={16} color={C.accent} />
          </View>
          <View style={styles.emailTextGroup}>
            <Text style={styles.emailLabel}>EMAIL</Text>
            <Text style={styles.emailValue}>pmorenogarcia@uoc.edu</Text>
          </View>
          <Feather name="external-link" size={14} color={C.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

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

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bodyTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 26,
    letterSpacing: 1.5,
    color: C.textPrimary,
  },
  bodySubtitle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  emailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emailTextGroup: { flex: 1, gap: 2 },
  emailLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  emailValue: {
    fontFamily: 'Barlow-SemiBold',
    fontSize: 15,
    color: C.textPrimary,
  },
});
