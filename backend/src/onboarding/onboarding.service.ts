import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Business, BusinessType, SubscriptionPlan } from '../database/entities/index';
import { Branch, UserBranch, Role, UserRole } from '../database/entities/index';
import { User } from '../database/entities/index';
import { OnboardingProgress, OnboardingStep, Setting } from '../database/entities/index';
import { PosTerminal } from '../database/entities/index';
import { RbacSeeder } from '../rbac/rbac.seeder';
import { BusinessesService } from '../businesses/businesses.service';
import { PlatformService } from '../platform/platform.service';
import { CreateBusinessDto } from '../businesses/dto/index';

// Default settings provisioned for every new business
const DEFAULT_SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'receipt.show_logo',       value: 'true' },
  { key: 'receipt.footer',          value: 'Thank you for your business!' },
  { key: 'pos.require_customer',    value: 'false' },
  { key: 'pos.allow_discount',      value: 'true' },
  { key: 'tax.enabled',             value: 'false' },
  { key: 'tax.rate',                value: '0' },
  { key: 'inventory.track',         value: 'true' },
  { key: 'inventory.allow_negative',value: 'false' },
];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rbacSeeder: RbacSeeder,
    private readonly businessesService: BusinessesService,
    private readonly platformService: PlatformService,
    @InjectRepository(OnboardingProgress)
    private readonly progressRepo: Repository<OnboardingProgress>,
  ) {}

  // ── Step 1+2: Create business + owner user ──────────────────────────────────
  async createBusiness(firebaseUid: string, dto: CreateBusinessDto) {
    try {
      // Ensure a PlatformOwner record exists for this Firebase account.
      // Idempotent — safe to call on every onboarding attempt.
      const platformOwner = await this.platformService.findOrCreate(
        firebaseUid,
        dto.email,
        dto.displayName,
      );

      return await this.dataSource.transaction(async (em) => {
        const slug = await this.businessesService.generateSlug(dto.name);

        const business = em.getRepository(Business).create({
          name:             dto.name,
          slug,
          businessType:     dto.businessType,
          defaultLanguage:  dto.language ?? 'en',
          country:          dto.country,
          currency:         dto.currency,
          subscriptionPlan: 'free' as SubscriptionPlan,
          status:           'onboarding',
          platformOwnerId:  platformOwner.id,
        });
        await em.save(business);

        const user = em.getRepository(User).create({
          businessId:   business.id,
          firebaseUid,
          email:        dto.email,
          createdBy:    null,        // self-registered
          inviteStatus: 'active',
          isActive:     true,
        });
        await em.save(user);

        // Link owner to business
        business.ownerUserId = user.id;
        await em.save(business);

        // Init onboarding progress tracker
        await em.save(em.getRepository(OnboardingProgress).create({
          businessId:  business.id,
          currentStep: 'business_created' as OnboardingStep,
        }));

        return { businessId: business.id, userId: user.id };
      });
    } catch (err: any) {
      // Re-throw NestJS HttpExceptions as-is
      if (err?.status) throw err;
      throw new InternalServerErrorException('Failed to create business. Please try again.');
    }
  }

  // ── Step 3: Select business type ────────────────────────────────────────────
  async selectType(businessId: string, businessType: BusinessType) {
    await this.dataSource.manager.update(Business, { id: businessId }, { businessType });
    await this.progressRepo.update({ businessId }, { currentStep: 'type_selected' });
    return { businessType };
  }

  // ── Step 4: Select plan ─────────────────────────────────────────────────────
  async selectPlan(businessId: string, plan: SubscriptionPlan) {
    await this.dataSource.manager.update(Business, { id: businessId }, { subscriptionPlan: plan });
    await this.progressRepo.update({ businessId }, { currentStep: 'plan_selected' });
    return { plan };
  }

  // ── Step 5: Provision (fully automatic) ─────────────────────────────────────
  async provision(businessId: string) {
    const progress = await this.progressRepo.findOne({ where: { businessId } });
    if (progress?.currentStep === 'provisioned' ||
        progress?.currentStep === 'wizard_complete' ||
        progress?.currentStep === 'live') {
      return { alreadyProvisioned: true }; // idempotent guard
    }

    return this.dataSource.transaction(async (em) => {
      const business = await em.findOne(Business, { where: { id: businessId } });
      if (!business) throw new NotFoundException(`Business ${businessId} not found`);

      // 1. Default branch
      const branch = await em.save(em.getRepository(Branch).create({
        businessId: business.id,
        name:       'Main Branch',
        timezone:   'UTC',
        isActive:   true,
      }));

      // 2. Seed roles + permissions for this business
      await this.rbacSeeder.seedForBusiness(em, business.id);

      // 3. Assign owner → Owner role → default branch
      const ownerRole = await em.findOne(Role, {
        where: { businessId: business.id, name: 'Owner' },
      });
      if (!ownerRole) throw new InternalServerErrorException('Owner role not seeded — provisioning failed');

      await em.save(em.getRepository(UserRole).create({
        userId:   business.ownerUserId,
        roleId:   ownerRole.id,
        branchId: branch.id,
      }));

      await em.save(em.getRepository(UserBranch).create({
        userId:   business.ownerUserId,
        branchId: branch.id,
      }));

      // 3b. Default POS terminal for the branch
      const terminal = await em.save(em.getRepository(PosTerminal).create({
        businessId: business.id,
        branchId:   branch.id,
        name:       'Terminal 1',
      }));

      // 4. Default settings
      const settings = DEFAULT_SETTINGS.map((s) =>
        em.getRepository(Setting).create({ businessId: business.id, branchId: null, ...s }),
      );
      await em.save(settings);

      // 5. Activate business
      business.status = 'active';
      await em.save(business);

      // 6. Advance onboarding step
      await em.update(OnboardingProgress, { businessId }, { currentStep: 'provisioned' });

      return { provisioned: true, defaultBranchId: branch.id, defaultTerminalId: terminal.id };
    });
  }

  // ── Wizard: mark individual checklist steps ──────────────────────────────────
  async markWizardStep(
    businessId: string,
    step: keyof Pick<OnboardingProgress,
      | 'hasAddedItems'
      | 'hasAddedStaff'
      | 'hasConfiguredReceipt'
      | 'hasSetBranchDetails'
      | 'hasAddedOpeningStock'
      | 'hasTestedTransaction'
    >,
  ) {
    const validSteps = [
      'hasAddedItems', 'hasAddedStaff', 'hasConfiguredReceipt',
      'hasSetBranchDetails', 'hasAddedOpeningStock', 'hasTestedTransaction',
    ];
    if (!validSteps.includes(step)) throw new BadRequestException('Invalid wizard step');

    await this.progressRepo.update({ businessId }, { [step]: true });

    // Auto-advance wizard_complete when enough steps are done
    const progress = await this.progressRepo.findOne({ where: { businessId } });
    if (progress) {
      const wizardDone = progress.hasAddedItems;
      if (wizardDone && progress.currentStep === 'provisioned') {
        await this.progressRepo.update({ businessId }, { currentStep: 'wizard_complete' });
      }
      // Go-live requires items + a tested transaction
      const goLiveReady = progress.hasAddedItems && progress.hasTestedTransaction;
      if (goLiveReady && progress.currentStep !== 'live') {
        await this.progressRepo.update({ businessId }, { currentStep: 'live' });
      }
    }

    return this.getStatus(businessId);
  }

  // ── Save draft (partial form state on drop-off) ──────────────────────────────
  async saveDraft(businessId: string, metadata: Record<string, any>) {
    await this.progressRepo.update({ businessId }, { metadata });
    return { saved: true };
  }

  // ── Get current onboarding status (used by frontend to resume) ───────────────
  async getStatus(businessId: string) {
    const progress = await this.progressRepo.findOne({ where: { businessId } });
    if (!progress) throw new NotFoundException('Onboarding record not found');

    const checklist = {
      hasAddedItems:         progress.hasAddedItems,
      hasAddedStaff:         progress.hasAddedStaff,
      hasConfiguredReceipt:  progress.hasConfiguredReceipt,
      hasSetBranchDetails:   progress.hasSetBranchDetails,
      hasAddedOpeningStock:  progress.hasAddedOpeningStock,
      hasTestedTransaction:  progress.hasTestedTransaction,
    };

    const completedCount = Object.values(checklist).filter(Boolean).length;

    return {
      currentStep:       progress.currentStep,
      checklist,
      completionPercent: Math.round((completedCount / 6) * 100),
      metadata:          progress.metadata,
      isLive:            progress.currentStep === 'live',
    };
  }
}
