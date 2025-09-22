import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { FileManagementPolicy, getDefaultFileManagementPolicy, BulkOperation, MigrationLogEntry } from '@/lib/file-management';
import { v4 as uuidv4 } from 'uuid';

const CONFIG_FILE = join(process.cwd(), 'file-management-config.json');

/**
 * GET /api/file-management/undo
 * Lists available undo operations
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

    const undoableOperations: Array<{
      id: string;
      type: string;
      timestamp: string;
      description: string;
      canUndo: boolean;
      undoData?: any;
    }> = [];

    // Check migration logs
    const migrationLogDir = config.migrationLogPath;
    try {
      const files = await fs.readdir(migrationLogDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const logPath = join(migrationLogDir, file);
            const logData = await fs.readFile(logPath, 'utf-8');
            const migrationResult = JSON.parse(logData);
            
            if (migrationResult.log) {
              for (const entry of migrationResult.log) {
                if (entry.canUndo) {
                  undoableOperations.push({
                    id: entry.id,
                    type: 'migration',
                    timestamp: entry.timestamp,
                    description: `${entry.action}: ${entry.sourcePath}`,
                    canUndo: true,
                    undoData: entry.undoData
                  });
                }
              }
            }
          } catch {
            // Skip invalid log files
          }
        }
      }
    } catch {
      // Migration log directory doesn't exist
    }

    // Check bulk operation logs
    const bulkOpsDir = join(config.migrationLogPath, 'bulk-operations');
    try {
      const files = await fs.readdir(bulkOpsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const opPath = join(bulkOpsDir, file);
            const opData = await fs.readFile(opPath, 'utf-8');
            const operation: BulkOperation = JSON.parse(opData);
            
            if (operation.log) {
              for (const entry of operation.log) {
                if (entry.canUndo) {
                  undoableOperations.push({
                    id: entry.id,
                    type: 'bulk_operation',
                    timestamp: entry.timestamp,
                    description: `${operation.type}: ${entry.action}`,
                    canUndo: true,
                    undoData: entry.undoData
                  });
                }
              }
            }
          } catch {
            // Skip invalid operation files
          }
        }
      }
    } catch {
      // Bulk operations directory doesn't exist
    }

    // Sort by timestamp (most recent first)
    undoableOperations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return NextResponse.json({
      operations: undoableOperations.slice(0, 50), // Return last 50 undoable operations
      message: `Found ${undoableOperations.length} undoable operations`
    });
  } catch (error) {
    console.error('Failed to list undoable operations:', error);
    return NextResponse.json(
      { error: 'Failed to list undoable operations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/file-management/undo
 * Executes an undo operation
 */
export async function POST(request: NextRequest) {
  try {
    const { operationId }: { operationId: string } = await request.json();

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID is required' },
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

    // Find the operation to undo
    const undoResult = await findAndExecuteUndo(operationId, config);

    if (!undoResult.found) {
      return NextResponse.json(
        { error: 'Operation not found or cannot be undone' },
        { status: 404 }
      );
    }

    // Log the undo operation
    const undoLogEntry: MigrationLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action: 'undo',
      sourcePath: undoResult.originalPath || 'unknown',
      targetPath: undoResult.undoPath,
      canUndo: false, // Undo operations cannot themselves be undone
      undoData: {
        originalOperationId: operationId,
        undoType: undoResult.undoType
      }
    };

    await logUndoOperation(undoLogEntry, config);

    return NextResponse.json({
      success: true,
      message: undoResult.message,
      undoLog: undoLogEntry
    });
  } catch (error) {
    console.error('Failed to execute undo:', error);
    return NextResponse.json(
      { error: `Failed to execute undo: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Helper function to find and execute an undo operation
 */
async function findAndExecuteUndo(operationId: string, config: FileManagementPolicy): Promise<{
  found: boolean;
  message?: string;
  originalPath?: string;
  undoPath?: string;
  undoType?: string;
}> {
  // Search in migration logs
  const migrationLogDir = config.migrationLogPath;
  try {
    const files = await fs.readdir(migrationLogDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const logPath = join(migrationLogDir, file);
          const logData = await fs.readFile(logPath, 'utf-8');
          const migrationResult = JSON.parse(logData);
          
          if (migrationResult.log) {
            for (const entry of migrationResult.log) {
              if (entry.id === operationId && entry.canUndo) {
                const undoResult = await executeUndoForEntry(entry);
                return {
                  found: true,
                  message: undoResult.message,
                  originalPath: entry.sourcePath,
                  undoPath: entry.targetPath,
                  undoType: 'migration'
                };
              }
            }
          }
        } catch {
          // Skip invalid log files
        }
      }
    }
  } catch {
    // Migration log directory doesn't exist
  }

  // Search in bulk operation logs
  const bulkOpsDir = join(config.migrationLogPath, 'bulk-operations');
  try {
    const files = await fs.readdir(bulkOpsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const opPath = join(bulkOpsDir, file);
          const opData = await fs.readFile(opPath, 'utf-8');
          const operation: BulkOperation = JSON.parse(opData);
          
          if (operation.log) {
            for (const entry of operation.log) {
              if (entry.id === operationId && entry.canUndo) {
                const undoResult = await executeUndoForEntry(entry);
                return {
                  found: true,
                  message: undoResult.message,
                  originalPath: entry.sourcePath,
                  undoPath: entry.targetPath,
                  undoType: 'bulk_operation'
                };
              }
            }
          }
        } catch {
          // Skip invalid operation files
        }
      }
    }
  } catch {
    // Bulk operations directory doesn't exist
  }

  return { found: false };
}

/**
 * Helper function to execute undo for a specific log entry
 */
async function executeUndoForEntry(entry: MigrationLogEntry): Promise<{ message: string }> {
  const undoData = entry.undoData;
  
  switch (entry.action) {
    case 'import':
      // Undo import: remove created folder and files
      if (undoData?.targetFolder) {
        try {
          await fs.rm(undoData.targetFolder, { recursive: true });
          return { message: `Removed imported job folder: ${undoData.targetFolder}` };
        } catch (error) {
          throw new Error(`Failed to remove imported folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      break;

    case 'copy':
      // Undo copy operation - this depends on the specific type of copy
      if (undoData?.originalAttachmentMode === 'copy' && undoData?.backupLocation) {
        // Restore from backup
        try {
          const jobPath = entry.targetPath;
          if (jobPath) {
            const backupFiles = await fs.readdir(undoData.backupLocation);
            for (const file of backupFiles) {
              const sourcePath = join(undoData.backupLocation, file);
              const targetPath = join(dirname(jobPath), file);
              await fs.copyFile(sourcePath, targetPath);
            }
            
            // Update job.json to reflect original mode
            const jobJsonPath = join(dirname(jobPath), 'job.json');
            const jobData = JSON.parse(await fs.readFile(jobJsonPath, 'utf-8'));
            jobData.attachment_mode = 'copy';
            delete jobData.converted_to_reference;
            delete jobData.converted_at;
            await fs.writeFile(jobJsonPath, JSON.stringify(jobData, null, 2));
          }
          
          return { message: 'Restored files from backup and updated job metadata' };
        } catch (error) {
          throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (undoData?.originalAttachmentMode === 'reference' && undoData?.copiedFiles) {
        // Remove copied files and restore references
        try {
          const jobPath = entry.targetPath;
          if (jobPath) {
            // Remove copied files
            for (const filePath of undoData.copiedFiles) {
              try {
                await fs.unlink(filePath);
              } catch {
                // File might not exist, continue
              }
            }
            
            // Update job.json to reflect reference mode
            const jobJsonPath = join(dirname(jobPath), 'job.json');
            const jobData = JSON.parse(await fs.readFile(jobJsonPath, 'utf-8'));
            jobData.attachment_mode = 'reference';
            jobData.attachment_paths = undoData.originalReferences;
            delete jobData.converted_to_copy;
            delete jobData.converted_at;
            await fs.writeFile(jobJsonPath, JSON.stringify(jobData, null, 2));
          }
          
          return { message: 'Removed copied files and restored reference paths' };
        } catch (error) {
          throw new Error(`Failed to restore reference mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      break;

    default:
      throw new Error(`Cannot undo action: ${entry.action}`);
  }

  throw new Error('No undo data available for this operation');
}

/**
 * Helper function to log undo operations
 */
async function logUndoOperation(entry: MigrationLogEntry, config: FileManagementPolicy): Promise<void> {
  const undoLogDir = join(config.migrationLogPath, 'undo-operations');
  await fs.mkdir(undoLogDir, { recursive: true });
  
  const logPath = join(undoLogDir, `undo_${entry.id}.json`);
  await fs.writeFile(logPath, JSON.stringify(entry, null, 2));
}