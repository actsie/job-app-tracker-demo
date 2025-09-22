import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobUuid = searchParams.get('jobUuid');

    let resumes;
    if (jobUuid) {
      resumes = await resumeManager.getResumesByJobUuid(jobUuid);
    } else {
      resumes = await resumeManager.getAllResumes();
    }

    return NextResponse.json({ resumes });
  } catch (error) {
    console.error('Error listing resumes:', error);
    return NextResponse.json(
      { error: 'Failed to list resumes' },
      { status: 500 }
    );
  }
}