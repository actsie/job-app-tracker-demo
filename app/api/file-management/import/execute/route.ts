import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createFileManagementService, FileManagementPolicy, getDefaultFileManagementPolicy, ImportableJob } from '@/lib/file-management';

const CONFIG_FILE = join(process.cwd(), 'file-management-config.json');

/**
 * POST /api/file-management/import/execute
 * Executes the import of selected job files
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      jobs, 
      options 
    }: { 
      jobs: ImportableJob[];
      options: {
        handleConflicts: boolean;
        createBackup: boolean;
        copyFiles: boolean;
        skipFiles: boolean;
      };
    } = await request.json();

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: 'No jobs selected for import' },
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

    // Update config based on options
    if (options.copyFiles && config.attachmentMode === 'reference') {
      config = { ...config, attachmentMode: 'copy' };
    }

    // Create file management service
    const service = createFileManagementService(config);

    // Filter jobs based on options
    let jobsToImport = jobs;
    if (options.skipFiles) {
      jobsToImport = jobs.filter(job => job.status !== 'conflict');
    }

    // Execute import
    const migrationResult = await service.executeImport(jobsToImport, {
      handleConflicts: options.handleConflicts,
      createBackup: options.createBackup
    });

    return NextResponse.json({
      result: migrationResult,
      message: `Import completed: ${migrationResult.successful} successful, ${migrationResult.failed} failed, ${migrationResult.skipped} skipped`
    });
  } catch (error) {
    console.error('Failed to execute import:', error);
    return NextResponse.json(
      { error: `Failed to execute import: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/file-management/import/execute
 * Updates job mappings before import
 */
export async function PUT(request: NextRequest) {
  try {
    const { 
      jobId,
      updates 
    }: { 
      jobId: string;
      updates: {
        company?: string;
        role?: string;
        date?: string;
      };
    } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
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

    // Create mock job to test new path
    const mockJob = {
      company: updates.company,
      role: updates.role,
      applied_date: updates.date,
      fetched_at_iso: new Date().toISOString()
    };

    const preview = service.createJobFolderPreview(mockJob);

    return NextResponse.json({
      preview,
      message: 'Job mapping updated successfully'
    });
  } catch (error) {
    console.error('Failed to update job mapping:', error);
    return NextResponse.json(
      { error: 'Failed to update job mapping' },
      { status: 500 }
    );
  }
}