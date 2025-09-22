import { NextRequest, NextResponse } from 'next/server';
import { createFileManagementService, FileManagementPolicy } from '@/lib/file-management';
import { JobDescription } from '@/lib/types';

/**
 * POST /api/file-management/preview
 * Creates a preview of how a job folder will be structured
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      job, 
      policy 
    }: { 
      job: Partial<JobDescription>;
      policy: FileManagementPolicy;
    } = await request.json();

    if (!job) {
      return NextResponse.json(
        { error: 'Job data is required' },
        { status: 400 }
      );
    }

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy configuration is required' },
        { status: 400 }
      );
    }

    // Create file management service with the provided policy
    const service = createFileManagementService(policy);

    // Generate preview
    const preview = service.createJobFolderPreview(job);

    return NextResponse.json({
      preview,
      message: 'Preview generated successfully'
    });
  } catch (error) {
    console.error('Failed to generate preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}