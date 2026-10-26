import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { calculateShortlist, validateShortlistConfig } from '@/lib/services/shortlisting-engine';

/**
 * GET /api/admin/shortlist/export
 * Exports calculated or published shortlist to an Excel spreadsheet.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'super_admin')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const roundParam = request.nextUrl.searchParams.get('round');
    const templateId = request.nextUrl.searchParams.get('templateId') || request.nextUrl.searchParams.get('assessmentId');
    const round = roundParam ? parseInt(roundParam, 10) : 1;

    // Load saved settings
    const savedSetting = await prisma.shortlistSetting.findFirst({
      where: {
        round,
        template_id: templateId || null
      },
      orderBy: { updated_at: 'desc' }
    });

    const configToUse = savedSetting ? validateShortlistConfig({
      shortlistSize: savedSetting.shortlist_size,
      overallCutoffEnabled: savedSetting.overall_cutoff_enabled,
      overallCutoffPercentage: Number(savedSetting.overall_cutoff_percentage),
      sectionCutoffs: (savedSetting.section_cutoffs as any) || {},
      overallWeight: Number(savedSetting.overall_weight),
      sectionWeight: Number(savedSetting.section_weight),
      categoryWeights: (savedSetting.category_weights as any) || {}
    }) : validateShortlistConfig({
      shortlistSize: 10,
      overallCutoffEnabled: false,
      overallCutoffPercentage: 60,
      sectionCutoffs: {},
      overallWeight: 50,
      sectionWeight: 50,
      categoryWeights: { CODING: 50, APTITUDE: 50 }
    });

    const calculated = await calculateShortlist({
      round,
      templateId,
      config: configToUse
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EllipHire System';
    workbook.created = new Date();

    const applyHeaderStyle = (sheet: ExcelJS.Worksheet) => {
      sheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length }
      };
    };

    // SHEET 1: Shortlisted Candidates
    const sheet1 = workbook.addWorksheet('Shortlisted Candidates');
    sheet1.columns = [
      { header: 'Rank', key: 'rank', width: 10 },
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'USN', key: 'usn', width: 18 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Ranking Score', key: 'rankingScore', width: 16 },
      { header: 'Overall Score (%)', key: 'overallScore', width: 18 },
      { header: 'Weighted Section (%)', key: 'sectionScore', width: 20 },
      { header: 'Status', key: 'status', width: 16 },
    ];
    applyHeaderStyle(sheet1);

    const shortlisted = calculated.candidates.filter(c => c.shortlistStatus === 'shortlisted');
    shortlisted.forEach(c => {
      sheet1.addRow({
        rank: c.rank,
        name: c.fullName,
        usn: c.usn,
        branch: c.branch,
        email: c.email,
        rankingScore: c.rankingScore,
        overallScore: `${c.overallPercentage}%`,
        sectionScore: `${c.weightedSectionPercentage}%`,
        status: 'SHORTLISTED'
      });
    });

    // SHEET 2: Full Candidate Directory & Rankings
    const sheet2 = workbook.addWorksheet('All Candidate Rankings');
    sheet2.columns = [
      { header: 'Rank', key: 'rank', width: 10 },
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'USN', key: 'usn', width: 18 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Ranking Score', key: 'rankingScore', width: 16 },
      { header: 'Overall (%)', key: 'overallScore', width: 14 },
      { header: 'Section (%)', key: 'sectionScore', width: 14 },
      { header: 'Shortlist Status', key: 'status', width: 18 },
      { header: 'Exclusion / Review Reason', key: 'reasons', width: 45 },
    ];
    applyHeaderStyle(sheet2);

    calculated.candidates.forEach(c => {
      sheet2.addRow({
        rank: c.rank ?? 'N/A',
        name: c.fullName,
        usn: c.usn,
        branch: c.branch,
        email: c.email,
        rankingScore: c.rankingScore ?? 'N/A',
        overallScore: `${c.overallPercentage}%`,
        sectionScore: `${c.weightedSectionPercentage}%`,
        status: c.shortlistStatus.toUpperCase(),
        reasons: c.exclusionReasons.join('; ') || (c.reviewReason || 'None')
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Candidate_Shortlist_Round_${round}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('[Shortlist Export Error]', error);
    return NextResponse.json(
      { message: error.message || 'Failed to export shortlist' },
      { status: 500 }
    );
  }
}
