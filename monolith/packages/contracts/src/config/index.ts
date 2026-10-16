export interface AppConfigDto {
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  updatedAt: string;
}

export interface SetConfigRequestDto {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
}
