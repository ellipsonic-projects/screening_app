import { NextResponse } from 'next/server';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

export function successResponse(data: any, message?: string) {
  return {
    success: true,
    message: message || 'Success',
    data,
  };
}

export function errorResponse(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

export function validationErrorResponse(message: string, errors: any): [any, number] {
  return [
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: errors,
      },
    },
    HTTP_STATUS.BAD_REQUEST,
  ];
}

export function createResponse(body: any, status: number) {
  return NextResponse.json(body, { status });
}
