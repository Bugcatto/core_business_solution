import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { User } from '../database/entities/user.entity';
import { UserRole, UserBranch, RolePermission, Permission, Branch } from '../database/entities/index';
import { Business } from '../database/entities/business.entity';
import { TenantContext } from '../common/types/tenant-context.type';
import { InviteUserDto, AcceptInviteDto } from './dto/index';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)         private usersRepo: Repository<User>,
    @InjectRepository(UserRole)     private userRolesRepo: Repository<UserRole>,
    @InjectRepository(UserBranch)   private userBranchRepo: Repository<UserBranch>,
    @InjectRepository(RolePermission) private rolePermsRepo: Repository<RolePermission>,
    @InjectRepository(Permission)   private permsRepo: Repository<Permission>,
    @InjectRepository(Branch)       private branchRepo: Repository<Branch>,
    @InjectRepository(Business)     private businessRepo: Repository<Business>,
  ) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Used by TenantMiddleware PATH A — finds the platform owner's User record
  // within a specific business (they may have User records in multiple businesses)
  async findByFirebaseUidAndBusiness(firebaseUid: string, businessId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { firebaseUid, businessId } });
    if (!user) throw new NotFoundException('User not found in this business');
    return user;
  }

  // Returns all staff for the business, including inactive (for reactivation UI)
  async findAllForBusiness(businessId: string): Promise<User[]> {
    return this.usersRepo.find({ where: { businessId } });
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

  // ── Invite ─────────────────────────────────────────────────────────────────
  async invite(ctx: TenantContext, dto: InviteUserDto): Promise<{ inviteToken: string }> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email, businessId: ctx.businessId },
    });
    if (existing) throw new ConflictException('User with this email already exists in this business');

    // Try to create a new Firebase account. If the email already exists globally
    // (staff from another business), reuse their existing Firebase UID instead.
    let firebaseUid: string;
    try {
      const fbUser = await admin.auth().createUser({ email: dto.email, disabled: false });
      firebaseUid = fbUser.uid;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-exists') {
        const fbUser = await admin.auth().getUserByEmail(dto.email);
        firebaseUid = fbUser.uid;
      } else {
        throw err;
      }
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const user = this.usersRepo.create({
      businessId:   ctx.businessId,
      firebaseUid,
      email:        dto.email,
      displayName:  dto.displayName,
      createdBy:    ctx.userId,
      inviteStatus: 'pending',
      inviteToken,
      inviteExpiresAt,
    });
    await this.usersRepo.save(user);

    await this.userBranchRepo.save(
      this.userBranchRepo.create({ userId: user.id, branchId: dto.branchId }),
    );

    await this.userRolesRepo.save(
      this.userRolesRepo.create({ userId: user.id, roleId: dto.roleId, branchId: dto.branchId }),
    );

    return { inviteToken };
  }

  // ── Accept invite: new user — sets password and activates account ──────────
  async acceptInvite(token: string, dto: AcceptInviteDto): Promise<{ email: string }> {
    const user = await this.usersRepo.findOne({
      where: { inviteToken: token, inviteStatus: 'pending' },
    });
    if (!user) throw new BadRequestException('Invalid or expired invite token');
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    // Set the password on the pre-created Firebase account
    await admin.auth().updateUser(user.firebaseUid, { password: dto.password, disabled: false });

    user.inviteStatus    = 'active';
    user.isActive        = true;
    user.inviteToken     = null;
    user.inviteExpiresAt = null;
    await this.usersRepo.save(user);

    return { email: user.email };
  }

  // ── Get invite preview: returns business+branch info for confirmation UI ───
  async getInvitePreview(token: string): Promise<{
    invitedEmail: string;
    businessName: string;
    branchName: string;
  }> {
    const user = await this.usersRepo.findOne({
      where: { inviteToken: token, inviteStatus: 'pending' },
    });
    if (!user) throw new BadRequestException('Invalid or expired invite token');

    const userBranch = await this.userBranchRepo.findOne({ where: { userId: user.id } });
    const branch = userBranch
      ? await this.branchRepo.findOne({ where: { id: userBranch.branchId } })
      : null;
    const business = await this.businessRepo.findOne({ where: { id: user.businessId } });

    return {
      invitedEmail: user.email,
      businessName: business?.name ?? 'Unknown Business',
      branchName:   branch?.name  ?? 'Unknown Branch',
    };
  }

  // ── Link invite: existing user — swaps Firebase UID on the pending invite ──
  // Called after the staff logs in with their existing credentials.
  // Returns the current + new business/branch for confirmation display.
  async linkInvite(token: string, currentFirebaseUid: string): Promise<{
    confirmed: boolean;
    currentBusinessName: string | null;
    currentBranchName:   string | null;
    newBusinessName:     string;
    newBranchName:       string;
  }> {
    const pendingUser = await this.usersRepo.findOne({
      where: { inviteToken: token, inviteStatus: 'pending' },
    });
    if (!pendingUser) throw new BadRequestException('Invalid or expired invite token');
    if (pendingUser.inviteExpiresAt && pendingUser.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    // Get new business + branch info
    const userBranch = await this.userBranchRepo.findOne({ where: { userId: pendingUser.id } });
    const newBranch  = userBranch
      ? await this.branchRepo.findOne({ where: { id: userBranch.branchId } })
      : null;
    const newBusiness = await this.businessRepo.findOne({ where: { id: pendingUser.businessId } });

    // Get current user's business + branch info (if any)
    const currentUser = await this.usersRepo.findOne({ where: { firebaseUid: currentFirebaseUid } });
    let currentBusinessName: string | null = null;
    let currentBranchName:   string | null = null;
    if (currentUser?.businessId) {
      const curBusiness = await this.businessRepo.findOne({ where: { id: currentUser.businessId } });
      currentBusinessName = curBusiness?.name ?? null;
      const curUserBranch = await this.userBranchRepo.findOne({ where: { userId: currentUser.id } });
      if (curUserBranch) {
        const curBranch = await this.branchRepo.findOne({ where: { id: curUserBranch.branchId } });
        currentBranchName = curBranch?.name ?? null;
      }
    }

    return {
      confirmed:           false,
      currentBusinessName,
      currentBranchName,
      newBusinessName:     newBusiness?.name ?? 'Unknown Business',
      newBranchName:       newBranch?.name   ?? 'Unknown Branch',
    };
  }

  // ── Confirm link: actually swaps the UID and activates the invite ──────────
  async confirmLinkInvite(token: string, currentFirebaseUid: string): Promise<{ email: string }> {
    const pendingUser = await this.usersRepo.findOne({
      where: { inviteToken: token, inviteStatus: 'pending' },
    });
    if (!pendingUser) throw new BadRequestException('Invalid or expired invite token');
    if (pendingUser.inviteExpiresAt && pendingUser.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    // Delete the placeholder Firebase account (was created with no password)
    try {
      await admin.auth().deleteUser(pendingUser.firebaseUid);
    } catch {
      // Already deleted or doesn't exist — safe to continue
    }

    // Swap the UID to the real logged-in user's UID
    pendingUser.firebaseUid  = currentFirebaseUid;
    pendingUser.inviteStatus = 'active';
    pendingUser.isActive     = true;
    pendingUser.inviteToken  = null;
    pendingUser.inviteExpiresAt = null;
    await this.usersRepo.save(pendingUser);

    return { email: pendingUser.email };
  }

  // ── Reactivate: full reset — new invite token, sessions revoked ───────────
  async reactivate(ctx: TenantContext, userId: string): Promise<{ inviteToken: string }> {
    const user = await this.usersRepo.findOne({
      where: { id: userId, businessId: ctx.businessId },
    });
    if (!user) throw new NotFoundException('User not found');

    const inviteToken    = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Revoke all existing Firebase sessions and re-enable the account
    await admin.auth().revokeRefreshTokens(user.firebaseUid);
    await admin.auth().updateUser(user.firebaseUid, { disabled: false });

    user.isActive        = true;
    user.inviteStatus    = 'pending';
    user.inviteToken     = inviteToken;
    user.inviteExpiresAt = inviteExpiresAt;
    await this.usersRepo.save(user);

    return { inviteToken };
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────
  async deactivate(ctx: TenantContext, userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({
      where: { id: userId, businessId: ctx.businessId },
    });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.usersRepo.save(user);
    await admin.auth().updateUser(user.firebaseUid, { disabled: true });
  }

  // ── Default branch lookup ──────────────────────────────────────────────────
  async getDefaultBranchId(userId: string): Promise<string> {
    const userBranch = await this.userBranchRepo.findOne({
      where: { userId },
      order: { assignedAt: 'ASC' },
    });
    return userBranch?.branchId ?? '';
  }
}
