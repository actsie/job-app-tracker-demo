import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createFileManagementService, FileManagementPolicy, getDefaultFileManagementPolicy } from '@/lib/file-management';

const CONFIG_FILE = join(process.cwd(), 'file-management-config.json');

/**
 * POST /api/file-management/import/scan
 * Scans a directory for importable job files
 */
export async function POST(request: NextRequest) {
  try {
    const { sourcePath }: { sourcePath: string } = await request.json();

    if (!sourcePath) {
      return NextResponse.json(
        { error: 'Source path is required' },
        { status: 400 }
      );
    }

    // Validate source directory exists
    try {
      const stat = await fs.stat(sourcePath);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: 'Source path must be a directory' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Source directory does not exist or is not accessible' },
        { status: 400 }
      );
    }

    // Load current config
    let config: FileManagementPolicy;
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = { ...getDefaultFileManagementPolicy(), ...JSON.parse(configData) };
    } catch {
      config = getDefaultFileManagementPolicy();
    }

    // Create file management service
    const service = createFileManagementService(config);

    // Scan for importable jobs
    const importableJobs = await service.scanForImportableJobs(sourcePath);
    
    // Check for conflicts
    const jobsWithConflicts = await service.checkForConflicts(importableJobs);

    const summary = {
      totalFiles: jobsWithConflicts.length,
      readyToImport: jobsWithConflicts.filter(j => j.status === 'ready').length,
      hasConflicts: jobsWithConflicts.filter(j => j.status === 'conflict').length,
      failed: jobsWithConflicts.filter(j => j.status === 'failed').length,
      sourcePath
    };

    return NextResponse.json({
      jobs: jobsWithConflicts,
      summary,
      message: `Found ${summary.totalFiles} importable job files`
    });
  } catch (error) {
    console.error('Failed to scan directory:', error);
    return NextResponse.json(
      { error: `Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}