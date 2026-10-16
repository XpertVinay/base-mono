import { secureStorage, appStorage, StorageKeys } from '../storage';
import { AuthUser, SessionTokens } from './types';

export class SessionManager {
  public static async saveSession(user: AuthUser, tokens: SessionTokens): Promise<void> {
    await Promise.all([
      secureStorage.setItem(StorageKeys.ACCESS_TOKEN, tokens.accessToken),
      secureStorage.setItem(StorageKeys.REFRESH_TOKEN, tokens.refreshToken),
      appStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(user)),
    ]);
  }

  public static async getAccessToken(): Promise<string | null> {
    return secureStorage.getItem(StorageKeys.ACCESS_TOKEN);
  }

  public static async getRefreshToken(): Promise<string | null> {
    return secureStorage.getItem(StorageKeys.REFRESH_TOKEN);
  }

  public static async getSavedUser(): Promise<AuthUser | null> {
    const raw = await appStorage.getItem(StorageKeys.USER_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  public static async clearSession(): Promise<void> {
    await Promise.all([
      secureStorage.removeItem(StorageKeys.ACCESS_TOKEN),
      secureStorage.removeItem(StorageKeys.REFRESH_TOKEN),
      appStorage.removeItem(StorageKeys.USER_DATA),
    ]);
  }
}
