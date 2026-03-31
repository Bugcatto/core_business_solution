// ─── rbac.service.ts ──────────────────────────────────────────────────────────
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, Permission, UserRole, RolePermission } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';

export { Role, Permission };

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role)           private rolesRepo: Repository<Role>,
    @InjectRepository(Permission)     private permsRepo: Repository<Permission>,
    @InjectRepository(UserRole)       private userRolesRepo: Repository<UserRole>,
    @InjectRepository(RolePermission) private rolePermsRepo: Repository<RolePermission>,
  ) {}

  // Roles
  getRoles(ctx: TenantContext): Promise<Role[]> {
    return this.rolesRepo.find({ where: { businessId: ctx.businessId } });
  }

  async createRole(ctx: TenantContext, name: string, description?: string): Promise<Role> {
    const role = this.rolesRepo.create({
      businessId: ctx.businessId,
      name,
      description,
      isSystemRole: false,
    });
    return this.rolesRepo.save(role);
  }

  async deleteRole(ctx: TenantContext, roleId: string): Promise<void> {
    const role = await this.rolesRepo.findOne({
      where: { id: roleId, businessId: ctx.businessId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemRole) throw new BadRequestException('Cannot delete system roles');
    await this.rolesRepo.remove(role);
  }

  // Permissions
  getAllPermissions(): Promise<Permission[]> {
    return this.permsRepo.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  async getRolePermissions(ctx: TenantContext, roleId: string): Promise<string[]> {
    const role = await this.rolesRepo.findOne({
      where: { id: roleId, businessId: ctx.businessId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const rps = await this.rolePermsRepo.find({ where: { roleId } });
    const permIds = rps.map((rp) => rp.permissionId);
    if (!permIds.length) return [];

    const perms = await this.permsRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...permIds)', { permIds })
      .getMany();

    return perms.map((p) => p.code);
  }

  async setRolePermissions(
    ctx: TenantContext,
    roleId: string,
    permCodes: string[],
  ): Promise<void> {
    const role = await this.rolesRepo.findOne({
      where: { id: roleId, businessId: ctx.businessId },
    });
    if (!role) throw new NotFoundException('Role not found');

    // Remove existing permissions for this role
    await this.rolePermsRepo.delete({ roleId });

    if (!permCodes.length) return;

    const perms = await this.permsRepo
      .createQueryBuilder('p')
      .where('p.code IN (:...permCodes)', { permCodes })
      .getMany();

    const rolePerms = perms.map((p) =>
      this.rolePermsRepo.create({ roleId, permissionId: p.id }),
    );
    await this.rolePermsRepo.save(rolePerms);
  }

  // User role assignment
  async assignRole(
    ctx: TenantContext,
    userId: string,
    roleId: string,
    branchId?: string,
  ): Promise<void> {
    const existing = await this.userRolesRepo.findOne({
      where: { userId, roleId, branchId: branchId ?? null as any },
    });
    if (existing) return; // already assigned

    await this.userRolesRepo.save(
      this.userRolesRepo.create({ userId, roleId, branchId: branchId ?? null }),
    );
  }

  async revokeRole(ctx: TenantContext, userId: string, roleId: string): Promise<void> {
    await this.userRolesRepo.delete({ userId, roleId });
  }
}
