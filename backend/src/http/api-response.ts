import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, type ApiErrorDetail } from './api-error.js';

export interface ApiResponse<TData = unknown, TMeta = Record<string, unknown>> {
  success: boolean;
  data: TData;
  meta: TMeta;
  errors: ApiErrorDetail[];
}

const defaultMeta = (): Record<string, unknown> => ({});

export function ok<TData, TMeta = Record<string, unknown>>(
  data: TData,
  meta?: TMeta
): ApiResponse<TData, TMeta | Record<string, unknown>> {
  return {
    success: true,
    data,
    meta: meta ?? defaultMeta(),
    errors: []
  };
}

export function fail(
  errors: ApiErrorDetail[],
  meta: Record<string, unknown> = {}
): ApiResponse<Record<string, never>, Record<string, unknown>> {
  return {
    success: false,
    data: {},
    meta,
    errors
  };
}

function isApiResponse(payload: unknown): payload is ApiResponse {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<ApiResponse>;
  return (
    typeof candidate.success === 'boolean' &&
    'data' in candidate &&
    'meta' in candidate &&
    Array.isArray(candidate.errors)
  );
}

function normalizeData(payload: unknown): unknown {
  if (payload === undefined || payload === null) {
    return {};
  }

  return payload;
}

export async function registerApiResponseFormatter(app: FastifyInstance): Promise<void> {
  app.addHook('preSerialization', async (_request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    if (reply.statusCode === 204) {
      reply.code(200);
    }

    if (isApiResponse(payload)) {
      return payload;
    }

    return ok(normalizeData(payload));
  });
}

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send(
      fail([
        {
          code: 'NOT_FOUND',
          message: 'Route not found'
        }
      ])
    );
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.server.log.error(error);
    if (error.validation) {
      return reply.code(400).send(
        fail([
          {
            code: 'BAD_REQUEST',
            message: 'Request validation failed',
            details: error.validation
          }
        ])
      );
    }

    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(
        fail([
          {
            code: error.code,
            message: error.message,
            details: error.details
          }
        ])
      );
    }

    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    const mappedStatusCode = [400, 401, 403, 404, 409].includes(statusCode) ? statusCode : 500;
    const codeByStatus: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      500: 'INTERNAL_SERVER_ERROR'
    };

    return reply.code(mappedStatusCode).send(
      fail([
        {
          code: codeByStatus[mappedStatusCode],
          message: mappedStatusCode === 500 ? 'Internal server error' : error.message
        }
      ])
    );
  });
}
