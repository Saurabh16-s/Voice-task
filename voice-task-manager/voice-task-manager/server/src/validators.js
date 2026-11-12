const { z } = require('zod');

const priority = z.enum(['low', 'medium', 'high']);
const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Must be a valid date');

const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: isoDate.nullable().optional(),
  priority: priority.optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    dueDate: isoDate.nullable(),
    priority,
    status: z.enum(['todo', 'done']),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');

module.exports = { registerSchema, loginSchema, createTaskSchema, updateTaskSchema };
