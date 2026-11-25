import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// Automatsko ažuriranje "preko zraka" (EAS Update).
// Radi samo u instaliranoj aplikaciji (APK); u Expo Go i tijekom razvoja ne radi ništa.

// eslint-disable-next-line @typescript-eslint/no-var-requires
function getUpdates(): any | null {
  try {
    const U = require('expo-updates');
    return U && U.isEnabled ? U : null;
  } catch {
    return null;
  }
}

const MIN_INTERVAL = 10 * 60 * 1000; // provjera najviše svakih 10 minuta

// Vraća true dok se nova verzija instalira (za prikaz poruke na ekranu)
export function useAutoUpdate(): boolean {
  const [installing, setInstalling] = useState(false);
  const lastCheck = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const Updates = getUpdates();
    if (!Updates) return;

    async function check() {
      if (busy.current || Date.now() - lastCheck.current < MIN_INTERVAL) return;
      busy.current = true;
      lastCheck.current = Date.now();
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          setInstalling(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // aplikacija se ponovno pokrene s novom verzijom
        }
      } catch (e) {
        console.log('Provjera ažuriranja nije uspjela:', e);
        setInstalling(false);
      } finally {
        busy.current = false;
      }
    }

    check(); // pri pokretanju
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); }); // pri povratku u aplikaciju
    return () => sub.remove();
  }, []);

  return installing;
}

// Kratki opis verzije, npr. "1.0.0 · a1b2c3d4 (25.11. 14:05)", za lakše praćenje koja je verzija na mobitelu
export function versionLabel(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants').default;
  const base = Constants?.expoConfig?.version ?? '?';
  const U = getUpdates();
  if (!U || !U.updateId || U.isEmbeddedLaunch) return `${base} (osnovna)`;
  const d: Date | null = U.createdAt ? new Date(U.createdAt) : null;
  const when = d ? ` (${d.getDate()}.${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')})` : '';
  return `${base} · ${String(U.updateId).slice(0, 8)}${when}`;
}
