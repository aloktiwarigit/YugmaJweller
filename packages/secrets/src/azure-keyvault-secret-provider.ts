import type { SecretProvider } from './env-secret-provider';

export class AzureKeyVaultSecretProvider implements SecretProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(_name: string): Promise<string> {
    throw new Error('azure-keyvault-secret-provider.not_yet_deployed — see ADR-0015 infrastructure story');
  }
}
