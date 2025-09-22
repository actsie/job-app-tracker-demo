import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnassignedResumeEntry } from '@/lib/types';

const UNASSIGNED_MANIFEST_PATH = join(process.cwd(), 'data', 'unassigned-manifest.json');

export async function GET(request: NextRequest) {
  try {
    await ensureDataDirectory();
    
    const manifest = await loadUnassignedManifest();
    
    return NextResponse.json({
      resumes: manifest.resumes || [],
      total: manifest.resumes?.length || 0
    });

  } catch (error) {
    console.error('Error loading unassigned resumes:', error);
    return NextResponse.json(
      { error: 'Failed to load unassigned resumes' },
      { status: 500 }
    );
  }
}

async function ensureDataDirectory() {
  const dataDir = join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function loadUnassignedManifest(): Promise<{ resumes: UnassignedResumeEntry[] }> {
  try {
    await fs.access(UNASSIGNED_MANIFEST_PATH);
    const data = await fs.readFile(UNASSIGNED_MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    // If file doesn't exist, return empty manifest
    const manifest = { resumes: [] };
    await fs.writeFile(UNASSIGNED_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    return manifest;
  }
}

async function saveUnassignedManifest(manifest: { resumes: UnassignedResumeEntry[] }) {
  await ensureDataDirectory();
  await fs.writeFile(UNASSIGNED_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}