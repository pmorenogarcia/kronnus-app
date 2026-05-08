import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { RegistrationError, registerUser } from '@/src/api';

const C = {
  bg: '#1C1C1C',
  accent: '#EDD83D',
  textPrimary: '#F5F5F5',
  textSecondary: '#888888',
  textMuted: '#555555',
  inputBg: '#272727',
  inputBorder: '#333333',
  error: '#FF4444',
  errorSubtle: 'rgba(255,68,68,0.12)',
  dark: '#1C1C1C',
};

interface FieldErrors {
  username: string | null;
  email: string | null;
  password: string | null;
  confirm: string | null;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    username: null,
    email: null,
    password: null,
    confirm: null,
  });

  const [focused, setFocused] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  function setFieldError(field: keyof FieldErrors, msg: string | null) {
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: null }));
  }

  function validate(): boolean {
    const errs: FieldErrors = { username: null, email: null, password: null, confirm: null };
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

    if (!password) {
      errs.password = 'Password is required.';
      ok = false;
    } else if (password.length < 8) {
      errs.password = 'Must be at least 8 characters.';
      ok = false;
    }

    if (!confirm) {
      errs.confirm = 'Please confirm your password.';
      ok = false;
    } else if (confirm !== password) {
      errs.confirm = 'Passwords do not match.';
      ok = false;
    }

    setFieldErrors(errs);
    return ok;
  }

  async function handleRegister() {
    setGlobalError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const { token } = await registerUser(username.trim(), email.trim(), password);
      signIn(token);
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof RegistrationError) {
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
      style={[styles.root, { backgroundColor: C.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('../assets/images/icon.png')} style={styles.logoIcon} />
          <View>
            <Text style={styles.logoName}>KRONNUS</Text>
            <Text style={styles.logoTagline}>JUST IN TIME</Text>
          </View>
        </View>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>CREATE ACCOUNT</Text>
          <Text style={styles.subheading}>Set up your timing profile</Text>
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
              <Feather name="user" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="timing_hero"
                placeholderTextColor={C.textMuted}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  clearFieldError('username');
                }}
                onFocus={() => setFocused((f) => ({ ...f, username: true }))}
                onBlur={() => setFocused((f) => ({ ...f, username: false }))}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
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
              <Feather name="mail" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="joao.duarte@email.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clearFieldError('email');
                }}
                onFocus={() => setFocused((f) => ({ ...f, email: true }))}
                onBlur={() => setFocused((f) => ({ ...f, email: false }))}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
            {fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View
              style={[
                styles.inputWrapper,
                focused.password && styles.inputWrapperFocused,
                !!fieldErrors.password && styles.inputWrapperError,
              ]}
            >
              <Feather name="lock" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearFieldError('password');
                  if (confirm && confirm !== v) {
                    setFieldError('confirm', 'Passwords do not match.');
                  } else if (confirm === v) {
                    clearFieldError('confirm');
                  }
                }}
                onFocus={() => setFocused((f) => ({ ...f, password: true }))}
                onBlur={() => setFocused((f) => ({ ...f, password: false }))}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={C.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
          </View>

          {/* Confirm password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View
              style={[
                styles.inputWrapper,
                focused.confirm && styles.inputWrapperFocused,
                !!fieldErrors.confirm && styles.inputWrapperError,
              ]}
            >
              <Feather
                name="check-circle"
                size={18}
                color={C.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                ref={confirmRef}
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  if (v && v !== password) {
                    setFieldError('confirm', 'Passwords do not match.');
                  } else {
                    clearFieldError('confirm');
                  }
                }}
                onFocus={() => setFocused((f) => ({ ...f, confirm: true }))}
                onBlur={() => setFocused((f) => ({ ...f, confirm: false }))}
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Feather name={showConfirm ? 'eye-off' : 'eye'} size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            {fieldErrors.confirm && <Text style={styles.fieldError}>{fieldErrors.confirm}</Text>}
          </View>
        </View>

        {/* Global error */}
        {globalError && <Text style={styles.globalError}>{globalError}</Text>}

        {/* CTA */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.createBtn, loading && styles.createBtnLoading]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.dark} />
            ) : (
              <>
                <Feather name="user-plus" size={16} color={C.dark} />
                <Text style={styles.createBtnText}>CREATE ACCOUNT</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.signInText}>ALREADY HAVE AN ACCOUNT?</Text>
            <Text style={styles.signInAccent}> SIGN IN</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Logo — identical to login
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'center',
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  logoName: {
    fontFamily: 'BarlowCondensed-ExtraBold',
    fontSize: 26,
    letterSpacing: 2,
    color: '#F5F5F5',
  },
  logoTagline: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#888888',
    marginTop: 2,
  },

  // Heading
  headingBlock: {
    alignItems: 'center',
    marginTop: 48,
    gap: 6,
  },
  heading: {
    fontFamily: 'BarlowCondensed-ExtraBold',
    fontSize: 40,
    letterSpacing: 1.6,
    color: '#F5F5F5',
  },
  subheading: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    letterSpacing: 0.4,
    color: '#888888',
  },

  // Form
  form: {
    marginTop: 40,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: '#888888',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272727',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputWrapperFocused: {
    borderColor: C.accent,
  },
  inputWrapperError: {
    borderColor: C.error,
    backgroundColor: C.errorSubtle,
  },
  inputIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 15,
    color: '#F5F5F5',
    padding: 0,
  },
  fieldHint: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#555555',
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
    marginTop: 8,
  },

  // Actions
  actions: {
    marginTop: 32,
    gap: 12,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 50,
    paddingVertical: 17,
    paddingHorizontal: 24,
    gap: 10,
  },
  createBtnLoading: {
    opacity: 0.8,
  },
  createBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 16,
    letterSpacing: 2,
    color: '#1C1C1C',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: '#555555',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  signInText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 1,
    color: '#F5F5F5',
  },
  signInAccent: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 1,
    color: C.accent,
  },
});
