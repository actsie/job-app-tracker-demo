import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createFileManagementService, FileManagementPolicy, getDefaultFileManagementPolicy } from '@/lib/file-management';

const CONFIG_FILE = join(process.cwd(), 'file-management-config.json');

/**
 * POST /api/file-management/migrate
 * Triggers migration of existing jobs to new root directory
 */
export async function POST(request: NextRequest) {
  try {
    const { newRootPath, options }: { 
      newRootPath: string;
      options?: {
        copyFiles?: boolean;
        createBackup?: boolean;
      };
    } = await request.json();

    if (!newRootPath) {
      return NextResponse.json(
        { error: 'New root path is required' },
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

    const oldRootPath = config.rootDirectory;
    
    // Validate new path
    try {
      await fs.mkdir(newRootPath, { recursive: true });
    } catch (error) {
      return NextResponse.json(
        { error: `Cannot create new root directory: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    // Check if old directory exists and has jobs
    let hasExistingJobs = false;
    try {
      await fs.access(oldRootPath);
      const entries = await fs.readdir(oldRootPath);
      hasExistingJobs = entries.length > 0;
    } catch {
      // Old directory doesn't exist
    }

    const migrationSummary = {
      oldRootPath,
      newRootPath,
      hasExistingJobs,
      migrationRequired: hasExistingJobs && oldRootPath !== newRootPath,
      jobsFound: 0,
      estimatedTime: '< 1 minute'
    };

    if (hasExistingJobs && oldRootPath !== newRootPath) {
      // Count existing jobs for estimation
      try {
        const service = createFileManagementService(config);
        const importableJobs = await service.scanForImportableJobs(oldRootPath);
        migrationSummary.jobsFound = importableJobs.length;
        migrationSummary.estimatedTime = importableJobs.length > 50 ? '5-10 minutes' : 
                                       importableJobs.length > 10 ? '1-5 minutes' : '< 1 minute';
      } catch (error) {
        console.warn('Failed to scan existing jobs:', error);
      }
    }

    return NextResponse.json({
      migrationSummary,
      message: migrationSummary.migrationRequired ? 
        'Migration will be required when you update the root path' :
        'No migration needed - ready to update root path'
    });
  } catch (error) {
    console.error('Failed to prepare migration:', error);
    return NextResponse.json(
      { error: 'Failed to prepare migration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/file-management/migrate/execute
 * Executes the actual migration
 */
export async function PUT(request: NextRequest) {
  try {
    const { newRootPath, options }: { 
      newRootPath: string;
      options: {
        copyFiles: boolean;
        createBackup: boolean;
        overwriteExisting: boolean;
      };
    } = await request.json();

    // Load current config
    let config: FileManagementPolicy;
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = { ...getDefaultFileManagementPolicy(), ...JSON.parse(configData) };
    } catch {
      config = getDefaultFileManagementPolicy();
    }

    const oldRootPath = config.rootDirectory;
    
    // Create service with current config
    const service = createFileManagementService(config);
    
    // Scan old directory for jobs
    let importableJobs: any[] = [];
    try {
      importableJobs = await service.scanForImportableJobs(oldRootPath);
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to scan old directory: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    // Update config to use new root path
    const updatedConfig: FileManagementPolicy = {
      ...config,
      rootDirectory: newRootPath,
      attachmentMode: options.copyFiles ? 'copy' : config.attachmentMode,
      createBackups: options.createBackup
    };

    // Create service with updated config
    const updatedService = createFileManagementService(updatedConfig);
    
    // Check for conflicts
    const jobsWithConflicts = await updatedService.checkForConflicts(importableJobs);
    
    // Execute migration
    const migrationResult = await updatedService.executeImport(jobsWithConflicts, {
      handleConflicts: options.overwriteExisting,
      createBackup: options.createBackup
    });

    // Save updated configuration only if migration was successful
    if (migrationResult.failed === 0 || migrationResult.successful > 0) {
      await fs.writeFile(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));
    }

    return NextResponse.json({
      migrationResult,
      configUpdated: migrationResult.failed === 0 || migrationResult.successful > 0,
      message: `Migration completed: ${migrationResult.successful} successful, ${migrationResult.failed} failed, ${migrationResult.skipped} skipped`
    });
  } catch (error) {
    console.error('Failed to execute migration:', error);
    return NextResponse.json(
      { error: 'Failed to execute migration' },
      { status: 500 }
    );
  }
}