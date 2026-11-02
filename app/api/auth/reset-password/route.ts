import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyToken } from '@/lib/auth';
import { getCachedOTP, clearCachedOTP } from '@/lib/otp';
import prisma from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  createResponse,
} from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword, otp } = body;

    // Admin reset password flow (requires valid token)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = verifyToken(token);
      if (decoded && (decoded.role === 'admin' || decoded.role === 'super_admin')) {
        const passwordHash = await hashPassword(newPassword);
        await prisma.user.update({
          where: { id: decoded.userId },
          data: { password_hash: passwordHash },
        });
        return createResponse(
          successResponse(null, 'Admin password reset successfully'),
          HTTP_STATUS.OK
        );
      }
    }

    // Student Forgot Password flow (requires email and OTP)
    if (!email || !newPassword || !otp) {
      return createResponse(
        errorResponse('BAD_REQUEST', 'Email, OTP, and new password are required'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // OTP validation
    const validOtp = getCachedOTP(email);
    
    if (!validOtp || validOtp !== otp) {
      return createResponse(
        errorResponse('INVALID_OTP', 'Invalid or expired OTP provided'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!existingUser) {
      return createResponse(
        errorResponse('NOT_FOUND', 'User not found'),
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Hash the new password and update the database
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password_hash: passwordHash },
    });

    // Clear OTP after successful reset
    clearCachedOTP(email);

    return createResponse(
      successResponse(null, 'Password reset successfully'),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('[Reset Password Error]', error);
    return createResponse(
      errorResponse('INTERNAL_ERROR', 'Failed to reset password'),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
