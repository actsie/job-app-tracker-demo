import { promises as fs } from 'fs';
import { join, basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BulkImportOperation, BulkImportPreview, JobDescription, ResumeConfig } from './types';
import { resumeManager } from './resume-manager';
import { operationsLog } from './operations-log';

const BULK_IMPORT_TEMP_FILE = join(process.cwd(), 'bulk-import-temp.json');

export class BulkImportService {
  private currentOperation: BulkImportOperation | null = null;

  async scanFolder(folderPath: string): Promise<string[]> {
    try {
      await fs.access(folderPath);
    } catch {
      throw new Error('Folder does not exist or is not accessible');
    }

    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const config = await resumeManager.loadConfig();
    
    return entries
      .filter(entry => entry.isFile())
      .filter(entry => {
        const ext = extname(entry.name).toLowerCase();
        return config.supported_file_types.includes(ext);
      })
      .map(entry => join(folderPath, entry.name));
  }

  async createPreview(
    folderPath: string, 
    availableJobs: JobDescription[]
  ): Promise<BulkImportOperation> {
    const filePaths = await this.scanFolder(folderPath);
    
    const previewItems: BulkImportPreview[] = await Promise.all(
      filePaths.map(async (filePath) => {
        const filename = basename(filePath);
        const proposedMapping = this.suggestJobMapping(filename, availableJobs);
        
        return {
          id: uuidv4(),
          original_filename: filename,
          original_path: filePath,
          proposed_filename: proposedMapping ? 
            this.generateProposedFilename(proposedMapping.company || '', proposedMapping.role || '', extname(filename)) : 
            filename,
          job_mapping: proposedMapping,
          status: proposedMapping ? 'mapped' : 'pending'
        };
      })
    );

    this.currentOperation = {
      id: uuidv4(),
      source_folder: folderPath,
      preview_items: previewItems,
      created_at: new Date().toISOString(),
      status: 'preview'
    };

    // Save preview to temp file
    await fs.writeFile(BULK_IMPORT_TEMP_FILE, JSON.stringify(this.currentOperation, null, 2), 'utf-8');

    return this.currentOperation;
  }

  async loadCurrentPreview(): Promise<BulkImportOperation | null> {
    try {
      const previewData = await fs.readFile(BULK_IMPORT_TEMP_FILE, 'utf-8');
      this.currentOperation = JSON.parse(previewData);
      return this.currentOperation;
    } catch {
      return null;
    }
  }

  async updatePreviewItem(itemId: string, updates: Partial<BulkImportPreview>): Promise<void> {
    if (!this.currentOperation) {
      throw new Error('No active bulk import operation');
    }

    const item = this.currentOperation.preview_items.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Preview item not found');
    }

    Object.assign(item, updates);

    // Regenerate proposed filename if company/role changed
    if (updates.manual_company || updates.manual_role || updates.job_mapping) {
      const company = updates.manual_company || updates.job_mapping?.company || '';
      const role = updates.manual_role || updates.job_mapping?.role || '';
      const extension = extname(item.original_filename);
      
      item.proposed_filename = this.generateProposedFilename(company, role, extension);
      item.status = 'mapped';
    }

    // Save updated preview
    await fs.writeFile(BULK_IMPORT_TEMP_FILE, JSON.stringify(this.currentOperation, null, 2), 'utf-8');
  }

  async executeImport(): Promise<{
    successful: string[];
    failed: { filename: string; error: string }[];
  }> {
    if (!this.currentOperation) {
      throw new Error('No active bulk import operation');
    }

    const successful: string[] = [];
    const failed: { filename: string; error: string }[] = [];
    const processedFiles: string[] = [];
    const createdEntries: string[] = [];

    try {
      for (const item of this.currentOperation.preview_items) {
        if (item.status !== 'mapped') {
          failed.push({
            filename: item.original_filename,
            error: 'Item not properly mapped'
          });
          continue;
        }

        const company = item.manual_company || item.job_mapping?.company || '';
        const role = item.manual_role || item.job_mapping?.role || '';
        const jobUuid = item.job_mapping?.uuid || '';

        if (!company || !role || !jobUuid) {
          failed.push({
            filename: item.original_filename,
            error: 'Missing company, role, or job UUID'
          });
          continue;
        }

        try {
          const manifestEntry = await resumeManager.uploadResume(
            item.original_path,
            jobUuid,
            company,
            role,
            true // Always keep original for bulk imports
          );

          successful.push(item.original_filename);
          processedFiles.push(item.original_path);
          createdEntries.push(manifestEntry.id);

        } catch (error) {
          failed.push({
            filename: item.original_filename,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Log the bulk import operation
      await operationsLog.logOperation('bulk_import', {
        source_paths: processedFiles,
        manifest_entries: createdEntries,
        user_action: `Bulk import from ${this.currentOperation.source_folder}`
      }, true);

      // Mark operation as completed
      this.currentOperation.status = 'completed';
      await fs.writeFile(BULK_IMPORT_TEMP_FILE, JSON.stringify(this.currentOperation, null, 2), 'utf-8');

    } catch (error) {
      // Log failed operation
      await operationsLog.logOperation('bulk_import', {
        source_paths: processedFiles,
        manifest_entries: createdEntries,
        user_action: `Failed bulk import from ${this.currentOperation.source_folder}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, false);

      throw error;
    }

    return { successful, failed };
  }

  async cancelOperation(): Promise<void> {
    this.currentOperation = null;
    try {
      await fs.unlink(BULK_IMPORT_TEMP_FILE);
    } catch {
      // File might not exist, that's okay
    }
  }

  private suggestJobMapping(filename: string, availableJobs: JobDescription[]): JobDescription | undefined {
    const fileBasename = basename(filename, extname(filename)).toLowerCase();
    
    // Score each job based on how well it matches the filename
    const jobScores = availableJobs.map(job => {
      let score = 0;
      
      if (job.company) {
        const companyWords = job.company.toLowerCase().split(/\s+/);
        companyWords.forEach(word => {
          if (fileBasename.includes(word)) {
            score += word.length; // Longer words get higher score
          }
        });
      }
      
      if (job.role) {
        const roleWords = job.role.toLowerCase().split(/\s+/);
        roleWords.forEach(word => {
          if (fileBasename.includes(word)) {
            score += word.length;
          }
        });
      }
      
      return { job, score };
    });

    // Return the job with the highest score if it's above threshold
    const bestMatch = jobScores.reduce((best, current) => 
      current.score > best.score ? current : best,
      { job: undefined as JobDescription | undefined, score: 0 }
    );

    // Only suggest if score is meaningful (at least 3 characters matched)
    return bestMatch.score >= 3 ? bestMatch.job : undefined;
  }

  private generateProposedFilename(company: string, role: string, extension: string): string {
    const sanitizeString = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const sanitizedCompany = sanitizeString(company.trim());
    const sanitizedRole = sanitizeString(role.trim());
    
    return `${sanitizedCompany}_${sanitizedRole}_${date}${extension}`;
  }
}

export const bulkImportService = new BulkImportService();