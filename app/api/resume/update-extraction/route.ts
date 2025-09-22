import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ResumeManifestEntry } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { resumeId, versionId, extractedText, extractionStatus, extractionMethod, extractionError } = await request.json();
    
    if (!resumeId || !versionId) {
      return NextResponse.json(
        { error: 'Resume ID and version ID are required' },
        { status: 400 }
      );
    }

    const manifestPath = join(process.cwd(), 'resume-manifest.json');
    
    // Read current manifest
    let manifest: ResumeManifestEntry[] = [];
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      // Manifest doesn't exist yet
      console.warn('Resume manifest not found, creating new one');
    }

    // Find and update the resume entry
    const resumeIndex = manifest.findIndex(entry => entry.id === resumeId);
    if (resumeIndex === -1) {
      return NextResponse.json(
        { error: 'Resume not found in manifest' },
        { status: 404 }
      );
    }

    const resume = manifest[resumeIndex];
    const versionIndex = resume.versions.findIndex(v => v.version_id === versionId);
    if (versionIndex === -1) {
      return NextResponse.json(
        { error: 'Version not found in resume' },
        { status: 404 }
      );
    }

    // Update version with extraction data
    resume.versions[versionIndex] = {
      ...resume.versions[versionIndex],
      extracted_text: extractedText,
      extraction_status: extractionStatus,
      extraction_error: extractionError,
      extraction_method: extractionMethod
    };

    // Update convenience fields for latest version
    if (resume.versions[versionIndex].is_active) {
      resume.latest_extracted_text = extractedText;
      resume.latest_extraction_status = extractionStatus;
    }

    resume.last_updated = new Date().toISOString();

    // Save updated manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Update job record with extracted text if extraction was successful
    if ((extractionStatus === 'completed' || extractionStatus === 'success') && extractedText) {
      try {
        // Find job records that reference this resume
        const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
        const files = await fs.readdir(jobDescriptionsPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = join(jobDescriptionsPath, file);
              const jobData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
              
              if (jobData.resume_id === resumeId) {
                // Update job record with extracted text
                jobData.resumeTextExtracted = extractedText;
                jobData.resumeTextSource = 'extracted';
                jobData.last_updated = new Date().toISOString();
                
                // Save updated job record
                await fs.writeFile(filePath, JSON.stringify(jobData, null, 2));
              }
            } catch (error) {
              console.warn(`Failed to read job file ${file}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to update job records with extracted text:', error);
        // Don't fail the extraction update if job record update fails
      }
    }

    return NextResponse.json({
      success: true,
      resumeId,
      versionId,
      extractionStatus
    });

  } catch (error) {
    console.error('Update extraction error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update extraction data',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}