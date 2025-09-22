import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createFileManagementService, FileManagementPolicy, getDefaultFileManagementPolicy, BulkOperation, MigrationLogEntry } from '@/lib/file-management';
import { v4 as uuidv4 } from 'uuid';
import { JobDescription } from '@/lib/types';

const CONFIG_FILE = join(process.cwd(), 'file-management-config.json');

/**
 * POST /api/file-management/bulk/copy-to-reference
 * Converts jobs from copy mode to reference mode
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      jobIds,
      createBackup = true 
    }: { 
      jobIds: string[];
      createBackup?: boolean;
    } = await request.json();

    if (!jobIds || jobIds.length === 0) {
      return NextResponse.json(
        { error: 'No jobs selected' },
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

    const operationId = uuidv4();
    const log: MigrationLogEntry[] = [];
    let successful = 0;
    let failed = 0;

    const backupFolder = createBackup 
      ? join(config.rootDirectory, '_backups', `bulk_copy_to_ref_${operationId}`)
      : undefined;

    if (backupFolder) {
      await fs.mkdir(backupFolder, { recursive: true });
    }

    for (const jobId of jobIds) {
      try {
        const result = await convertJobCopyToReference(jobId, config, backupFolder);
        log.push(result);
        successful++;
      } catch (error) {
        log.push({
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          action: 'error',
          sourcePath: jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
          canUndo: false
        });
        failed++;
      }
    }

    const operation: BulkOperation = {
      id: operationId,
      type: 'copy_to_reference',
      targetJobs: jobIds,
      progress: {
        total: jobIds.length,
        completed: successful,
        failed
      },
      status: failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'failed'),
      log
    };

    // Save operation log
    await saveBulkOperationLog(operation, config);

    return NextResponse.json({
      operation,
      message: `Bulk operation completed: ${successful} successful, ${failed} failed`
    });
  } catch (error) {
    console.error('Failed to execute bulk copy-to-reference:', error);
    return NextResponse.json(
      { error: 'Failed to execute bulk operation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/file-management/bulk/reference-to-copy
 * Converts jobs from reference mode to copy mode
 */
export async function PUT(request: NextRequest) {
  try {
    const { 
      jobIds,
      createBackup = true 
    }: { 
      jobIds: string[];
      createBackup?: boolean;
    } = await request.json();

    if (!jobIds || jobIds.length === 0) {
      return NextResponse.json(
        { error: 'No jobs selected' },
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

    const operationId = uuidv4();
    const log: MigrationLogEntry[] = [];
    let successful = 0;
    let failed = 0;

    const backupFolder = createBackup 
      ? join(config.rootDirectory, '_backups', `bulk_ref_to_copy_${operationId}`)
      : undefined;

    if (backupFolder) {
      await fs.mkdir(backupFolder, { recursive: true });
    }

    for (const jobId of jobIds) {
      try {
        const result = await convertJobReferenceToCopy(jobId, config, backupFolder);
        log.push(result);
        successful++;
      } catch (error) {
        log.push({
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          action: 'error',
          sourcePath: jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
          canUndo: false
        });
        failed++;
      }
    }

    const operation: BulkOperation = {
      id: operationId,
      type: 'reference_to_copy',
      targetJobs: jobIds,
      progress: {
        total: jobIds.length,
        completed: successful,
        failed
      },
      status: failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'failed'),
      log
    };

    // Save operation log
    await saveBulkOperationLog(operation, config);

    return NextResponse.json({
      operation,
      message: `Bulk operation completed: ${successful} successful, ${failed} failed`
    });
  } catch (error) {
    console.error('Failed to execute bulk reference-to-copy:', error);
    return NextResponse.json(
      { error: 'Failed to execute bulk operation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/file-management/bulk/operations
 * Lists recent bulk operations
 */
export async function GET() {
  try {
    // Load current config
    let config: FileManagementPolicy;
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = { ...getDefaultFileManagementPolicy(), ...JSON.parse(configData) };
    } catch {
      config = getDefaultFileManagementPolicy();
    }

    const bulkOpsDir = join(config.migrationLogPath, 'bulk-operations');
    const operations: BulkOperation[] = [];

    try {
      const files = await fs.readdir(bulkOpsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const opData = await fs.readFile(join(bulkOpsDir, file), 'utf-8');
            const operation = JSON.parse(opData);
            operations.push(operation);
          } catch {
            // Skip invalid operation files
          }
        }
      }
    } catch {
      // Bulk operations directory doesn't exist yet
    }

    // Sort by timestamp (most recent first)
    operations.sort((a, b) => {
      const aTime = a.log[0]?.timestamp || '';
      const bTime = b.log[0]?.timestamp || '';
      return bTime.localeCompare(aTime);
    });

    return NextResponse.json({
      operations: operations.slice(0, 20), // Return last 20 operations
      message: `Found ${operations.length} bulk operations`
    });
  } catch (error) {
    console.error('Failed to list bulk operations:', error);
    return NextResponse.json(
      { error: 'Failed to list bulk operations' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to convert a job from copy mode to reference mode
 */
async function convertJobCopyToReference(
  jobId: string, 
  config: FileManagementPolicy, 
  backupFolder?: string
): Promise<MigrationLogEntry> {
  // Find the job file
  const jobPath = await findJobFile(jobId, config.rootDirectory);
  if (!jobPath) {
    throw new Error(`Job file not found for ID: ${jobId}`);
  }

  // Load job data
  const jobData: JobDescription = JSON.parse(await fs.readFile(jobPath, 'utf-8'));
  const jobDir = dirname(jobPath);

  // Create backup if requested
  if (backupFolder) {
    const jobBackupDir = join(backupFolder, jobData.uuid);
    await fs.mkdir(jobBackupDir, { recursive: true });
    await fs.copyFile(jobPath, join(jobBackupDir, 'job.json'));
  }

  // Find attachment files in the job directory
  const attachmentFiles = await fs.readdir(jobDir);
  const attachmentPaths: { [key: string]: string } = {};
  const removedFiles: string[] = [];

  for (const file of attachmentFiles) {
    if (file !== 'job.json' && file !== 'job.txt') {
      const filePath = join(jobDir, file);
      
      // Try to find original location (this would need to be enhanced)
      // For now, we'll reference the current location as a fallback
      let originalPath = filePath;
      
      // Check if this was originally a copied file
      if ((jobData as any).attachment_paths && (jobData as any).attachment_paths[file]) {
        originalPath = (jobData as any).attachment_paths[file];
      }

      attachmentPaths[file] = originalPath;
      
      // Remove the copied file
      if (backupFolder) {
        await fs.copyFile(filePath, join(backupFolder, jobData.uuid, file));
      }
      await fs.unlink(filePath);
      removedFiles.push(filePath);
    }
  }

  // Update job data
  const updatedJobData = {
    ...jobData,
    attachment_mode: 'reference',
    attachment_paths: attachmentPaths,
    converted_to_reference: true,
    converted_at: new Date().toISOString()
  };

  await fs.writeFile(jobPath, JSON.stringify(updatedJobData, null, 2));

  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action: 'copy',
    sourcePath: jobPath,
    targetPath: jobPath,
    jobId: jobData.uuid,
    canUndo: true,
    undoData: {
      originalAttachmentMode: 'copy',
      removedFiles,
      backupLocation: backupFolder ? join(backupFolder, jobData.uuid) : undefined
    }
  };
}

/**
 * Helper function to convert a job from reference mode to copy mode
 */
async function convertJobReferenceToCopy(
  jobId: string, 
  config: FileManagementPolicy, 
  backupFolder?: string
): Promise<MigrationLogEntry> {
  // Find the job file
  const jobPath = await findJobFile(jobId, config.rootDirectory);
  if (!jobPath) {
    throw new Error(`Job file not found for ID: ${jobId}`);
  }

  // Load job data
  const jobData: JobDescription = JSON.parse(await fs.readFile(jobPath, 'utf-8'));
  const jobDir = dirname(jobPath);

  // Create backup if requested
  if (backupFolder) {
    const jobBackupDir = join(backupFolder, jobData.uuid);
    await fs.mkdir(jobBackupDir, { recursive: true });
    await fs.copyFile(jobPath, join(jobBackupDir, 'job.json'));
  }

  const copiedFiles: string[] = [];
  const attachmentPaths: { [key: string]: string } = {};

  // Copy referenced files into job directory
  if ((jobData as any).attachment_paths) {
    for (const [fileName, referencePath] of Object.entries((jobData as any).attachment_paths)) {
      try {
        const targetPath = join(jobDir, fileName);
        await fs.copyFile(referencePath as string, targetPath);
        copiedFiles.push(targetPath);
        attachmentPaths[fileName] = targetPath;
      } catch (error) {
        console.warn(`Failed to copy referenced file ${referencePath}:`, error);
        // Keep the reference if copy fails
        attachmentPaths[fileName] = referencePath as string;
      }
    }
  }

  // Update job data
  const updatedJobData = {
    ...jobData,
    attachment_mode: 'copy',
    attachment_paths: attachmentPaths,
    converted_to_copy: true,
    converted_at: new Date().toISOString()
  };

  await fs.writeFile(jobPath, JSON.stringify(updatedJobData, null, 2));

  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action: 'copy',
    sourcePath: jobPath,
    targetPath: jobPath,
    jobId: jobData.uuid,
    canUndo: true,
    undoData: {
      originalAttachmentMode: 'reference',
      copiedFiles,
      originalReferences: (jobData as any).attachment_paths
    }
  };
}

/**
 * Helper function to find a job file by ID
 */
async function findJobFile(jobId: string, rootPath: string): Promise<string | null> {
  try {
    // First try direct UUID match
    const directPath = join(rootPath, `${jobId}.json`);
    try {
      await fs.access(directPath);
      return directPath;
    } catch {
      // Not in root, search subdirectories
    }

    // Search in company folders
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const companyPath = join(rootPath, entry.name);
        const subEntries = await fs.readdir(companyPath, { withFileTypes: true });
        
        for (const subEntry of subEntries) {
          if (subEntry.isDirectory()) {
            const jobPath = join(companyPath, subEntry.name, 'job.json');
            try {
              const jobData = JSON.parse(await fs.readFile(jobPath, 'utf-8'));
              if (jobData.uuid === jobId) {
                return jobPath;
              }
            } catch {
              // Skip invalid job files
            }
          }
        }
      }
    }
  } catch {
    // Root path doesn't exist
  }

  return null;
}

/**
 * Helper function to save bulk operation log
 */
async function saveBulkOperationLog(operation: BulkOperation, config: FileManagementPolicy): Promise<void> {
  const bulkOpsDir = join(config.migrationLogPath, 'bulk-operations');
  await fs.mkdir(bulkOpsDir, { recursive: true });
  
  const logPath = join(bulkOpsDir, `${operation.id}.json`);
  await fs.writeFile(logPath, JSON.stringify(operation, null, 2));
}