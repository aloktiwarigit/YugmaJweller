import { describe, it, expect } from 'vitest';
import { EnvSecretProvider, AzureKeyVaultSecretProvider } from '../src';

describe('@goldsmith/secrets exports', () => {
  it('re-exports both providers', () => {
    expect(typeof EnvSecretProvider).toBe('function');
    expect(typeof AzureKeyVaultSecretProvider).toBe('function');
  });
});
