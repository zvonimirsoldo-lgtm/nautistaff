import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// U Expo Go (razvojni način) push obavijesti na Androidu ne rade, pa ih tamo preskačemo.
// U pravoj instaliranoj aplikaciji (APK) rade normalno.
const IN_EXPO_GO = Constants.executionEnvironment === 'storeClient';

let currentToken: string | null = null;
let handlerSet = false;

export async function registerForPush(): Promise<void> {
  if (IN_EXPO_GO) return;
  try {
    // učitavamo tek ovdje, da Expo Go ne prijavljuje upozorenja
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device');
    if (!Device.isDevice) return;

    if (!handlerSet) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
          shouldPlaySound: true, shouldSetBadge: false,
        }),
      });
      handlerSet = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Ponude i prijave',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('Push: nedostaje EAS projectId (pokrenite "eas init").');
      return;
    }
    const token: string = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    currentToken = token;
    await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  } catch (e) {
    console.log('Push obavijesti nisu uključene:', e);
  }
}

// Odjava: maknemo token da ovaj mobitel više ne prima obavijesti za taj račun
export async function logout(): Promise<void> {
  try {
    if (currentToken) await supabase.from('push_tokens').delete().eq('token', currentToken);
  } catch {
    // nije presudno
  }
  currentToken = null;
  await supabase.auth.signOut();
}
