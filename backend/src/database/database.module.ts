import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Business, Branch, User, UserBranch,
  Role, Permission, UserRole, RolePermission,
  Employee, OnboardingProgress, Setting,
} from './entities/index';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          Business, Branch, User, UserBranch,
          Role, Permission, UserRole, RolePermission,
          Employee, OnboardingProgress, Setting,
        ],
        migrations: [__dirname + '/migrations/*.ts'],
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
