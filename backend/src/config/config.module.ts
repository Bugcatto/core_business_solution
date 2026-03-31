import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV:             z.enum(['development', 'production', 'test']).default('development'),
  PORT:                 z.string().default('3000'),
  DATABASE_URL:         z.string(),
  FIREBASE_PROJECT_ID:  z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
  FIREBASE_CLIENT_EMAIL:z.string(),
  ALLOWED_ORIGINS:      z.string().optional(),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = EnvSchema.safeParse(config);
        if (!result.success) {
          throw new Error(`Config validation error: ${result.error.message}`);
        }
        return result.data;
      },
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
