type ConfirmationLike = {
  confirm: (code: string) => Promise<{ user?: { getIdToken: () => Promise<string> } } | null>;
};

export async function verifyOtp(confirmation: ConfirmationLike, code: string): Promise<{ idToken: string }> {
  const cred = await confirmation.confirm(code);
  if (!cred || !cred.user) throw new Error('auth-client.verify_failed');
  const idToken = await cred.user.getIdToken();
  return { idToken };
}
