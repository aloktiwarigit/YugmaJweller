export interface ImpersonationSessionPort {
  /** Returns true if the session is active (not ended, not expired). */
  isActive(sessionId: string): Promise<boolean>;
}
