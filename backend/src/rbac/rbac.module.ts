import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, Permission, UserRole, RolePermission } from '../database/entities/index';
import { RbacSeeder } from './rbac.seeder';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, UserRole, RolePermission])],
  providers: [RbacSeeder, RbacService],
  controllers: [RbacController],
  exports: [RbacSeeder, RbacService],
})
export class RbacModule {}
