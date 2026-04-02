import { z } from 'zod';

export const CreateItemSchema = z.object({
  name:           z.string().min(1).max(200),
  description:    z.string().optional(),
  categoryId:     z.string().uuid().optional(),
  sku:            z.string().max(100).optional(),
  barcode:        z.string().max(100).optional(),
  itemType:       z.enum(['product', 'service', 'bundle', 'fee']).default('product'),
  price:          z.number().min(0),
  unit:           z.string().default('pcs'),
  trackInventory: z.boolean().default(true),
  imageUrl:       z.string().url().optional(),
});
export type CreateItemDto = z.infer<typeof CreateItemSchema>;

export const UpdateItemSchema = CreateItemSchema.partial();
export type UpdateItemDto = z.infer<typeof UpdateItemSchema>;

export const ItemQuerySchema = z.object({
  search:     z.string().optional(),
  categoryId: z.string().uuid().optional(),
  itemType:   z.enum(['product', 'service', 'bundle', 'fee']).optional(),
});
export type ItemQueryDto = z.infer<typeof ItemQuerySchema>;

export const CreateVariantSchema = z.object({
  name:          z.string().min(1).max(100),
  sku:           z.string().optional(),
  barcode:       z.string().optional(),
  priceOverride: z.number().min(0).optional(),
});
export type CreateVariantDto = z.infer<typeof CreateVariantSchema>;
