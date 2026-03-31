import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { User } from '../database/entities/user.entity';
import { UserRole, UserBranch, RolePermission, Permission } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { InviteUserDto } from './dto/index';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)         private usersRepo: Repository<User>,
    @InjectRepository(UserRole)     private userRolesRepo: Repository<UserRole>,
    @InjectRepository(UserBranch)   private userBranchRepo: Repository<UserBranch>,
    @InjectRepository(RolePermission) private rolePermsRepo: Repository<RolePermission>,
    @InjectRepository(Permission)   private permsRepo: Repository<Permission>,
  ) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAllForBusiness(businessId: string): Promise<User[]> {
    return this.usersRepo.find({ where: { businessId, isActive: true } });
  }

  // Resolves all permission codes for a user in a given branch context
  async getPermissions(userId: string, branchId: string): Promise<string[]> {
    const userRoles = await this.userRolesRepo.find({
      where: [
        { userId, branchId },
        { userId, branchId: null as any },
      ],
    });
    if (!userRoles.length) return [];

    const roleIds = userRoles.map((ur) => ur.roleId);
    const rolePerms = await this.rolePermsRepo
      .createQueryBuilder('rp')
      .where('rp.roleId IN (:...roleIds)', { roleIds })
      .getMany();

    if (!rolePerms.length) return [];
    const permIds = rolePerms.map((rp) => rp.permissionId);

    const perms = await this.permsRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...permIds)', { permIds })
      .getMany();

    return perms.map((p) => p.code);
  }

  // Invite a new user to the business
  async invite(ctx: TenantContext, dto: InviteUserDto): Promise<{ inviteToken: string }> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email, businessId: ctx.businessId },
    });
    if (existing) throw new ConflictException('User with this email already exists');

    // Create a Firebase user (no password — they set it via email link)
    const firebaseUser = await admin.auth().createUser({
      email:    dto.email,
      disabled: false,
    });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const user = this.usersRepo.create({
      businessId:      ctx.businessId,
      firebaseUid:     firebaseUser.uid,
      email:           dto.email,
      displayName:     dto.displayName,
      createdBy:       ctx.userId,    // who sent the invite
      inviteStatus:    'pending',
      inviteToken,
      inviteExpiresAt,
    });
    await this.usersRepo.save(user);

    // Assign to branch
    await this.userBranchRepo.save(
      this.userBranchRepo.create({ userId: user.id, branchId: dto.branchId }),
    );

    // Assign role
    await this.userRolesRepo.save(
      this.userRolesRepo.create({
        userId:   user.id,
        roleId:   dto.roleId,
        branchId: dto.branchId,
      }),
    );

    // Send invite email via Firebase (password reset link works as an invite link)
    await admin.auth().generatePasswordResetLink(dto.email);

    return { inviteToken };
  }

  // Called when invited user accepts and sets their password
  async acceptInvite(token: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { inviteToken: token, inviteStatus: 'pending' },
    });
    if (!user) throw new BadRequestException('Invalid or expired invite token');
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    user.inviteStatus   = 'active';
    user.inviteToken    = null;
    user.inviteExpiresAt = null;
    return this.usersRepo.save(user);
  }

  async deactivate(ctx: TenantContext, userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({
      where: { id: userId, businessId: ctx.businessId },
    });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.usersRepo.save(user);
    await admin.auth().updateUser(user.firebaseUid, { disabled: true });
  }
}

  // Called by TenantContextInterceptor when no X-Branch-Id header is present
  async getDefaultBranchId(userId: string): Promise<string> {
    const userBranch = await this.userBranchRepo.findOne({
      where: { userId },
      order: { assignedAt: 'ASC' },
    });
    return userBranch?.branchId ?? '';
  }
