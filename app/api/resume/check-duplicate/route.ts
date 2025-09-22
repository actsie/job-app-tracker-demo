import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { UnassignedResumeEntry, ResumeManifestEntry } from '@/lib/types';

const UNASSIGNED_MANIFEST_PATH = join(process.cwd(), 'data', 'unassigned-manifest.json');
const RESUME_MANIFEST_PATH = join(process.cwd(), 'data', 'resume-manifest.json');

export async function POST(request: NextRequest) {
  try {
    const { resumeId, jobUuid } = await request.json();

    if (!resumeId || !jobUuid) {
      return NextResponse.json(
        { error: 'Resume ID and Job UUID are required' },
        { status: 400 }
      );
    }

    // Load unassigned manifest to get the resume details
    const unassignedManifest = await loadUnassignedManifest();
    const unassignedResume = unassignedManifest.resumes.find(r => r.id === resumeId);

    if (!unassignedResume) {
      return NextResponse.json(
        { error: 'Resume not found in unassigned' },
        { status: 404 }
      );
    }

    // Load resume manifest to check for existing versions
    const resumeManifest = await loadResumeManifest();
    const existingEntry = resumeManifest.resumes.find(r => r.job_uuid === jobUuid);

    if (!existingEntry) {
      // No existing resume for this job
      return NextResponse.json({
        isDuplicate: false,
        hasExistingResume: false
      });
    }

    // Check if any existing version has the same content hash
    const isDuplicate = existingEntry.versions.some(
      version => version.file_checksum === unassignedResume.content_hash
    );

    return NextResponse.json({
      isDuplicate,
      hasExistingResume: true,
      existingResume: {
        filename: existingEntry.versions.find(v => v.is_active)?.original_filename || 'Unknown',
        versionCount: existingEntry.versions.length
      }
    });

  } catch (error) {
    console.error('Check duplicate error:', error);
    return NextResponse.json(
      { error: 'Failed to check for duplicates' },
      { status: 500 }
    );
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

async function loadResumeManifest(): Promise<{ resumes: ResumeManifestEntry[] }> {
  try {
    await fs.access(RESUME_MANIFEST_PATH);
    const data = await fs.readFile(RESUME_MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { resumes: [] };
  }
}