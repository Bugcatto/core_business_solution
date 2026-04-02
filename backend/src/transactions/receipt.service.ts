import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionLine, Payment, Setting } from '../database/entities/index';
import { TransactionsService } from './transactions.service';
import { BusinessesService } from '../businesses/businesses.service';
import { BranchesService } from '../branches/branches.service';
import { TenantContext } from '../common/types/tenant-context.type';

export interface ReceiptData {
  header:       ReceiptHeader;
  lines:        ReceiptLine[];
  totals:       ReceiptTotals;
  payments:     ReceiptPayment[];
  footer:       string;
}

interface ReceiptHeader {
  businessName:   string;
  branchName:     string;
  transactionNumber: string;
  cashier:        string;
  date:           string;
  orderType:      string | null;
}

interface ReceiptLine {
  name:       string;
  variant:    string | null;
  qty:        number;
  unitPrice:  number;
  lineTotal:  number;
}

interface ReceiptTotals {
  subtotal:   number;
  discount:   number;
  tax:        number;
  total:      number;
}

interface ReceiptPayment {
  method:   string;
  amount:   number;
  change:   number | null;
}

@Injectable()
export class ReceiptService {
  constructor(
    private readonly txnService: TransactionsService,
    private readonly businessesService: BusinessesService,
    private readonly branchesService: BranchesService,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
  ) {}

  async getReceiptData(ctx: TenantContext, transactionId: string): Promise<ReceiptData> {
    const { lines, payments, ...txn } = await this.txnService.findOne(ctx, transactionId);

    const [footerSetting, business, branch] = await Promise.all([
      this.settingRepo.findOne({
        where: { businessId: ctx.businessId, key: 'receipt.footer' },
      }),
      this.businessesService.findById(ctx.businessId),
      this.branchesService.findOne(ctx, ctx.branchId),
    ]);

    return {
      header: {
        businessName:      business.name,
        branchName:        branch.name,
        transactionNumber: txn.transactionNumber,
        cashier:           ctx.userId,
        date:              txn.createdAt.toISOString(),
        orderType:         txn.orderType ?? null,
      },
      lines: lines.map((l: TransactionLine) => ({
        name:      l.itemNameSnapshot,
        variant:   l.variantNameSnapshot ?? null,
        qty:       Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
      totals: {
        subtotal: Number(txn.subtotal),
        discount: Number(txn.discountAmount),
        tax:      Number(txn.taxAmount),
        total:    Number(txn.totalAmount),
      },
      payments: payments.map((p: Payment) => ({
        method: p.paymentMethod,
        amount: Number(p.amount),
        change: p.changeAmount ? Number(p.changeAmount) : null,
      })),
      footer: footerSetting?.value ?? 'Thank you!',
    };
  }

  // Plain-text format for thermal printer (80mm roll)
  async getThermalText(ctx: TenantContext, transactionId: string): Promise<string> {
    const data = await this.getReceiptData(ctx, transactionId);
    const W = 42; // characters wide
    const line = (s: string) => s.padEnd(W).slice(0, W);
    const hr   = () => '-'.repeat(W);
    const col2 = (left: string, right: string) =>
      left.padEnd(W - right.length).slice(0, W - right.length) + right;

    const rows: string[] = [
      line(data.header.businessName.toUpperCase()),
      line(data.header.branchName),
      hr(),
      `TXN: ${data.header.transactionNumber}`,
      `Date: ${new Date(data.header.date).toLocaleString()}`,
      hr(),
    ];

    for (const l of data.lines) {
      rows.push(line(`${l.qty}x ${l.name}${l.variant ? ` (${l.variant})` : ''}`));
      rows.push(col2(`  @ ${l.unitPrice.toFixed(2)}`, l.lineTotal.toFixed(2)));
    }

    rows.push(
      hr(),
      col2('Subtotal',    data.totals.subtotal.toFixed(2)),
      ...(data.totals.discount > 0 ? [col2('Discount', `-${data.totals.discount.toFixed(2)}`)] : []),
      ...(data.totals.tax > 0      ? [col2('Tax',        data.totals.tax.toFixed(2))]          : []),
      col2('TOTAL',       data.totals.total.toFixed(2)),
      hr(),
      ...data.payments.map((p) =>
        col2(p.method.toUpperCase(), p.amount.toFixed(2)) +
        (p.change ? `\n${col2('Change', p.change.toFixed(2))}` : ''),
      ),
      hr(),
      data.footer,
    );

    return rows.join('\n');
  }
}
