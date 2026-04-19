export interface SecretProvider {
  get(name: string): Promise<string>;
}

export class EnvSecretProvider implements SecretProvider {
  async get(name: string): Promise<string> {
    const v = process.env[name];
    if (v == null || v === '') throw new Error(`secret.not_found: ${name}`);
    return v;
  }
}
