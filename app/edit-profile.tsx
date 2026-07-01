import { Feather } from '@expo/vector-icons';
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
import { UpdateProfileError, updateMe } from '@/src/api';

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgInput: '#1A1819',
  accent: '#EDD83D',
  accentSubtle: 'rgba(237,216,61,0.08)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  error: '#E05C5C',
  errorSubtle: 'rgba(224,92,92,0.10)',
  errorBorder: 'rgba(224,92,92,0.35)',
};

interface FieldErrors {
  username: string | null;
  email: string | null;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, updateUser } = useAuth();

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ username: null, email: null });
  const [focused, setFocused] = useState<Record<string, boolean>>({});

  function setFieldError(field: keyof FieldErrors, msg: string | null) {
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: null }));
  }

  function validate(): boolean {
    const errs: FieldErrors = { username: null, email: null };
    let ok = true;

    if (!username.trim()) {
      errs.username = 'Username is required.';
      ok = false;
    } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      errs.username = '3–30 chars · letters, numbers, underscores only.';
      ok = false;
    }

    if (!email.trim()) {
      errs.email = 'Email is required.';
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address.';
      ok = false;
    }

    setFieldErrors(errs);
    return ok;
  }

  async function handleSave() {
    setGlobalError(null);
    if (!validate() || !token) return;

    setLoading(true);
    try {
      const updated = await updateMe({
        username: username.trim(),
        email: email.trim(),
      });
      updateUser(updated);
      router.back();
    } catch (err) {
      if (err instanceof UpdateProfileError) {
        if (err.field === 'username') {
          setFieldError('username', 'Username already taken.');
        } else if (err.field === 'email') {
          setFieldError('email', 'Email already in use.');
        } else {
          setGlobalError(err.message);
        }
      } else {
        setGlobalError(
          err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            <Text style={styles.headerTitle}>EDIT PROFILE</Text>
            <Text style={styles.headerSub}>KRONNUS</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>USERNAME</Text>
            <View
              style={[
                styles.inputWrapper,
                focused.username && styles.inputWrapperFocused,
                !!fieldErrors.username && styles.inputWrapperError,
              ]}
            >
              <Feather name="user" size={16} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  clearFieldError('username');
                }}
                onFocus={() => setFocused((f) => ({ ...f, username: true }))}
                onBlur={() => setFocused((f) => ({ ...f, username: false }))}
                placeholder="username"
                placeholderTextColor={C.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            {fieldErrors.username ? (
              <Text style={styles.fieldError}>{fieldErrors.username}</Text>
            ) : (
              <Text style={styles.fieldHint}>3–30 chars · letters, numbers, underscores</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <View
              style={[
                styles.inputWrapper,
                focused.email && styles.inputWrapperFocused,
                !!fieldErrors.email && styles.inputWrapperError,
              ]}
            >
              <Feather name="mail" size={16} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clearFieldError('email');
                }}
                onFocus={() => setFocused((f) => ({ ...f, email: true }))}
                onBlur={() => setFocused((f) => ({ ...f, email: false }))}
                placeholder="email@example.com"
                placeholderTextColor={C.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
            {fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
          </View>

          {globalError && <Text style={styles.globalError}>{globalError}</Text>}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnLoading]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#0F0F0F" size="small" />
            ) : (
              <>
                <Feather name="check" size={16} color="#0F0F0F" />
                <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },

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

  // Form
  form: {
    paddingHorizontal: 20,
    paddingTop: 32,
    gap: 16,
  },
  fieldGroup: { gap: 6 },
  label: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputWrapperFocused: { borderColor: C.accent },
  inputWrapperError: { borderColor: C.error, backgroundColor: C.errorSubtle },
  inputIcon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: C.textPrimary,
    padding: 0,
  },
  fieldHint: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    color: C.textSecondary,
    paddingLeft: 2,
  },
  fieldError: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.error,
    paddingLeft: 2,
  },
  globalError: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.error,
    textAlign: 'center',
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 58,
    gap: 8,
    marginTop: 8,
  },
  saveBtnLoading: { opacity: 0.8 },
  saveBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 18,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
});
