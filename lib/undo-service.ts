import { promises as fs } from 'fs';
import { OperationLogEntry } from './types';
import { operationsLog } from './operations-log';
import { resumeManager } from './resume-manager';

export class UndoService {
  async getUndoableOperations(): Promise<OperationLogEntry[]> {
    return operationsLog.getUndoableOperations();
  }

  async undoOperation(operationId: string): Promise<void> {
    const undoableOps = await operationsLog.getUndoableOperations();
    const operation = undoableOps.find(op => op.id === operationId);
    
    if (!operation) {
      throw new Error('Operation not found or cannot be undone');
    }

    try {
      switch (operation.operation_type) {
        case 'upload':
          await this.undoUpload(operation);
          break;
        case 'bulk_import':
          await this.undoBulkImport(operation);
          break;
        case 'delete':
          await this.undoDelete(operation);
          break;
        default:
          throw new Error(`Undo not supported for operation type: ${operation.operation_type}`);
      }

      // Mark operation as undone
      await operationsLog.markOperationAsUndone(operationId);

      // Log the undo operation
      await operationsLog.logOperation('rollback', {
        user_action: `Undone operation: ${operation.operation_type}`,
        manifest_entries: operation.details.manifest_entries
      }, false);

    } catch (error) {
      throw new Error(`Failed to undo operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async undoUpload(operation: OperationLogEntry): Promise<void> {
    const { manifest_entries, target_paths } = operation.details;
    
    if (manifest_entries && manifest_entries.length > 0) {
      // Remove manifest entries
      for (const entryId of manifest_entries) {
        try {
          await resumeManager.deleteResume(entryId);
        } catch (error) {
          console.warn(`Failed to remove manifest entry ${entryId}:`, error);
        }
      }
    }

    if (target_paths && target_paths.length > 0) {
      // Remove copied files
      for (const filePath of target_paths) {
        try {
          await fs.access(filePath);
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(`Failed to remove file ${filePath}:`, error);
        }
      }
    }
  }

  private async undoBulkImport(operation: OperationLogEntry): Promise<void> {
    const { manifest_entries, target_paths } = operation.details;
    
    if (manifest_entries && manifest_entries.length > 0) {
      // Remove all manifest entries created by bulk import
      for (const entryId of manifest_entries) {
        try {
          await resumeManager.deleteResume(entryId);
        } catch (error) {
          console.warn(`Failed to remove bulk import manifest entry ${entryId}:`, error);
        }
      }
    }

    if (target_paths && target_paths.length > 0) {
      // Remove all copied files
      for (const filePath of target_paths) {
        try {
          await fs.access(filePath);
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(`Failed to remove bulk import file ${filePath}:`, error);
        }
      }
    }
  }

  private async undoDelete(operation: OperationLogEntry): Promise<void> {
    // For deletes, we would need to have backed up the files/entries
    // This is a complex operation that requires careful design
    throw new Error('Undo delete operation not yet implemented');
  }

  async canUndoOperation(operationId: string): Promise<boolean> {
    const undoableOps = await operationsLog.getUndoableOperations();
    return undoableOps.some(op => op.id === operationId);
  }
}

export const undoService = new UndoService();