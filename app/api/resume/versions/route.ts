import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');
    const jobUuid = searchParams.get('jobUuid');
    const action = searchParams.get('action');

    if (action === 'all') {
      // Get all version history across all resumes
      const allHistory = await resumeManager.getAllVersionHistory();
      return NextResponse.json({
        success: true,
        history: allHistory
      });
    }

    if (jobUuid) {
      // Get version history by job UUID
      const jobHistory = await resumeManager.getVersionHistoryByJob(jobUuid);
      return NextResponse.json({
        success: true,
        history: jobHistory
      });
    }

    if (resumeId) {
      // Get version history for specific resume
      const versionHistory = await resumeManager.getVersionHistory(resumeId);
      const activeVersion = await resumeManager.getActiveVersion(resumeId);
      
      return NextResponse.json({
        success: true,
        versions: versionHistory,
        activeVersion
      });
    }

    return NextResponse.json({ 
      error: 'Missing required parameter: resumeId, jobUuid, or action=all' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error fetching version history:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch version history' 
    }, { status: 500 });
  }
}