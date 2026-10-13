import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { StudentProfileSchema } from '@/lib/validators';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const PatchStudentProfileSchema = StudentProfileSchema.partial();

/**
 * POST /api/students/profile
 * Create or update student profile
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    // Verify user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, is_active: true }
    });

    if (!user || !user.is_active || String(user.role).toLowerCase() !== 'student') {
      return NextResponse.json(
        { message: 'User account not found or unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const validatedData = StudentProfileSchema.parse(data);

    // Check USN Uniqueness against other students
    const existingStudent = await prisma.student.findUnique({
      where: { usn: validatedData.usn }
    });
    
    if (existingStudent && existingStudent.user_id !== user.id) {
      return NextResponse.json({ message: 'This USN is already registered.' }, { status: 400 });
    }

    // Upsert student record exclusively for the authenticated user
    const student = await prisma.student.upsert({
      where: { user_id: user.id },
      update: {
        full_name: validatedData.fullName,
        phone: validatedData.phone,
        college: validatedData.college,
        usn: validatedData.usn,
        branch_name: validatedData.branchName,
        camera_permission: validatedData.cameraPermission,
        microphone_permission: validatedData.microphonePermission,
        profile_completed: true,
      },
      create: {
        user_id: user.id,
        full_name: validatedData.fullName,
        phone: validatedData.phone,
        college: validatedData.college,
        usn: validatedData.usn,
        branch_name: validatedData.branchName,
        camera_permission: validatedData.cameraPermission,
        microphone_permission: validatedData.microphonePermission,
        profile_completed: true,
      }
    });

    return NextResponse.json({
      message: 'Profile updated successfully',
      student,
    });
  } catch (error: any) {
    console.error('[Student Profile Error]', error);
    if (error instanceof z.ZodError || error.name === 'ZodError') {
      const firstIssue = error.issues?.[0] || error.errors?.[0];
      return NextResponse.json(
        { message: firstIssue?.message || 'Validation failed' },
        { status: 400 }
      );
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { message: 'This USN is already registered.' },
        { status: 409 }
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Student record not found.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: 'Failed to update profile. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/students/profile
 * Update specific fields of student profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    // Verify user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, is_active: true }
    });

    if (!user || !user.is_active || String(user.role).toLowerCase() !== 'student') {
      return NextResponse.json(
        { message: 'User account not found or unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const validatedData = PatchStudentProfileSchema.parse(data);

    // If USN is being updated, check uniqueness
    if (validatedData.usn) {
      const existingStudent = await prisma.student.findUnique({
        where: { usn: validatedData.usn }
      });
      if (existingStudent && existingStudent.user_id !== user.id) {
        return NextResponse.json({ message: 'This USN is already registered.' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (validatedData.fullName !== undefined) updateData.full_name = validatedData.fullName;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.college !== undefined) updateData.college = validatedData.college;
    if (validatedData.usn !== undefined) updateData.usn = validatedData.usn;
    if (validatedData.branchName !== undefined) updateData.branch_name = validatedData.branchName;
    if (validatedData.cameraPermission !== undefined) updateData.camera_permission = validatedData.cameraPermission;
    if (validatedData.microphonePermission !== undefined) updateData.microphone_permission = validatedData.microphonePermission;

    const student = await prisma.student.update({
      where: { user_id: user.id },
      data: updateData
    });

    return NextResponse.json({
      message: 'Profile updated successfully',
      student,
    });
  } catch (error: any) {
    console.error('[Student Profile Patch Error]', error);
    if (error instanceof z.ZodError || error.name === 'ZodError') {
      const firstIssue = error.issues?.[0] || error.errors?.[0];
      return NextResponse.json(
        { message: firstIssue?.message || 'Validation error' },
        { status: 400 }
      );
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { message: 'This USN is already registered.' },
        { status: 409 }
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Student record not found.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: 'Failed to update profile. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/students/profile
 * Get student profile
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    // Verify user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, is_active: true }
    });

    if (!user || !user.is_active || String(user.role).toLowerCase() !== 'student') {
      return NextResponse.json(
        { message: 'User account not found or unauthorized' },
        { status: 401 }
      );
    }

    let student = await prisma.student.findUnique({
      where: { user_id: user.id },
      include: { user: true }
    });

    // If student record does not exist yet for this valid user, initialize it safely
    if (!student) {
      student = await prisma.student.create({
        data: {
          user_id: user.id,
          profile_completed: false,
        },
        include: { user: true }
      });
    }

    return NextResponse.json({
      message: 'Student profile retrieved',
      student: {
        fullName: student.full_name || '',
        email: student.user?.email || user.email,
        phone: student.phone || '',
        college: student.college || '',
        usn: student.usn || '',
        branchName: student.branch_name || '',
        profileCompleted: student.profile_completed,
      },
    });
  } catch (error: any) {
    console.error('[Get Student Profile Error]', error);
    return NextResponse.json(
      { message: 'Failed to retrieve profile. Please try again later.' },
      { status: 500 }
    );
  }
}

