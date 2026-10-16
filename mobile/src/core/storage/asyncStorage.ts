import AsyncStorage from '@react-native-async-storage/async-storage';

class SafeAsyncStorage {
  private memoryFallback: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ?? this.memoryFallback.get(key) ?? null;
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      this.memoryFallback.set(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      this.memoryFallback.delete(key);
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch {
      this.memoryFallback.clear();
    }
  }
}

export const appStorage = new SafeAsyncStorage();
