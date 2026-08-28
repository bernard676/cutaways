// AsyncStorage has no native module under Jest; use the library's official in-memory mock.
// Pulled in transitively by src/lib/supabase.ts (and the settings/theme stores).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// expo-secure-store's native module is likewise absent; a tiny in-memory stand-in is enough
// for the code paths under test.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});
