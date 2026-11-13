export interface SsoHandoffCode {
  code: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  targetService: string;
  scope?: string;
  codeChallenge?: string;
  redirectUri?: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

