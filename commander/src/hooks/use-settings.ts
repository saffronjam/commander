import { useEffect, useState } from 'react';
import { Settings } from 'src/types';

const defaultSettings: Settings = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3002',
  productionView: {
    includeMinable: true,
    includeItems: true,
  },
  intervals: {
    rerender: 1000,
    satisfactoryApiCheck: 1000,
    circuits: 500,
    factoryStats: 2000,
    prodStats: 2000,
    sinkStats: 2000,
    itemStats: 2000,
    players: 2000,
    generatorStats: 2000,
  },
};

export type SettingsProps = {
  reloadEverySecond?: boolean;
};

export function useSettings({ reloadEverySecond = true }: SettingsProps = {}) {
  const settingsKey = 'commander-settings';

  const parseFromStorageOrDefault = () => {
    return JSON.parse(localStorage.getItem(settingsKey) || JSON.stringify(defaultSettings));
  };

  const [settings, setSettings] = useState<Settings>({
    ...defaultSettings,
    ...parseFromStorageOrDefault(),
  });

  // Set up reload settings every 1 second, and check for changes
  if (reloadEverySecond) {
    useEffect(() => {
      const interval = setInterval(() => {
        const storedSettings = JSON.parse(
          localStorage.getItem(settingsKey) || JSON.stringify(defaultSettings)
        );
        if (JSON.stringify(storedSettings) !== JSON.stringify(settings)) {
          setSettings({ ...defaultSettings, ...storedSettings });
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [settings]);
  }

  const saveSettings = (newSettings: Settings) => {
    localStorage.setItem(settingsKey, JSON.stringify(newSettings));
    setSettings(newSettings);
  };

  return { settings, saveSettings, defaultSettings };
}
