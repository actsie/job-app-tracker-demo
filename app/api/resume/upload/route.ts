import { NextRequest, NextResponse } from 'next/server';
import { resumeManager } from '@/lib/resume-manager';
import { operationsLog } from '@/lib/operations-log';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEMP_UPLOAD_DIR = join(process.cwd(), 'temp-uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const jobUuid = formData.get('jobUuid') as string;
    const company = formData.get('company') as string;
    const role = formData.get('role') as string;
    const yourName = formData.get('yourName') as string || '';
    const keepOriginal = formData.get('keepOriginal') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!jobUuid || !company || !role) {
      return NextResponse.json({ 
        error: 'Missing required fields: jobUuid, company, role' 
      }, { status: 400 });
    }

    // Ensure temp upload directory exists
    if (!existsSync(TEMP_UPLOAD_DIR)) {
      await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
    }

    // Create temp file path
    const tempFilePath = join(TEMP_UPLOAD_DIR, `${Date.now()}_${file.name}`);
    
    try {
      // Write uploaded file to temp location
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(tempFilePath, buffer);

      // Process the resume upload
      const manifestEntry = await resumeManager.uploadResume(
        tempFilePath,
        jobUuid,
        company.trim(),
        role.trim(),
        keepOriginal,
        yourName.trim()
      );

      // Log the upload operation
      const activeVersion = manifestEntry.versions.find(v => v.is_active);
      await operationsLog.logOperation('upload', {
        manifest_entries: [manifestEntry.id],
        target_paths: activeVersion ? [activeVersion.managed_path] : [],
        source_paths: [tempFilePath],
        job_uuid: jobUuid,
        user_action: `Uploaded resume for ${company} - ${role}`
      }, true);

      // Update the job record with resume linkage information
      try {
        const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
        const files = await import('fs/promises').then(fs => fs.readdir(jobDescriptionsPath));
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = join(jobDescriptionsPath, file);
              const jobData = JSON.parse(await import('fs/promises').then(fs => fs.readFile(filePath, 'utf-8')));
              
              if (jobData.uuid === jobUuid) {
                // Update job record with resume information
                jobData.resume_id = manifestEntry.id;
                jobData.resume_filename = manifestEntry.base_filename;
                jobData.resume_path = activeVersion?.managed_path || '';
                jobData.last_updated = new Date().toISOString();
                
                // Save updated job record
                await import('fs/promises').then(fs => fs.writeFile(filePath, JSON.stringify(jobData, null, 2)));
                break;
              }
            } catch (error) {
              console.warn(`Failed to read job file ${file}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to update job record with resume info:', error);
        // Don't fail the upload if job record update fails
      }

      return NextResponse.json({
        success: true,
        resume: manifestEntry
      });

    } catch (error) {
      // Clean up temp file in case of error
      try {
        const fs = await import('fs/promises');
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw error;
    }

  } catch (error) {
    console.error('Error uploading resume:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to upload resume' 
    }, { status: 500 });
  }
}