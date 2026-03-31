import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Module({})
export class AuthModule implements OnModuleInit {
  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length) return; // already initialized

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:    this.config.get('FIREBASE_PROJECT_ID'),
        privateKey:   this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        clientEmail:  this.config.get('FIREBASE_CLIENT_EMAIL'),
      }),
    });

    console.log('Firebase Admin initialized');
  }
}
