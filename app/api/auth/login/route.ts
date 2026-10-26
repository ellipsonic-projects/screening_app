/**
 * POST /api/auth/login
 * User login endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoginSchema } from '@/lib/validators';
import { comparePassword, generateToken, setAuthCookie, UserRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  HTTP_STATUS,
  createResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = LoginSchema.safeParse(body);
    if (!validation.success) {
      const [response, status] = validationErrorResponse(
        'Validation failed',
        validation.error.flatten()
      );
      return createResponse(response, status);
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, password_hash: true, role: true, is_active: true }
    });

    if (!user) {
      console.warn(`[Auth Login] User not found for email: ${normalizedEmail}`);
      const [response, status] = [
        errorResponse('INVALID_CREDENTIALS', 'Invalid email or password'),
        HTTP_STATUS.UNAUTHORIZED,
      ];
      return createResponse(response, status);
    }

    if (!user.is_active) {
      console.warn(`[Auth Login] User account is deactivated: ${user.id} (${normalizedEmail})`);
      const [response, status] = [
        errorResponse('INVALID_CREDENTIALS', 'Invalid email or password'),
        HTTP_STATUS.UNAUTHORIZED,
      ];
      return createResponse(response, status);
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      console.warn(`[Auth Login] Invalid password attempt for user: ${user.id} (${normalizedEmail})`);
      const [response, status] = [
        errorResponse('INVALID_CREDENTIALS', 'Invalid email or password'),
        HTTP_STATUS.UNAUTHORIZED,
      ];
      return createResponse(response, status);
    }

    console.log(`[Auth Login] Successful login for user: ${user.id} (${normalizedEmail}), role: ${user.role}`);

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    // Set auth cookie
    await setAuthCookie(token);

    return createResponse(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          token,
        },
        'Login successful'
      ),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('[Login Error]', error);
    const [response, status] = [
      errorResponse(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Login failed'
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ];
    return createResponse(response, status);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
