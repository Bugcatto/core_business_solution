import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { UpdateBusinessDto } from './dto/index';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly repo: Repository<Business>,
  ) {}

  async findById(id: string): Promise<Business> {
    const business = await this.repo.findOne({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async update(ctx: TenantContext, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.findById(ctx.businessId);
    Object.assign(business, dto);
    return this.repo.save(business);
  }

  async generateSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = base;
    let attempt = 0;

    while (await this.repo.findOne({ where: { slug } })) {
      attempt++;
      slug = `${base}-${attempt}`;
    }

    return slug;
  }
}
