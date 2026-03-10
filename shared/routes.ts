
import { z } from 'zod';
import { insertProgressSchema } from './schema';

export const api = {
  levels: {
    list: {
      method: 'GET' as const,
      path: '/api/levels',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          isLocked: z.boolean(),
          isCompleted: z.boolean(),
          hintsUsed: z.boolean(),
        })),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/levels/:id',
      responses: {
        200: z.object({
          id: z.number(),
          gridSize: z.number(),
          start: z.object({ x: z.number(), y: z.number() }),
          nodes: z.array(z.object({ x: z.number(), y: z.number() })),
        }),
        404: z.object({ message: z.string() }),
      },
    },
    solution: {
      method: 'GET' as const,
      path: '/api/levels/:id/solution',
      responses: {
        200: z.object({
          path: z.array(z.object({ x: z.number(), y: z.number() })),
        }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  progress: {
    sync: {
      method: 'POST' as const,
      path: '/api/progress',
      input: z.object({
        userId: z.string(),
        levelId: z.number(),
        completed: z.boolean(),
        hintsUsed: z.boolean(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/progress/:userId',
      responses: {
        200: z.object({
          completedLevels: z.array(z.number()),
        }),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
