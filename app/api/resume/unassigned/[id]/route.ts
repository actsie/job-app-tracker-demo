import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { UnassignedResumeEntry } from '@/lib/types';

const UNASSIGNED_MANIFEST_PATH = join(process.cwd(), 'data', 'unassigned-manifest.json');

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resumeId = params.id;

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    // Load current manifest
    const manifest = await loadUnassignedManifest();
    const resumeIndex = manifest.resumes.findIndex(r => r.id === resumeId);

    if (resumeIndex === -1) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    const resume = manifest.resumes[resumeIndex];

    // Delete the file if it exists
    try {
      await fs.access(resume.managed_path);
      await fs.unlink(resume.managed_path);
    } catch (error) {
      console.warn('File not found or already deleted:', resume.managed_path);
    }

    // Remove from manifest
    manifest.resumes.splice(resumeIndex, 1);
    await saveUnassignedManifest(manifest);

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete resume' },
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

async function saveUnassignedManifest(manifest: { resumes: UnassignedResumeEntry[] }) {
  const dataDir = join(process.cwd(), 'data');
  
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  
  await fs.writeFile(UNASSIGNED_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}