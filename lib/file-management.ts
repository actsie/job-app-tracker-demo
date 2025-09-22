import { promises as fs } from 'fs';
import { join, dirname, basename, extname, relative, resolve } from 'path';
import { createHash } from 'crypto';
import { JobDescription } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface FileManagementPolicy {
  rootDirectory: string;
  attachmentMode: 'copy' | 'reference';
  folderNaming: 'Company_Role_Date' | 'Role_Company_Date' | 'Date_Company_Role';
  conflictResolution: 'rename' | 'overwrite' | 'skip' | 'prompt';
  createBackups: boolean;
  migrationLogPath: string;
}

export interface JobFolderPreview {
  computedPath: string;
  company: string;
  role: string;
  date: string;
  attachmentHandling: {
    mode: 'copy' | 'reference';
    expectedFiles: string[];
  };
}

export interface ImportableJob {
  id: string;
  originalPath: string;
  fileName: string;
  detectedJob?: Partial<JobDescription>;
  proposedFolder: string;
  status: 'detected' | 'mapped' | 'conflict' | 'ready' | 'imported' | 'failed';
  conflicts?: ConflictInfo[];
  errorMessage?: string;
}

export interface ConflictInfo {
  type: 'folder_exists' | 'file_exists' | 'invalid_path';
  conflictPath: string;
  resolution?: 'rename' | 'overwrite' | 'skip';
  suggestedName?: string;
}

export interface MigrationResult {
  operationId: string;
  timestamp: string;
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  log: MigrationLogEntry[];
  backupFolder?: string;
}

export interface MigrationLogEntry {
  id: string;
  timestamp: string;
  action: 'import' | 'copy' | 'reference' | 'rename' | 'skip' | 'error' | 'undo';
  sourcePath: string;
  targetPath?: string;
  jobId?: string;
  error?: string;
  canUndo: boolean;
  undoData?: any;
}

export interface BulkOperation {
  id: string;
  type: 'copy_to_reference' | 'reference_to_copy' | 'move_root' | 'reorganize';
  targetJobs: string[];
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  log: MigrationLogEntry[];
}

export class FileManagementService {
  private policy: FileManagementPolicy;

  constructor(policy: FileManagementPolicy) {
    this.policy = policy;
  }

  /**
   * Sanitizes a string to be safe for filesystem use
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\./, '_')
      .substring(0, 100)
      .replace(/\.$/, '');
  }

  /**
   * Generates folder name based on policy
   */
  generateFolderName(job: Partial<JobDescription>): string {
    const company = this.sanitizeFilename(job.company || 'Unknown_Company');
    const role = this.sanitizeFilename(job.role || 'Unknown_Role');
    const date = job.applied_date || job.fetched_at_iso?.split('T')[0] || new Date().toISOString().split('T')[0];
    const formattedDate = date.replace(/-/g, '');

    switch (this.policy.folderNaming) {
      case 'Role_Company_Date':
        return `${role}_${company}_${formattedDate}`;
      case 'Date_Company_Role':
        return `${formattedDate}_${company}_${role}`;
      case 'Company_Role_Date':
      default:
        return `${company}_${role}_${formattedDate}`;
    }
  }

  /**
   * Computes the full path for a job folder
   */
  computeJobPath(job: Partial<JobDescription>): string {
    const folderName = this.generateFolderName(job);
    return join(this.policy.rootDirectory, folderName);
  }

  /**
   * Creates a preview of the folder structure for a job
   */
  createJobFolderPreview(job: Partial<JobDescription>): JobFolderPreview {
    const computedPath = this.computeJobPath(job);
    const expectedFiles = ['job.json', 'job.txt'];
    
    if (this.policy.attachmentMode === 'copy') {
      expectedFiles.push('resume.pdf', 'jd.html', 'snapshot-*.png');
    }

    return {
      computedPath,
      company: job.company || 'Unknown Company',
      role: job.role || 'Unknown Role',
      date: job.applied_date || job.fetched_at_iso?.split('T')[0] || new Date().toISOString().split('T')[0],
      attachmentHandling: {
        mode: this.policy.attachmentMode,
        expectedFiles
      }
    };
  }

  /**
   * Scans directory for importable job files
   */
  async scanForImportableJobs(sourceDirectory: string): Promise<ImportableJob[]> {
    const importableJobs: ImportableJob[] = [];
    
    try {
      const entries = await this.scanDirectoryRecursive(sourceDirectory);
      
      for (const entry of entries) {
        if (this.isJobFile(entry.path)) {
          const importableJob = await this.analyzeJobFile(entry.path);
          if (importableJob) {
            importableJobs.push(importableJob);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
      throw new Error(`Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return this.deduplicateImportableJobs(importableJobs);
  }

  /**
   * Recursively scans directory structure
   */
  private async scanDirectoryRecursive(dir: string): Promise<{ path: string; isFile: boolean }[]> {
    const results: { path: string; isFile: boolean }[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          results.push({ path: fullPath, isFile: false });
          results.push(...await this.scanDirectoryRecursive(fullPath));
        } else {
          results.push({ path: fullPath, isFile: true });
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return results;
  }

  /**
   * Checks if a file is a potential job file
   */
  private isJobFile(filePath: string): boolean {
    const filename = basename(filePath).toLowerCase();
    const ext = extname(filename);
    
    return (
      filename === 'job.json' ||
      filename.endsWith('.json') ||
      filename.includes('job') ||
      filename.includes('jd') ||
      ext === '.txt' ||
      ext === '.html'
    );
  }

  /**
   * Analyzes a potential job file and extracts information
   */
  private async analyzeJobFile(filePath: string): Promise<ImportableJob | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = basename(filePath);
      
      let detectedJob: Partial<JobDescription> = {};
      
      if (fileName.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.uuid || parsed.company || parsed.role) {
            detectedJob = parsed;
          }
        } catch {
          // Not a valid JSON job file
        }
      } else {
        // Try to extract company/role from filename or content
        detectedJob = this.extractJobInfoFromContent(filePath, content);
      }

      if (!detectedJob.company && !detectedJob.role && !detectedJob.jd_text) {
        return null; // Not a recognizable job file
      }

      const proposedFolder = this.computeJobPath(detectedJob);
      
      return {
        id: uuidv4(),
        originalPath: filePath,
        fileName,
        detectedJob,
        proposedFolder,
        status: 'detected'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extracts job information from file content
   */
  private extractJobInfoFromContent(filePath: string, content: string): Partial<JobDescription> {
    const fileName = basename(filePath, extname(filePath));
    const job: Partial<JobDescription> = {};
    
    // Try to extract from filename patterns
    const patterns = [
      /^(.+?)_(.+?)_(\d{8})$/,  // Company_Role_Date
      /^(.+?) - (.+?) - (\d{4}-\d{2}-\d{2})$/, // Company - Role - Date
      /^(\d{4}-\d{2}-\d{2}) - (.+?) - (.+?)$/, // Date - Company - Role
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        if (pattern.source.startsWith('^\\d')) {
          // Date first pattern
          job.applied_date = match[1];
          job.company = match[2];
          job.role = match[3];
        } else {
          // Company first patterns
          job.company = match[1];
          job.role = match[2];
          job.applied_date = match[3];
        }
        break;
      }
    }

    // Extract text content
    if (content.length > 50) {
      job.jd_text = content.substring(0, 5000); // Limit size
    }

    // Try to extract company/role from content if not found in filename
    if (!job.company || !job.role) {
      const companyPatterns = [
        /company:\s*(.+)/i,
        /employer:\s*(.+)/i,
        /@(\w+\.\w+)/,  // Email domain
      ];
      
      const rolePatterns = [
        /position:\s*(.+)/i,
        /role:\s*(.+)/i,
        /job title:\s*(.+)/i,
        /title:\s*(.+)/i,
      ];

      for (const pattern of companyPatterns) {
        const match = content.match(pattern);
        if (match && !job.company) {
          job.company = match[1].trim().substring(0, 100);
          break;
        }
      }

      for (const pattern of rolePatterns) {
        const match = content.match(pattern);
        if (match && !job.role) {
          job.role = match[1].trim().substring(0, 100);
          break;
        }
      }
    }

    return job;
  }

  /**
   * Deduplicates importable jobs based on content similarity
   */
  private deduplicateImportableJobs(jobs: ImportableJob[]): ImportableJob[] {
    const deduplicated: ImportableJob[] = [];
    const seen = new Set<string>();

    for (const job of jobs) {
      const key = this.generateDeduplicationKey(job);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(job);
      }
    }

    return deduplicated;
  }

  /**
   * Generates a key for deduplication
   */
  private generateDeduplicationKey(job: ImportableJob): string {
    const company = job.detectedJob?.company || '';
    const role = job.detectedJob?.role || '';
    const content = job.detectedJob?.jd_text || '';
    
    const contentHash = content ? createHash('md5').update(content).digest('hex').substring(0, 8) : '';
    return `${company}_${role}_${contentHash}`.toLowerCase();
  }

  /**
   * Checks for conflicts when importing jobs
   */
  async checkForConflicts(jobs: ImportableJob[]): Promise<ImportableJob[]> {
    const updatedJobs: ImportableJob[] = [];

    for (const job of jobs) {
      const conflicts: ConflictInfo[] = [];
      
      // Check if target folder exists
      try {
        await fs.access(job.proposedFolder);
        conflicts.push({
          type: 'folder_exists',
          conflictPath: job.proposedFolder,
          suggestedName: `${job.proposedFolder}_${Date.now()}`
        });
      } catch {
        // Folder doesn't exist, which is good
      }

      // Check if critical files exist
      const criticalFiles = ['job.json', 'job.txt'];
      for (const file of criticalFiles) {
        const filePath = join(job.proposedFolder, file);
        try {
          await fs.access(filePath);
          conflicts.push({
            type: 'file_exists',
            conflictPath: filePath,
            suggestedName: `${basename(filePath, extname(filePath))}_${Date.now()}${extname(filePath)}`
          });
        } catch {
          // File doesn't exist, which is good
        }
      }

      updatedJobs.push({
        ...job,
        status: conflicts.length > 0 ? 'conflict' : 'ready',
        conflicts
      });
    }

    return updatedJobs;
  }

  /**
   * Executes the import process for approved jobs
   */
  async executeImport(jobs: ImportableJob[], options: {
    handleConflicts?: boolean;
    createBackup?: boolean;
  } = {}): Promise<MigrationResult> {
    const operationId = uuidv4();
    const log: MigrationLogEntry[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const backupFolder = options.createBackup 
      ? join(this.policy.rootDirectory, '_backups', `import_${operationId}`)
      : undefined;

    if (backupFolder) {
      await fs.mkdir(backupFolder, { recursive: true });
    }

    for (const job of jobs) {
      try {
        if (job.status === 'conflict' && !options.handleConflicts) {
          skipped++;
          log.push({
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            action: 'skip',
            sourcePath: job.originalPath,
            jobId: job.id,
            canUndo: false
          });
          continue;
        }

        const result = await this.importSingleJob(job, { backupFolder });
        successful++;
        log.push(result);
      } catch (error) {
        failed++;
        log.push({
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          action: 'error',
          sourcePath: job.originalPath,
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canUndo: false
        });
      }
    }

    const result: MigrationResult = {
      operationId,
      timestamp: new Date().toISOString(),
      totalFiles: jobs.length,
      successful,
      failed,
      skipped,
      log,
      backupFolder
    };

    // Save migration log
    await this.saveMigrationLog(result);
    
    return result;
  }

  /**
   * Imports a single job
   */
  private async importSingleJob(job: ImportableJob, options: { backupFolder?: string }): Promise<MigrationLogEntry> {
    const targetFolder = job.proposedFolder;
    await fs.mkdir(targetFolder, { recursive: true });

    // Create job.json
    const jobData: JobDescription = {
      uuid: uuidv4(),
      company: job.detectedJob?.company || null,
      role: job.detectedJob?.role || null,
      jd_text: job.detectedJob?.jd_text || '',
      source_url: job.detectedJob?.source_url || null,
      fetched_at_iso: new Date().toISOString(),
      content_hash: createHash('sha256').update(job.detectedJob?.jd_text || '').digest('hex'),
      capture_method: 'manual',
      imported_from: job.originalPath,
      imported_at: new Date().toISOString()
    };

    const jobJsonPath = join(targetFolder, 'job.json');
    const jobTxtPath = join(targetFolder, 'job.txt');

    await Promise.all([
      fs.writeFile(jobJsonPath, JSON.stringify(jobData, null, 2)),
      fs.writeFile(jobTxtPath, this.generateJobTxtContent(jobData))
    ]);

    // Handle attachments based on policy
    if (this.policy.attachmentMode === 'copy') {
      await this.copyRelatedFiles(job.originalPath, targetFolder);
    }

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action: 'import',
      sourcePath: job.originalPath,
      targetPath: targetFolder,
      jobId: jobData.uuid,
      canUndo: true,
      undoData: {
        targetFolder,
        createdFiles: [jobJsonPath, jobTxtPath]
      }
    };
  }

  /**
   * Copies related files to the target directory
   */
  private async copyRelatedFiles(sourcePath: string, targetFolder: string): Promise<void> {
    const sourceDir = dirname(sourcePath);
    const sourceBasename = basename(sourcePath, extname(sourcePath));
    
    try {
      const files = await fs.readdir(sourceDir);
      
      for (const file of files) {
        const filePath = join(sourceDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile() && this.isRelatedFile(file, sourceBasename)) {
          const targetPath = join(targetFolder, this.normalizeAttachmentFilename(file));
          await fs.copyFile(filePath, targetPath);
        }
      }
    } catch (error) {
      // Ignore errors in copying related files
    }
  }

  /**
   * Checks if a file is related to the source job file
   */
  private isRelatedFile(filename: string, sourceBasename: string): boolean {
    const lowerFilename = filename.toLowerCase();
    const lowerBasename = sourceBasename.toLowerCase();
    
    return (
      filename !== sourceBasename &&
      (lowerFilename.includes('resume') ||
       lowerFilename.includes('cv') ||
       lowerFilename.includes(lowerBasename) ||
       lowerFilename.endsWith('.pdf') ||
       lowerFilename.endsWith('.doc') ||
       lowerFilename.endsWith('.docx'))
    );
  }

  /**
   * Normalizes attachment filenames
   */
  private normalizeAttachmentFilename(filename: string): string {
    const ext = extname(filename);
    const base = basename(filename, ext).toLowerCase();
    
    if (base.includes('resume') || base.includes('cv')) {
      return `resume${ext}`;
    }
    
    return filename;
  }

  /**
   * Generates human-readable job.txt content
   */
  private generateJobTxtContent(job: JobDescription): string {
    const lines = [
      `Job Application: ${job.role || 'Unknown Role'}`,
      `Company: ${job.company || 'Unknown Company'}`,
      `Date Saved: ${new Date(job.fetched_at_iso).toLocaleDateString()}`,
      `Status: ${job.application_status || 'N/A'}`,
      `Applied Date: ${job.applied_date ? new Date(job.applied_date).toLocaleDateString() : 'N/A'}`,
      '',
    ];

    if (job.source_url) {
      lines.push(`Source URL: ${job.source_url}`, '');
    }

    if ((job as any).imported_from) {
      lines.push(`Imported from: ${(job as any).imported_from}`, '');
    }

    lines.push('Job Description:', '---', job.jd_text);

    return lines.join('\n');
  }

  /**
   * Saves migration log to disk
   */
  private async saveMigrationLog(result: MigrationResult): Promise<void> {
    const logPath = join(this.policy.migrationLogPath, `migration_${result.operationId}.json`);
    await fs.mkdir(dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, JSON.stringify(result, null, 2));
  }

  /**
   * Updates the policy configuration
   */
  updatePolicy(updates: Partial<FileManagementPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Gets the current policy
   */
  getPolicy(): FileManagementPolicy {
    return { ...this.policy };
  }
}

// Helper function to create file management service
export const createFileManagementService = (policy: FileManagementPolicy): FileManagementService => {
  return new FileManagementService(policy);
};

// Default policy configuration
export const getDefaultFileManagementPolicy = (): FileManagementPolicy => {
  return {
    rootDirectory: join(process.cwd(), 'job-applications'),
    attachmentMode: 'copy',
    folderNaming: 'Company_Role_Date',
    conflictResolution: 'prompt',
    createBackups: true,
    migrationLogPath: join(process.cwd(), 'migration-logs')
  };
};