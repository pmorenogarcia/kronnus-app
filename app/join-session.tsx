import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { joinSession, SessionError } from '@/src/api';
import type { CheckpointRole } from '@/src/api';

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

interface RoleOption {
  value: CheckpointRole;
  label: string;
  icon: string;
}

const ROLES: RoleOption[] = [
  { value: 'START', label: 'START', icon: 'flag-outline' },
  { value: 'SPLIT', label: 'INTERM.', icon: 'timer-outline' },
  { value: 'END', label: 'FINISH', icon: 'flag-checkered' },
];

export default function JoinSessionScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [code, setCode] = useState('');
  const [role, setRole] = useState<CheckpointRole>('START');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!token) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter the session code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await joinSession(token, trimmed, role);
      router.replace({
        pathname: '/waiting-room' as any,
        params: {
          session_id: result.session_id,
          session_code: trimmed,
          role: result.role,
        },
      });
    } catch (e) {
      if (e instanceof SessionError && e.statusCode === 409) {
        // Already joined — backend will be made idempotent; for now guide the user
        setError(
          'You are already registered in this session. Ask the organiser to confirm your spot, or wait for the backend to support re-entry.',
        );
      } else {
        setError(e instanceof SessionError ? e.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={18} color={C.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>JOIN SESSION</Text>
            <Text style={styles.headerSub}>KRONNUS</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Feather name="link" size={28} color={C.accent} />
            </View>
            <Text style={styles.heroLabel}>SESSION CODE</Text>
            <Text style={styles.heroHeading}>ENTER CODE</Text>
            <Text style={styles.heroBody}>
              Enter the code shared by the organiser to join live timing.
            </Text>
          </View>

          {/* Code input */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SESSION CODE</Text>
            <View style={[styles.codeInputWrap, code.length > 0 && styles.codeInputWrapFilled]}>
              <TextInput
                style={[styles.codeInput, code.length > 0 && styles.codeInputFilled]}
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase());
                  if (error) setError(null);
                }}
                placeholder="_ _ _ _ _ _"
                placeholderTextColor={C.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleJoin}
              />
            </View>
            <Text style={styles.formatHint}>FORMAT · ABC – XXXX</Text>
          </View>

          {/* Role selector */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>YOUR ROLE</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => {
                const selected = role === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleCard, selected && styles.roleCardSelected]}
                    onPress={() => setRole(r.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleIconWrap, selected && styles.roleIconWrapSelected]}>
                      <MaterialCommunityIcons
                        name={r.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                        size={18}
                        color={selected ? C.accent : C.textSecondary}
                      />
                    </View>
                    <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {error != null && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        {/* CTA */}
        <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.joinBtn, loading && styles.btnDisabled]}
            onPress={handleJoin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0F0F0F" />
            ) : (
              <>
                <Feather name="arrow-right" size={18} color="#0F0F0F" />
                <Text style={styles.joinBtnText}>JOIN SESSION</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.hintRow}>
            <Feather name="info" size={12} color={C.textSecondary} />
            <Text style={styles.hintText}>ASK THE ORGANISER FOR THE SESSION CODE</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 28,
  },

  // Hero
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#1E1C1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  heroHeading: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 46,
    letterSpacing: 1,
    color: C.textPrimary,
    textTransform: 'uppercase',
    lineHeight: 50,
  },
  heroBody: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
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
  codeInputWrap: {
    backgroundColor: C.bgInput,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  codeInputWrapFilled: {
    borderColor: 'rgba(237,216,61,0.35)',
  },
  codeInput: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 32,
    color: C.textSecondary,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 4,
  },
  codeInputFilled: {
    color: C.accent,
  },
  formatHint: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textAlign: 'center',
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
  },
  roleCardSelected: {
    borderColor: C.accent,
    borderWidth: 2,
    backgroundColor: C.accentSubtle,
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#252223',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapSelected: {
    backgroundColor: C.accentMid,
  },
  roleLabel: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 13,
    letterSpacing: 1,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  roleLabelSelected: {
    color: C.accent,
  },

  // Error
  errorText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.error,
    textAlign: 'center',
  },

  // CTA
  cta: {
    backgroundColor: C.bgHeader,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 58,
    gap: 8,
  },
  joinBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 18,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
  btnDisabled: { opacity: 0.55 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hintText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
});
