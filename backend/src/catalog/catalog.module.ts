import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category, Item, ItemVariant } from '../database/entities/index';
import { CategoriesService } from './categories.service';
import { ItemsService } from './items.service';
import { ItemVariantsService } from './item-variants.service';
import { ItemsController } from './items.controller';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Item, ItemVariant])],
  providers: [CategoriesService, ItemsService, ItemVariantsService],
  controllers: [ItemsController, CategoriesController],
  exports: [ItemsService],
})
export class CatalogModule {}
