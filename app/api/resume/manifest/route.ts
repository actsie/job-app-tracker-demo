import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    const resume = await resumeManager.getResumeById(resumeId);
    
    if (!resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(resume);
  } catch (error) {
    console.error('Error fetching resume manifest:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resume manifest' },
      { status: 500 }
    );
  }
}