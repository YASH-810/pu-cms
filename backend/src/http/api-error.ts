export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR';

export interface ApiErrorDetail {
  code: ApiErrorCode | string;
  message: string;
  field?: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  public constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details?: unknown): ApiError =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export const unauthenticated = (message = 'Authentication is required', details?: unknown): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', message, details);

export const forbidden = (message = 'You do not have permission to perform this action', details?: unknown): ApiError =>
  new ApiError(403, 'FORBIDDEN', message, details);

export const notFound = (message = 'Resource not found', details?: unknown): ApiError =>
  new ApiError(404, 'NOT_FOUND', message, details);

export const conflict = (message = 'Resource conflict', details?: unknown): ApiError =>
  new ApiError(409, 'CONFLICT', message, details);
