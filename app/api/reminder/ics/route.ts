import { NextRequest, NextResponse } from 'next/server';
import { generateJobReminderICS } from '@/lib/ics-generator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get parameters from query string
    const company = searchParams.get('company');
    const role = searchParams.get('role');
    const reminderDate = searchParams.get('date');
    const message = searchParams.get('message') || 'Follow up on this application';
    const jobUrl = searchParams.get('url');
    const jobUUID = searchParams.get('uuid');

    // Validate required parameters
    if (!company || !role || !reminderDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: company, role, and date are required' },
        { status: 400 }
      );
    }

    // Parse the date
    const date = new Date(reminderDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Generate ICS content
    const icsContent = generateJobReminderICS(
      company,
      role,
      date,
      message,
      jobUrl || undefined,
      jobUUID || undefined
    );

    // Create safe filename
    const safeCompany = company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeRole = role.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `reminder_${safeCompany}_${safeRole}.ics`;

    // Return ICS file
    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating ICS file:', error);
    return NextResponse.json(
      { error: 'Failed to generate ICS file' },
      { status: 500 }
    );
  }
}