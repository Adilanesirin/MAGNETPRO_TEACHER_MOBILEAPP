import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

const VERSION_API = 'https://ship.imcbs.com/api/v1/edu-magnet/';

function isOutdated(current: string, target: string): boolean {
  const c = current.split('.').map(Number);
  const t = target.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, t.length); i++) {
    const cv = c[i] || 0, tv = t[i] || 0;
    if (cv < tv) return true;
    if (cv > tv) return false;
  }
  return false;
}

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [storeUrl, setStoreUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(VERSION_API);
        const json = await res.json();
        const platformData = Platform.OS === 'ios' ? json?.data?.ios : json?.data?.android;

        // iOS block won't exist until published there — skip check gracefully
        if (!platformData) return;

        const currentVersion = Constants.expoConfig?.version || '0.0.0';
        const { latest_version, store_url } = platformData;

        // Notify whenever the installed build is older than the latest published version
        if (latest_version && isOutdated(currentVersion, latest_version)) {
          setUpdateAvailable(true);
          setMessage(
            json?.data?.release_notes && json.data.release_notes !== 'complete'
              ? json.data.release_notes
              : `A new version (${latest_version}) is available. Please update for the latest features and fixes.`
          );
          setStoreUrl(store_url || '');
        }
      } catch (err) {
        console.error('Version check failed:', err);
      }
    })();
  }, []);

  const openStore = () => storeUrl && Linking.openURL(storeUrl);
  return { updateAvailable, message, openStore };
}