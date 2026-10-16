import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

class SafeSecureStorage {
  private memoryFallback: Map<string, string> = new Map();

  private isAvailable(): boolean {
    return Platform.OS !== 'web' && typeof SecureStore.setItemAsync === 'function';
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isAvailable()) {
        await SecureStore.setItemAsync(key, value);
      } else {
        this.memoryFallback.set(key, value);
      }
    } catch {
      this.memoryFallback.set(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      if (this.isAvailable()) {
        const value = await SecureStore.getItemAsync(key);
        return value ?? this.memoryFallback.get(key) ?? null;
      }
      return this.memoryFallback.get(key) ?? null;
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (this.isAvailable()) {
        await SecureStore.deleteItemAsync(key);
      }
      this.memoryFallback.delete(key);
    } catch {
      this.memoryFallback.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.memoryFallback.clear();
  }
}

export const secureStorage = new SafeSecureStorage();
