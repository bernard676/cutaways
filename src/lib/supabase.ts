import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Set them in .env (see .env.example).'
  );
}

/**
 * expo-secure-store rejects values over ~2KB, but Supabase auth sessions can
 * exceed that. This is Supabase's documented pattern for Expo: the session
 * itself lives in AsyncStorage encrypted with an AES key that SecureStore holds.
 * https://supabase.com/docs/guides/auth/quickstarts/react-native
 */
class LargeSecureStore {
  private async getEncryptionKey(storeKey: string): Promise<Uint8Array> {
    const existing = await SecureStore.getItemAsync(storeKey);
    if (existing) {
      return aesjs.utils.hex.toBytes(existing);
    }
    const generated: string = aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(32)));
    await SecureStore.setItemAsync(storeKey, generated);
    return aesjs.utils.hex.toBytes(generated);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const keyStoreKey = `${key}-secret-key`;
    const encryptionKey = await this.getEncryptionKey(keyStoreKey);
    const [ivHex, dataHex] = encrypted.split(':');
    if (!ivHex || !dataHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(aesjs.utils.hex.toBytes(ivHex))
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(dataHex));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async setItem(key: string, value: string) {
    const keyStoreKey = `${key}-secret-key`;
    const encryptionKey = await this.getEncryptionKey(keyStoreKey);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    const ivHex = aesjs.utils.hex.fromBytes(iv);
    const dataHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    await AsyncStorage.setItem(key, `${ivHex}:${dataHex}`);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}-secret-key`);
  }
}

const options: SupabaseClientOptions<'public'> = {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, options);
