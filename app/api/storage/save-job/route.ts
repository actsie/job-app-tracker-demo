import { NextRequest, NextResponse } from 'next/server';
import { createJobStorageManager } from '@/lib/job-storage';
import { JobDescription } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { 
      job, 
      storageConfig, 
      attachments = [], 
      generateSnapshot = false 
    } = await request.json();

    if (!job || !storageConfig?.rootPath) {
      return NextResponse.json(
        { error: 'Job data and storage configuration are required' },
        { status: 400 }
      );
    }

    // Validate job data
    const jobDescription: JobDescription = {
      ...job,
      uuid: job.uuid || require('crypto').randomUUID(),
      fetched_at_iso: job.fetched_at_iso || new Date().toISOString(),
    };

    // Create storage manager
    const storageManager = createJobStorageManager({
      rootPath: storageConfig.rootPath,
      attachmentMode: storageConfig.attachmentMode || 'copy',
      generateSnapshots: storageConfig.generateSnapshots !== false,
    });

    // Process attachments
    const processedAttachments = attachments.map((attachment: any) => ({
      type: attachment.type,
      originalPath: attachment.path || '',
      filename: attachment.filename,
      content: attachment.content ? Buffer.from(attachment.content, 'base64') : undefined,
    }));

    // Save job to structured folder
    const result = await storageManager.saveJob(
      jobDescription,
      processedAttachments,
      generateSnapshot
    );

    return NextResponse.json({
      success: true,
      folderPath: result.folderPath,
      jobJsonPath: result.jobJsonPath,
      jobTxtPath: result.jobTxtPath,
      attachmentPaths: result.attachmentPaths,
      snapshotPaths: result.snapshotPaths,
      message: `Job saved to ${result.folderPath}`,
    });
  } catch (error) {
    console.error('Error in save-job storage API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save job to storage',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}