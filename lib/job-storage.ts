import { promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { createHash } from 'crypto';
import { JobDescription } from './types';

export interface JobStorageConfig {
  rootPath: string;
  attachmentMode: 'copy' | 'reference';
  generateSnapshots: boolean;
  customNaming?: string;
}

export interface AttachmentFile {
  type: 'resume' | 'job_description' | 'screenshot' | 'other';
  originalPath: string;
  filename?: string;
  content?: Buffer | string;
}

export interface JobStorageResult {
  folderPath: string;
  jobJsonPath: string;
  jobTxtPath: string;
  attachmentPaths: {
    [key: string]: string;
  };
  snapshotPaths: string[];
}

export class JobStorageManager {
  private config: JobStorageConfig;

  constructor(config: JobStorageConfig) {
    this.config = config;
  }

  /**
   * Creates the folder structure for a job: /rootPath/Company/Role_Date/
   */
  private generateJobFolder(job: JobDescription): string {
    const company = this.sanitizeFilename(job.company || 'Unknown_Company');
    const role = this.sanitizeFilename(job.role || 'Unknown_Role');
    const date = job.applied_date || job.fetched_at_iso.split('T')[0];
    const formattedDate = date.replace(/-/g, '');
    
    const folderName = `${role}_${formattedDate}`;
    return join(this.config.rootPath, company, folderName);
  }

  /**
   * Sanitizes a string to be safe for use as a filename/folder name
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100); // Limit length
  }

  /**
   * Ensures directory exists, creating it if necessary
   */
  private async ensureDirectory(path: string): Promise<void> {
    try {
      await fs.access(path);
    } catch {
      await fs.mkdir(path, { recursive: true });
    }
  }

  /**
   * Calculates content hash for duplicate detection
   */
  private calculateContentHash(content: Buffer | string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Normalizes resume filename to resume.<original-ext>
   */
  private normalizeResumeFilename(originalPath: string): string {
    const ext = extname(originalPath).toLowerCase();
    return `resume${ext}`;
  }

  /**
   * Generates a snapshot filename with timestamp
   */
  private generateSnapshotFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `snapshot-${timestamp}.png`;
  }

  /**
   * Copies a file to the destination directory
   */
  private async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await this.ensureDirectory(dirname(destPath));
    const content = await fs.readFile(sourcePath);
    await fs.writeFile(destPath, content);
  }

  /**
   * Handles attachment files based on configuration (copy vs reference)
   */
  private async handleAttachment(
    attachment: AttachmentFile,
    jobFolder: string
  ): Promise<{ localPath?: string; referencePath?: string; contentHash?: string }> {
    let filename: string;
    
    // Determine filename based on attachment type
    switch (attachment.type) {
      case 'resume':
        filename = this.normalizeResumeFilename(attachment.originalPath);
        break;
      case 'job_description':
        filename = attachment.filename || 'jd.html';
        break;
      case 'screenshot':
        filename = attachment.filename || this.generateSnapshotFilename();
        break;
      default:
        filename = attachment.filename || basename(attachment.originalPath);
    }

    if (this.config.attachmentMode === 'copy') {
      const localPath = join(jobFolder, filename);
      
      if (attachment.content) {
        // Content provided directly
        await this.ensureDirectory(jobFolder);
        await fs.writeFile(localPath, attachment.content);
      } else {
        // Copy from original path
        await this.copyFile(attachment.originalPath, localPath);
      }

      // Calculate content hash for resumes
      let contentHash: string | undefined;
      if (attachment.type === 'resume') {
        const content = await fs.readFile(localPath);
        contentHash = this.calculateContentHash(content);
      }

      return { localPath, contentHash };
    } else {
      // Reference mode - store original absolute path
      return { referencePath: attachment.originalPath };
    }
  }

  /**
   * Generates human-readable job.txt file content
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

    lines.push('Job Description:', '---', job.jd_text);

    return lines.join('\n');
  }

  /**
   * Main method to save a job with attachments to structured folder
   */
  async saveJob(
    job: JobDescription,
    attachments: AttachmentFile[] = [],
    generateSnapshot: boolean = false
  ): Promise<JobStorageResult> {
    const jobFolder = this.generateJobFolder(job);
    await this.ensureDirectory(jobFolder);

    const result: JobStorageResult = {
      folderPath: jobFolder,
      jobJsonPath: join(jobFolder, 'job.json'),
      jobTxtPath: join(jobFolder, 'job.txt'),
      attachmentPaths: {},
      snapshotPaths: [],
    };

    // Handle attachments
    for (const attachment of attachments) {
      try {
        const handledAttachment = await this.handleAttachment(attachment, jobFolder);
        
        if (handledAttachment.localPath) {
          result.attachmentPaths[attachment.type] = handledAttachment.localPath;
          
          // Add content hash to job metadata for resumes
          if (attachment.type === 'resume' && handledAttachment.contentHash) {
            (job as any).resume_content_hash = handledAttachment.contentHash;
          }
        } else if (handledAttachment.referencePath) {
          result.attachmentPaths[attachment.type] = handledAttachment.referencePath;
        }
      } catch (error) {
        console.warn(`Failed to handle attachment ${attachment.type}:`, error);
      }
    }

    // Generate snapshot if requested
    if (generateSnapshot && this.config.generateSnapshots) {
      const snapshotFilename = this.generateSnapshotFilename();
      const snapshotPath = join(jobFolder, snapshotFilename);
      result.snapshotPaths.push(snapshotPath);
      
      // Add snapshot info to job metadata
      (job as any).snapshot_filename = snapshotFilename;
      (job as any).snapshot_timestamp = new Date().toISOString();
    }

    // Create enhanced job object with storage metadata
    const jobWithStorage = {
      ...job,
      storage_folder: jobFolder,
      attachment_mode: this.config.attachmentMode,
      attachment_paths: result.attachmentPaths,
      snapshot_paths: result.snapshotPaths,
      saved_to_disk: true,
      disk_save_timestamp: new Date().toISOString(),
    };

    // Write job.json and job.txt
    await Promise.all([
      fs.writeFile(result.jobJsonPath, JSON.stringify(jobWithStorage, null, 2), 'utf-8'),
      fs.writeFile(result.jobTxtPath, this.generateJobTxtContent(job), 'utf-8'),
    ]);

    return result;
  }

  /**
   * Creates a snapshot PNG file (placeholder - would integrate with actual screenshot functionality)
   */
  async createSnapshot(jobFolder: string, content?: Buffer): Promise<string> {
    const snapshotFilename = this.generateSnapshotFilename();
    const snapshotPath = join(jobFolder, snapshotFilename);
    
    if (content) {
      await fs.writeFile(snapshotPath, content);
    } else {
      // Placeholder for actual screenshot functionality
      const placeholderContent = Buffer.from('PNG placeholder for job snapshot');
      await fs.writeFile(snapshotPath, placeholderContent);
    }
    
    return snapshotPath;
  }

  /**
   * Updates the storage configuration
   */
  updateConfig(config: Partial<JobStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): JobStorageConfig {
    return { ...this.config };
  }
}

// Default storage manager instance
export const createJobStorageManager = (config: JobStorageConfig): JobStorageManager => {
  return new JobStorageManager(config);
};

// Helper function to get default storage config
export const getDefaultStorageConfig = (): JobStorageConfig => {
  return {
    rootPath: join(process.cwd(), 'job-applications'),
    attachmentMode: 'copy',
    generateSnapshots: true,
  };
};