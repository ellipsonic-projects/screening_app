import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, HTTP_STATUS, createResponse } from '@/lib/api-response';
import { setCachedOTP, clearCachedOTP } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return createResponse(errorResponse('BAD_REQUEST', 'Email is required'), HTTP_STATUS.BAD_REQUEST);
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return createResponse(errorResponse('NOT_FOUND', 'User with this email not found'), HTTP_STATUS.NOT_FOUND);
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in memory (expires in 10 minutes)
    setCachedOTP(email, otp);

    try {
      // Initialize SMTP Transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASSWORD || '',
        },
      });

      // Verify connection configuration
      await transporter.verify();

      // Professional HTML Email Template
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e3a8a; margin-bottom: 20px;">Assessment Portal - Password Reset</h2>
          <p style="color: #334155; font-size: 16px;">Hello,</p>
          <p style="color: #334155; font-size: 16px;">We received a request to reset the password for your account.</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; margin: 25px 0;">
            <p style="color: #64748b; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; font-weight: bold;">Your One-Time Password (OTP)</p>
            <h1 style="color: #0f172a; font-size: 32px; letter-spacing: 4px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #334155; font-size: 16px;">This OTP is valid for <strong>10 minutes</strong>.</p>
          <p style="color: #dc2626; font-size: 14px; margin-top: 20px;"><strong>Security Notice:</strong> Please do not share this OTP with anyone. If you did not request this password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated message from the Assessment Portal. Please do not reply.</p>
        </div>
      `;

      // Await email sending properly
      await transporter.sendMail({
        from: `"Assessment Portal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset Request - Assessment Portal",
        text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes. If you did not request this, please ignore this email.`,
        html: emailHtml,
      });

      return createResponse(successResponse(null, 'OTP sent successfully to your email address.'), HTTP_STATUS.OK);
      
    } catch (emailError: any) {
      console.error('[Primary SMTP Error]', emailError);
      
      // Clear the cached OTP since the email failed to send
      clearCachedOTP(email);

      return createResponse(
        errorResponse('INTERNAL_ERROR', 'Failed to deliver OTP email: ' + (emailError.message || 'Unknown error')), 
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  } catch (error: any) {
    console.error('[OTP Global Error]', error);
    return createResponse(errorResponse('INTERNAL_ERROR', 'Failed to process request.'), HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
