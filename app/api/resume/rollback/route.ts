import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';

export async function POST(request: NextRequest) {
  try {
    const { resumeId, targetVersionId } = await request.json();

    if (!resumeId || !targetVersionId) {
      return NextResponse.json({ 
        error: 'Missing required fields: resumeId, targetVersionId' 
      }, { status: 400 });
    }

    // Perform rollback
    const rollbackVersion = await resumeManager.rollbackToVersion(
      resumeId, 
      targetVersionId
    );

    // Get updated version history
    const updatedVersionHistory = await resumeManager.getVersionHistory(resumeId);

    return NextResponse.json({
      success: true,
      rollbackVersion,
      updatedVersionHistory,
      message: `Successfully rolled back to version ${rollbackVersion.version_suffix || 'original'}`
    });

  } catch (error) {
    console.error('Error during rollback:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to rollback resume version' 
    }, { status: 500 });
  }
}