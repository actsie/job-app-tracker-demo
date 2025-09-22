import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';
import { operationsLog } from '@/lib/operations-log';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get('resumeId');
    
    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    // Get resume details before deletion for logging
    const resumes = await resumeManager.getAllResumes();
    const resume = resumes.find(r => r.id === resumeId);
    
    if (!resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    const filePaths = resume.versions.map(v => v.managed_path);
    
    await resumeManager.deleteResume(resumeId);

    // Log the deletion
    await operationsLog.logOperation('delete', {
      manifest_entries: [resumeId],
      affected_files: filePaths,
      user_action: `Deleted resume: ${resume.base_filename}`
    }, false);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete resume' },
      { status: 500 }
    );
  }
}