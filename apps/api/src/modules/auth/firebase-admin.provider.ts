import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EnvSecretProvider, type SecretProvider } from '@goldsmith/secrets';
import admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FirebaseAdminProvider.name);
  private app?: admin.app.App;

  constructor(private readonly secrets: SecretProvider = new EnvSecretProvider()) {}

  async onModuleInit(): Promise<void> {
    // When running against the Firebase Auth emulator, FIREBASE_AUTH_EMULATOR_HOST is set
    // and the Admin SDK talks to the emulator without real credentials. Still call
    // initializeApp() so this.app is populated; use application default creds with projectId.
    const projectId = await this.secrets.get('FIREBASE_PROJECT_ID');
    if (process.env['FIREBASE_AUTH_EMULATOR_HOST']) {
      this.app = admin.initializeApp({ projectId }, `goldsmith-${process.pid}`);
      this.logger.log('Firebase Admin initialized against emulator');
      return;
    }
    const b64 = await this.secrets.get('FIREBASE_SERVICE_ACCOUNT_JSON_B64');
    const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as object;
    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId,
    }, `goldsmith-${process.pid}`);
    this.logger.log('Firebase Admin initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.app) await this.app.delete();
  }

  admin(): admin.app.App {
    if (!this.app) throw new Error('firebase-admin.not_initialized');
    return this.app;
  }
}
