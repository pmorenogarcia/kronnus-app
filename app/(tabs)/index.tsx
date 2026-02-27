import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { callHello } from '@/services';

type CallState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; message: string }
  | { status: 'error'; error: string };

export default function HomeScreen() {
  const [callState, setCallState] = useState<CallState>({ status: 'idle' });

  async function handleCallBackend() {
    setCallState({ status: 'loading' });
    try {
      const message = await callHello();
      setCallState({ status: 'success', message });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setCallState({ status: 'error', error });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Kronnus
      </ThemedText>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleCallBackend}
        disabled={callState.status === 'loading'}
      >
        <ThemedText style={styles.buttonText}>Call to the Backend</ThemedText>
      </Pressable>

      {callState.status === 'loading' && (
        <ThemedView style={styles.responseContainer}>
          <ActivityIndicator size="large" />
        </ThemedView>
      )}

      {callState.status === 'success' && (
        <ThemedView style={styles.responseContainer}>
          <ThemedText style={styles.responseText}>{callState.message}</ThemedText>
        </ThemedView>
      )}

      {callState.status === 'error' && (
        <ThemedView style={styles.responseContainer}>
          <ThemedText style={styles.errorText}>{callState.error}</ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  title: {
    fontSize: 36,
  },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  responseContainer: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  responseText: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
  },
});
