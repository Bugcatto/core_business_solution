import { z } from 'zod';

export const CreatePosTerminalSchema = z.object({
  name:     z.string().min(1).max(100),
  branchId: z.string().uuid(),
});

export type CreatePosTerminalDto = z.infer<typeof CreatePosTerminalSchema>;
