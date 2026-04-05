import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { login } from '@/services';

const C = {
  bg: '#1C1C1C',
  accent: '#EDD83D',
  textPrimary: '#F5F5F5',
  textSecondary: '#888888',
  textMuted: '#555555',
  inputBg: '#272727',
  inputBorder: '#333333',
  dark: '#1C1C1C',
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleSignIn() {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Missing credentials', 'Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login({ identifier: identifier.trim(), password });
      signIn(result.token, result.user);
      router.replace('/(tabs)/');
    } catch (err) {
      const is4xx = err instanceof Error && /40[01]/.test(err.message);
      Alert.alert(
        'Sign In Failed',
        is4xx
          ? 'Invalid email/username or password.'
          : 'Could not connect to the server. Make sure the backend is running and try again.',
      );
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
          <View style={styles.logoIconWrapper}>
            <Feather name="clock" size={24} color={C.dark} />
          </View>
          <View>
            <Text style={styles.logoName}>KRONNUS</Text>
            <Text style={styles.logoTagline}>JUST IN TIME</Text>
          </View>
        </View>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>WELCOME BACK</Text>
          <Text style={styles.subheading}>Sign in to continue tracking</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL OR USERNAME</Text>
            <View style={[styles.inputWrapper, identifierFocused && styles.inputWrapperFocused]}>
              <Feather name="mail" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="joao.duarte@email.com"
                placeholderTextColor={C.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                onFocus={() => setIdentifierFocused(true)}
                onBlur={() => setIdentifierFocused(false)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
              <Feather name="lock" size={18} color={C.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
            <Text style={styles.forgotText}>FORGOT PASSWORD?</Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.signInBtn, loading && styles.signInBtnLoading]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.dark} />
            ) : (
              <>
                <Feather name="arrow-right" size={16} color={C.dark} />
                <Text style={styles.signInText}>SIGN IN</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.registerBtn} activeOpacity={0.7}>
            <Text style={styles.registerText}>{"DON'T HAVE AN ACCOUNT?"}</Text>
            <Text style={styles.registerAccent}> REGISTER HERE</Text>
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

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'center',
  },
  logoIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1,
    color: C.accent,
  },

  // Actions
  actions: {
    marginTop: 32,
    gap: 12,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 50,
    paddingVertical: 17,
    paddingHorizontal: 24,
    gap: 10,
  },
  signInBtnLoading: {
    opacity: 0.8,
  },
  signInText: {
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
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  registerText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 1,
    color: '#F5F5F5',
  },
  registerAccent: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 1,
    color: C.accent,
  },
});
