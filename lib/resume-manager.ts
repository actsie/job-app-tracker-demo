import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ResumeManifestEntry, ResumeVersionEntry, ResumeConfig, JobDescription } from './types';
import { resumeVersioningService } from './resume-versioning';

const DEFAULT_MANAGED_FOLDER = join(process.cwd(), 'managed-resumes');
const MANIFEST_FILE = join(process.cwd(), 'resume-manifest.json');
const CONFIG_FILE = join(process.cwd(), 'resume-config.json');

const DEFAULT_CONFIG: ResumeConfig = {
  managed_folder_path: DEFAULT_MANAGED_FOLDER,
  keep_original_default: true,
  supported_file_types: ['.pdf', '.doc', '.docx', '.rtf', '.txt'],
  naming_format: 'Company_Role_Date'
};

export class ResumeManagerService {
  private config: ResumeConfig;
  private manifest: ResumeManifestEntry[];

  constructor() {
    this.config = DEFAULT_CONFIG;
    this.manifest = [];
  }

  async loadConfig(): Promise<ResumeConfig> {
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
    } catch {
      this.config = DEFAULT_CONFIG;
    }
    return this.config;
  }

  async saveConfig(config: ResumeConfig): Promise<void> {
    this.config = config;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  async loadManifest(): Promise<ResumeManifestEntry[]> {
    try {
      const manifestData = await fs.readFile(MANIFEST_FILE, 'utf-8');
      this.manifest = JSON.parse(manifestData);
    } catch {
      this.manifest = [];
    }
    return this.manifest;
  }

  async saveManifest(): Promise<void> {
    await fs.writeFile(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  async ensureManagedDirectory(): Promise<void> {
    try {
      await fs.access(this.config.managed_folder_path);
    } catch {
      await fs.mkdir(this.config.managed_folder_path, { recursive: true });
    }
  }

  validateFileType(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return this.config.supported_file_types.includes(ext);
  }

  async calculateFileChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  generateManagedFilename(company: string, role: string, extension: string, yourName: string = ''): string {
    const sanitizeString = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    const now = new Date();
    
    const sanitizedCompany = sanitizeString(company);
    const sanitizedRole = sanitizeString(role);
    const sanitizedName = yourName.trim() ? sanitizeString(yourName.trim()) : '';
    
    if (this.config.naming_format === 'Company_Role_Date_Time') {
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const nameSection = sanitizedName ? `_${sanitizedName}` : '';
      return `${sanitizedCompany}_${sanitizedRole}${nameSection}_${date}_${time}${extension}`;
    } else {
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const nameSection = sanitizedName ? `_${sanitizedName}` : '';
      return `${sanitizedCompany}_${sanitizedRole}${nameSection}_${date}${extension}`;
    }
  }

  async uploadResume(
    filePath: string,
    jobUuid: string,
    company: string,
    role: string,
    keepOriginal: boolean = this.config.keep_original_default,
    yourName: string = ''
  ): Promise<ResumeManifestEntry> {
    // Load current config and manifest
    await this.loadConfig();
    await this.loadManifest();
    await this.ensureManagedDirectory();

    const originalFilename = basename(filePath);
    const fileExtension = extname(filePath);

    // Validate file type
    if (!this.validateFileType(originalFilename)) {
      throw new Error(`Unsupported file type. Supported types: ${this.config.supported_file_types.join(', ')}`);
    }

    try {
      const sanitizeString = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const sanitizedCompany = sanitizeString(company.trim());
      const sanitizedRole = sanitizeString(role.trim());

      // Check if an entry already exists for this job/company/role/date combination
      const existingEntry = resumeVersioningService.findExistingEntry(
        this.manifest,
        jobUuid,
        sanitizedCompany,
        sanitizedRole,
        date
      );

      let manifestEntry: ResumeManifestEntry;
      let addedVersion: ResumeVersionEntry;

      if (existingEntry) {
        // Add new version to existing entry
        addedVersion = await resumeVersioningService.addVersionToEntry(
          existingEntry,
          filePath,
          this.config.managed_folder_path,
          originalFilename,
          keepOriginal
        );
        manifestEntry = existingEntry;
      } else {
        // Create new entry with first version
        manifestEntry = await resumeVersioningService.createNewEntry(
          jobUuid,
          sanitizedCompany,
          sanitizedRole,
          fileExtension,
          filePath,
          this.config.managed_folder_path,
          originalFilename,
          keepOriginal,
          yourName
        );
        
        // Add to manifest
        this.manifest.push(manifestEntry);
        addedVersion = manifestEntry.versions[0];
      }

      // Save manifest
      await this.saveManifest();

      // Remove original if not keeping
      if (!keepOriginal) {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(`Warning: Could not remove original file ${filePath}:`, error);
          // Don't fail the entire operation if we can't remove the original
        }
      }

      return manifestEntry;

    } catch (error) {
      // Cleanup will be handled by the versioning service
      await resumeVersioningService.cleanup();
      
      if (error instanceof Error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
          throw new Error('Permission denied: Unable to write to managed folder. Check folder permissions.');
        }
        if (nodeError.code === 'ENOSPC') {
          throw new Error('Not enough disk space to copy the resume file.');
        }
      }
      throw error;
    }
  }

  async getResumesByJobUuid(jobUuid: string): Promise<ResumeManifestEntry[]> {
    await this.loadManifest();
    return this.manifest.filter(entry => entry.job_uuid === jobUuid);
  }

  async getAllResumes(): Promise<ResumeManifestEntry[]> {
    await this.loadManifest();
    return [...this.manifest];
  }

  async getResumeById(resumeId: string): Promise<ResumeManifestEntry | null> {
    await this.loadManifest();
    const resume = this.manifest.find(entry => entry.id === resumeId);
    return resume || null;
  }

  async deleteResume(resumeId: string): Promise<void> {
    await this.loadManifest();
    
    const entryIndex = this.manifest.findIndex(entry => entry.id === resumeId);
    if (entryIndex === -1) {
      throw new Error('Resume not found in manifest');
    }

    const entry = this.manifest[entryIndex];
    
    try {
      // Remove all version files
      for (const version of entry.versions) {
        try {
          await fs.unlink(version.managed_path);
        } catch (error) {
          console.warn(`Warning: Could not remove managed file ${version.managed_path}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Warning: Error during file cleanup:`, error);
    }

    // Remove from manifest
    this.manifest.splice(entryIndex, 1);
    await this.saveManifest();
  }

  /**
   * Gets version history for a specific resume entry
   */
  async getVersionHistory(resumeId: string): Promise<ResumeVersionEntry[]> {
    await this.loadManifest();
    
    const entry = this.manifest.find(e => e.id === resumeId);
    if (!entry) {
      throw new Error('Resume not found in manifest');
    }

    return resumeVersioningService.getVersionHistory(entry);
  }

  /**
   * Gets the active version of a resume entry
   */
  async getActiveVersion(resumeId: string): Promise<ResumeVersionEntry | null> {
    await this.loadManifest();
    
    const entry = this.manifest.find(e => e.id === resumeId);
    if (!entry) {
      throw new Error('Resume not found in manifest');
    }

    return resumeVersioningService.getActiveVersion(entry);
  }

  /**
   * Rolls back a resume to a previous version
   */
  async rollbackToVersion(resumeId: string, targetVersionId: string): Promise<ResumeVersionEntry> {
    await this.loadConfig();
    await this.loadManifest();
    await this.ensureManagedDirectory();

    const entry = this.manifest.find(e => e.id === resumeId);
    if (!entry) {
      throw new Error('Resume not found in manifest');
    }

    try {
      const rollbackVersion = await resumeVersioningService.rollbackToVersion(
        entry,
        targetVersionId,
        this.config.managed_folder_path
      );

      // Save updated manifest
      await this.saveManifest();

      return rollbackVersion;
    } catch (error) {
      await resumeVersioningService.cleanup();
      throw error;
    }
  }

  /**
   * Queries version history by job UUID
   */
  async getVersionHistoryByJob(jobUuid: string): Promise<{ entry: ResumeManifestEntry; versions: ResumeVersionEntry[] }[]> {
    await this.loadManifest();
    
    const jobEntries = this.manifest.filter(entry => entry.job_uuid === jobUuid);
    
    return jobEntries.map(entry => ({
      entry,
      versions: resumeVersioningService.getVersionHistory(entry)
    }));
  }

  /**
   * Gets all version entries across all resumes for comprehensive history
   */
  async getAllVersionHistory(): Promise<{ entry: ResumeManifestEntry; versions: ResumeVersionEntry[] }[]> {
    await this.loadManifest();
    
    return this.manifest.map(entry => ({
      entry,
      versions: resumeVersioningService.getVersionHistory(entry)
    }));
  }
}

export const resumeManager = new ResumeManagerService();