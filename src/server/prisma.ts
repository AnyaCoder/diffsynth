import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __qwen_ui_prisma__: PrismaClient | undefined;
}

const prisma = global.__qwen_ui_prisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__qwen_ui_prisma__ = prisma;
}

export default prisma;
