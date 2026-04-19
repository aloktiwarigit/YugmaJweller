import { describe, it, expect } from 'vitest';
import { AzureKeyVaultSecretProvider } from '../src/azure-keyvault-secret-provider';

describe('AzureKeyVaultSecretProvider', () => {
  it('throws not_yet_deployed for any key (ADR-0015 stub)', async () => {
    const p = new AzureKeyVaultSecretProvider();
    await expect(p.get('FIREBASE_SERVICE_ACCOUNT_JSON_B64')).rejects.toThrow(
      /azure-keyvault-secret-provider\.not_yet_deployed/,
    );
  });
});
