/**
 * POST /api/auth/register
 * User registration endpoint for students and admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { RegisterSchema } from '@/lib/validators';
import { hashPassword, generateToken, setAuthCookie, UserRole } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  HTTP_STATUS,
  createResponse,
} from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = RegisterSchema.safeParse(body);
    if (!validation.success) {
      const [response, status] = validationErrorResponse(
        'Validation failed',
        validation.error.flatten()
      );
      return createResponse(response, status);
    }

    const { email, password } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const [response, status] = [
        errorResponse('USER_EXISTS', 'User with this email already exists'),
        HTTP_STATUS.CONFLICT,
      ];
      return createResponse(response, status);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Force role to strictly be 'student' for public signups
    const role = 'student';

    // Create user and profile in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password_hash: passwordHash,
          role,
        },
      });

      await tx.student.create({
        data: {
          user_id: newUser.id,
          profile_completed: false,
        },
      });

      return newUser;
    });

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
        'Registration successful'
      ),
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error('[Registration Error]', error);
    const [response, status] = [
      errorResponse(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Registration failed'
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
