// src/lib/env.ts
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  // Add as you go:
  // NEXTAUTH_URL: z.string().url().optional(),
  // NEXTAUTH_SECRET: z.string().min(32).optional(),
});

export const env = Env.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  // NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  // NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
});
