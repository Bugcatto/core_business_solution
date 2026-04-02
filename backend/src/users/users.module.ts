import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { UserRole, UserBranch, Branch } from '../database/entities/index';
import { Permission, RolePermission } from '../database/entities/index';
import { PosTerminal } from '../database/entities/index';
import { Business } from '../database/entities/business.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, UserBranch, Permission, RolePermission, PosTerminal, Branch, Business]),
    BusinessesModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
