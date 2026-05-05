import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

const SETTINGS_KEY = 'kronnus_settings';

export interface AppSettings {
  language: 'en' | 'ca' | 'es';
  soundEffects: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  soundEffects: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SETTINGS_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) });
          } catch {
            // ignore malformed JSON
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // best-effort persistence
    }
  }

  return { settings, loaded, updateSetting };
}
