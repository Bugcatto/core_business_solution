import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Inventory, InventoryMovement,
  InventoryAdjustment, InventoryTransfer,
  Item, ItemVariant,
} from '../database/entities/index';
import { InventoryService } from './inventory.service';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { InventoryTransfersService } from './inventory-transfers.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inventory, InventoryMovement,
      InventoryAdjustment, InventoryTransfer,
      Item, ItemVariant,
    ]),
  ],
  providers: [
    InventoryService,
    InventoryMovementsService,
    InventoryAdjustmentsService,
    InventoryTransfersService,
  ],
  controllers: [InventoryController],
  exports: [InventoryService, InventoryMovementsService],
})
export class InventoryModule {}
