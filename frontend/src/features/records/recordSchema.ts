import { z } from 'zod';

export const entityRecordSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  category: z.string().min(2, 'Category is required'),
  amount: z.coerce.number().min(0, 'Amount must be non-negative'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['active', 'pending', 'completed', 'archived']),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().default(''),
});

export type EntityRecordFormData = z.infer<typeof entityRecordSchema>;
