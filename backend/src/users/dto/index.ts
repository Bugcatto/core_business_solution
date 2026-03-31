import { z } from 'zod';

export const InviteUserSchema = z.object({
  email:       z.string().email(),
  displayName: z.string().min(2).max(80).optional(),
  roleId:      z.string().uuid(),
  branchId:    z.string().uuid(),
});
export type InviteUserDto = z.infer<typeof InviteUserSchema>;
