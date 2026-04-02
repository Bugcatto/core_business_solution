import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformOwner } from '../database/entities/platform-owner.entity';
import { Business } from '../database/entities/business.entity';

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(PlatformOwner)
    private ownerRepo: Repository<PlatformOwner>,
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {}

  // Find or create a PlatformOwner for a given Firebase UID.
  // Called during onboarding and by TenantMiddleware.
  async findOrCreate(firebaseUid: string, email: string, displayName?: string): Promise<PlatformOwner> {
    const existing = await this.ownerRepo.findOne({ where: { firebaseUid } });
    if (existing) return existing;

    const owner = this.ownerRepo.create({ firebaseUid, email, displayName });
    return this.ownerRepo.save(owner);
  }

  async findByFirebaseUid(firebaseUid: string): Promise<PlatformOwner | null> {
    return this.ownerRepo.findOne({ where: { firebaseUid } }) ?? null;
  }

  async findById(id: string): Promise<PlatformOwner> {
    const owner = await this.ownerRepo.findOne({ where: { id } });
    if (!owner) throw new NotFoundException('Platform owner not found');
    return owner;
  }

  // Returns all businesses owned by this platform owner
  async getBusinesses(platformOwnerId: string): Promise<Business[]> {
    return this.businessRepo.find({
      where: { platformOwnerId },
      order: { createdAt: 'ASC' },
    });
  }

  // Returns the first active (or onboarding) business for this owner — used as default
  async getDefaultBusiness(platformOwnerId: string): Promise<Business | null> {
    const business = await this.businessRepo.findOne({
      where: [
        { platformOwnerId, status: 'active' },
        { platformOwnerId, status: 'onboarding' },
      ],
      order: { createdAt: 'ASC' },
    });
    return business ?? null;
  }

  // Full platform owner profile + business list — response for GET /platform/me
  async getProfile(firebaseUid: string) {
    const owner = await this.ownerRepo.findOne({ where: { firebaseUid } });
    if (!owner) throw new NotFoundException('Platform owner not found');

    const businesses = await this.getBusinesses(owner.id);

    return {
      platformOwnerId: owner.id,
      email:           owner.email,
      displayName:     owner.displayName,
      businesses:      businesses.map((b) => ({
        id:               b.id,
        name:             b.name,
        businessType:     b.businessType,
        status:           b.status,
        subscriptionPlan: b.subscriptionPlan,
      })),
    };
  }
}
