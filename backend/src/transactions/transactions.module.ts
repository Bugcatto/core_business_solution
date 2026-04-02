import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Transaction, TransactionLine, Payment,
  Item, ItemVariant, Inventory, InventoryMovement, PosTerminal, Setting,
} from '../database/entities/index';
import { CatalogModule } from '../catalog/catalog.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { BranchesModule } from '../branches/branches.module';
import { CheckoutService } from './checkout.service';
import { TransactionsService } from './transactions.service';
import { PaymentsService } from './payments.service';
import { ReceiptService } from './receipt.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction, TransactionLine, Payment,
      Item, ItemVariant, Inventory, InventoryMovement, PosTerminal, Setting,
    ]),
    CatalogModule,
    BusinessesModule,
    BranchesModule,
  ],
  providers: [CheckoutService, TransactionsService, PaymentsService, ReceiptService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
