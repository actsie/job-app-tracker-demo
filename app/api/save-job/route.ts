import { NextRequest, NextResponse } from 'next/server';
import { saveJobDescription } from '@/lib/storage';
import { fetchJobDescriptionFromUrl } from '@/lib/url-fetcher';
import { deduplicationService } from '@/lib/deduplication';
import { createJobStorageManager } from '@/lib/job-storage';
import { JobDescription } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { 
      text, 
      url, 
      company, 
      role,
      storageOptions,
      attachments = [],
      resumeTextExtracted,
      resumeTextSource
    } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Job description text is required' },
        { status: 400 }
      );
    }

    let sourceHtml: string | undefined;
    
    if (url && typeof url === 'string') {
      try {
        const fetchResult = await fetchJobDescriptionFromUrl(url);
        if (fetchResult.html) {
          sourceHtml = fetchResult.html;
        }
      } catch (error) {
        console.warn('Failed to re-fetch HTML for storage:', error);
      }
    }

    const result = await saveJobDescription(
      text,
      url || null,
      company || null,
      role || null,
      sourceHtml,
      url ? 'url_fetch' : 'manual',
      undefined, // companyOverride
      undefined, // roleOverride
      null, // formattedContent
      resumeTextExtracted,
      resumeTextSource
    );

    // Check for duplicates after saving
    let duplicateGroups: any[] = [];
    try {
      const allJobs = await deduplicationService.getAllJobDescriptions();
      const savedJob = allJobs.find(job => job.uuid === result.uuid);
      if (savedJob) {
        duplicateGroups = await deduplicationService.checkForDuplicatesOnSave(savedJob);
      }
    } catch (error) {
      console.warn('Failed to check for duplicates on save:', error);
    }

    // Handle structured storage if requested
    let storageResult = null;
    if (storageOptions?.saveToDisk && storageOptions.rootPath) {
      try {
        const storageManager = createJobStorageManager({
          rootPath: storageOptions.rootPath,
          attachmentMode: storageOptions.attachmentMode || 'copy',
          generateSnapshots: storageOptions.generateSnapshot !== false,
        });

        const savedJob = await deduplicationService.getAllJobDescriptions()
          .then(jobs => jobs.find(job => job.uuid === result.uuid));

        if (savedJob) {
          const processedAttachments = attachments.map((attachment: any) => ({
            type: attachment.type,
            originalPath: attachment.path || '',
            filename: attachment.filename,
            content: attachment.content ? Buffer.from(attachment.content, 'base64') : undefined,
          }));

          if (sourceHtml) {
            processedAttachments.push({
              type: 'job_description',
              originalPath: '',
              filename: 'jd.html',
              content: sourceHtml,
            });
          }

          storageResult = await storageManager.saveJob(
            savedJob,
            processedAttachments,
            storageOptions.generateSnapshot
          );
        }
      } catch (error) {
        console.warn('Failed to save to structured storage:', error);
        // Continue with normal response - structured storage is optional
      }
    }

    return NextResponse.json({
      success: true,
      uuid: result.uuid,
      jsonPath: result.jsonPath,
      txtPath: result.txtPath,
      duplicateGroups: duplicateGroups,
      hasDuplicates: duplicateGroups.length > 0,
      storage: storageResult ? {
        folderPath: storageResult.folderPath,
        jobJsonPath: storageResult.jobJsonPath,
        jobTxtPath: storageResult.jobTxtPath,
        attachmentPaths: storageResult.attachmentPaths,
        snapshotPaths: storageResult.snapshotPaths,
      } : null,
    });
  } catch (error) {
    console.error('Error in save-job API:', error);
    return NextResponse.json(
      { error: 'Failed to save job description' },
      { status: 500 }
    );
  }
}