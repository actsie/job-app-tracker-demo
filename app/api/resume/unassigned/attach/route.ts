import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnassignedResumeEntry, ResumeManifestEntry, ResumeVersionEntry } from '@/lib/types';

const UNASSIGNED_MANIFEST_PATH = join(process.cwd(), 'data', 'unassigned-manifest.json');
const RESUME_MANIFEST_PATH = join(process.cwd(), 'data', 'resume-manifest.json');
const MANAGED_RESUMES_PATH = join(process.cwd(), 'managed-resumes');

export async function POST(request: NextRequest) {
  try {
    const { resumeId, jobUuid, replaceActive = false, setAsActive = true } = await request.json();

    if (!resumeId || !jobUuid) {
      return NextResponse.json(
        { error: 'Resume ID and Job UUID are required' },
        { status: 400 }
      );
    }

    await ensureDirectories();

    // Load unassigned manifest
    const unassignedManifest = await loadUnassignedManifest();
    const resumeIndex = unassignedManifest.resumes.findIndex(r => r.id === resumeId);

    if (resumeIndex === -1) {
      return NextResponse.json(
        { error: 'Resume not found in unassigned' },
        { status: 404 }
      );
    }

    const unassignedResume = unassignedManifest.resumes[resumeIndex];

    // Load job details to generate proper filename
    const jobResponse = await fetch(`${process.env.NEXTJS_URL || 'http://localhost:3000'}/api/jobs`);
    let job = null;
    if (jobResponse.ok) {
      const jobsData = await jobResponse.json();
      job = jobsData.jobs?.find((j: any) => j.uuid === jobUuid);
    }

    // Generate managed filename
    const company = job?.company || 'Unknown_Company';
    const role = job?.role || 'Unknown_Role';
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    
    const baseFilename = `${sanitize(company)}_${sanitize(role)}_${date}`;
    const fileExtension = unassignedResume.file_extension;
    const managedFilename = `${baseFilename}${fileExtension}`;
    const managedPath = join(MANAGED_RESUMES_PATH, managedFilename);

    // Copy file to managed location
    try {
      const fileContent = await fs.readFile(unassignedResume.managed_path);
      await fs.writeFile(managedPath, fileContent);
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to copy resume file' },
        { status: 500 }
      );
    }

    // Load resume manifest
    const resumeManifest = await loadResumeManifest();

    // Check if this job already has a resume manifest entry
    let existingManifestEntry = resumeManifest.resumes.find(r => r.job_uuid === jobUuid);

    if (existingManifestEntry) {
      // Add new version to existing entry
      const versionId = uuidv4();
      const versionSuffix = `_v${existingManifestEntry.versions.length + 1}`;
      
      // Handle version activation based on parameters
      if (setAsActive) {
        // Set all existing versions to inactive
        existingManifestEntry.versions.forEach(v => v.is_active = false);
      }

      const newVersion: ResumeVersionEntry = {
        version_id: versionId,
        version_suffix: versionSuffix,
        managed_path: managedPath,
        original_path: unassignedResume.original_path || '',
        original_filename: unassignedResume.filename,
        file_checksum: unassignedResume.content_hash,
        upload_timestamp: new Date().toISOString(),
        is_active: setAsActive
      };

      existingManifestEntry.versions.push(newVersion);
      existingManifestEntry.last_updated = new Date().toISOString();
      
      // Copy extracted text if available
      if (unassignedResume.extracted_text) {
        existingManifestEntry.latest_extracted_text = unassignedResume.extracted_text;
        existingManifestEntry.latest_extraction_status = unassignedResume.extraction_status || 'success';
      }

    } else {
      // Create new resume manifest entry
      const resumeManifestId = uuidv4();
      const versionId = uuidv4();

      const newManifestEntry: ResumeManifestEntry = {
        id: resumeManifestId,
        job_uuid: jobUuid,
        base_filename: baseFilename,
        filename_components: {
          company: company,
          role: role,
          date: date
        },
        file_extension: fileExtension,
        keep_original: false, // Since moved from unassigned
        versions: [{
          version_id: versionId,
          version_suffix: '',
          managed_path: managedPath,
          original_path: unassignedResume.original_path || '',
          original_filename: unassignedResume.filename,
          file_checksum: unassignedResume.content_hash,
          upload_timestamp: new Date().toISOString(),
          is_active: true
        }],
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      // Copy extracted text if available
      if (unassignedResume.extracted_text) {
        newManifestEntry.latest_extracted_text = unassignedResume.extracted_text;
        newManifestEntry.latest_extraction_status = unassignedResume.extraction_status || 'success';
      }

      resumeManifest.resumes.push(newManifestEntry);
    }

    // Save resume manifest
    await saveResumeManifest(resumeManifest);

    // Update the job to set the active resume version ID
    const activeVersionId = existingManifestEntry 
      ? existingManifestEntry.versions.find(v => v.is_active)?.version_id
      : resumeManifest.resumes[resumeManifest.resumes.length - 1]?.versions.find(v => v.is_active)?.version_id;

    if (activeVersionId) {
      try {
        const jobUpdateResponse = await fetch(`${process.env.NEXTJS_URL || 'http://localhost:3000'}/api/jobs/${jobUuid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active_resume_version_id: activeVersionId,
            resume_filename: unassignedResume.filename,
            resume_path: managedPath,
            // Copy extracted text to job record for Interview Prep
            resumeTextExtracted: unassignedResume.extracted_text || '',
            resumeTextSource: unassignedResume.extracted_text ? 'extracted' : 'none',
            extractionStatus: unassignedResume.extraction_status || 'ok'
          })
        });

        if (!jobUpdateResponse.ok) {
          console.warn('Failed to update job with active resume version ID');
        }
      } catch (error) {
        console.warn('Error updating job with active resume version ID:', error);
      }
    }

    // Remove from unassigned
    unassignedManifest.resumes.splice(resumeIndex, 1);
    await saveUnassignedManifest(unassignedManifest);

    // Clean up unassigned file
    try {
      await fs.unlink(unassignedResume.managed_path);
    } catch (error) {
      console.warn('Failed to clean up unassigned file:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Resume attached successfully',
      resumeEntry: existingManifestEntry || resumeManifest.resumes[resumeManifest.resumes.length - 1]
    });

  } catch (error) {
    console.error('Attach resume error:', error);
    return NextResponse.json(
      { error: 'Failed to attach resume' },
      { status: 500 }
    );
  }
}

async function ensureDirectories() {
  const dirs = [
    join(process.cwd(), 'data'),
    MANAGED_RESUMES_PATH
  ];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

async function loadUnassignedManifest(): Promise<{ resumes: UnassignedResumeEntry[] }> {
  try {
    await fs.access(UNASSIGNED_MANIFEST_PATH);
    const data = await fs.readFile(UNASSIGNED_MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { resumes: [] };
  }
}

async function saveUnassignedManifest(manifest: { resumes: UnassignedResumeEntry[] }) {
  await fs.writeFile(UNASSIGNED_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function loadResumeManifest(): Promise<{ resumes: ResumeManifestEntry[] }> {
  try {
    await fs.access(RESUME_MANIFEST_PATH);
    const data = await fs.readFile(RESUME_MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { resumes: [] };
  }
}

async function saveResumeManifest(manifest: { resumes: ResumeManifestEntry[] }) {
  await fs.writeFile(RESUME_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}