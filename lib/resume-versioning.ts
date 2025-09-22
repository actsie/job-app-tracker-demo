import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ResumeManifestEntry, ResumeVersionEntry, ResumeConfig } from './types';

const VERSIONING_LOCK_FILE = join(process.cwd(), '.resume-versioning.lock');
const LOCK_TIMEOUT_MS = 10000; // 10 seconds

export class ResumeVersioningService {
  private lockAcquired = false;

  /**
   * Acquires an atomic lock for version number assignment
   * Prevents concurrent uploads from creating duplicate version numbers
   */
  private async acquireLock(): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
      try {
        // Try to create lock file with exclusive flag
        await fs.writeFile(VERSIONING_LOCK_FILE, process.pid.toString(), { flag: 'wx' });
        this.lockAcquired = true;
        return;
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'EEXIST') {
          // Lock file exists, check if the process is still running
          try {
            const lockPid = parseInt(await fs.readFile(VERSIONING_LOCK_FILE, 'utf-8'));
            // Check if process is still running (this is a simplified check)
            if (lockPid === process.pid) {
              // We already own the lock
              this.lockAcquired = true;
              return;
            }
            // Try to remove stale lock (in production, you'd want more robust process checking)
            try {
              process.kill(lockPid, 0);
              // Process is running, wait and retry
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch {
              // Process not running, remove stale lock
              await fs.unlink(VERSIONING_LOCK_FILE);
            }
          } catch {
            // Lock file corrupted, remove it
            try {
              await fs.unlink(VERSIONING_LOCK_FILE);
            } catch {
              // Ignore deletion errors
            }
          }
        } else {
          throw error;
        }
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error('Could not acquire version lock within timeout period');
  }

  /**
   * Releases the atomic lock
   */
  private async releaseLock(): Promise<void> {
    if (this.lockAcquired) {
      try {
        await fs.unlink(VERSIONING_LOCK_FILE);
        this.lockAcquired = false;
      } catch {
        // Ignore deletion errors
      }
    }
  }

  /**
   * Determines the next version suffix for a given base filename
   * Returns empty string for first version, "_v1", "_v2", etc. for subsequent versions
   */
  async getNextVersionSuffix(
    baseFilename: string,
    fileExtension: string,
    managedFolderPath: string
  ): Promise<string> {
    await this.acquireLock();
    
    try {
      // Check what files already exist with this base name
      let versionNumber = 0;
      let versionSuffix = '';
      
      while (true) {
        const testFilename = `${baseFilename}${versionSuffix}${fileExtension}`;
        const testPath = join(managedFolderPath, testFilename);
        
        try {
          await fs.access(testPath);
          // File exists, try next version
          versionNumber++;
          versionSuffix = `_v${versionNumber}`;
        } catch {
          // File doesn't exist, we can use this version
          break;
        }
      }
      
      return versionSuffix;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Creates a file checksum for duplicate detection
   */
  async calculateFileChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Finds existing resume entry by job UUID, company, role, and date
   */
  findExistingEntry(
    manifest: ResumeManifestEntry[],
    jobUuid: string,
    company: string,
    role: string,
    date: string
  ): ResumeManifestEntry | null {
    return manifest.find(entry => 
      entry.job_uuid === jobUuid &&
      entry.filename_components.company === company &&
      entry.filename_components.role === role &&
      entry.filename_components.date === date
    ) || null;
  }

  /**
   * Adds a new version to an existing resume entry
   */
  async addVersionToEntry(
    entry: ResumeManifestEntry,
    filePath: string,
    managedFolderPath: string,
    originalFilename: string,
    keepOriginal: boolean
  ): Promise<ResumeVersionEntry> {
    const versionSuffix = await this.getNextVersionSuffix(
      entry.base_filename,
      entry.file_extension,
      managedFolderPath
    );
    
    const managedFilename = `${entry.base_filename}${versionSuffix}${entry.file_extension}`;
    const managedPath = join(managedFolderPath, managedFilename);
    
    // Copy file to managed location
    await fs.copyFile(filePath, managedPath);
    
    // Calculate checksum
    const checksum = await this.calculateFileChecksum(managedPath);
    
    // Create version entry
    const versionEntry: ResumeVersionEntry = {
      version_id: uuidv4(),
      version_suffix: versionSuffix,
      managed_path: managedPath,
      file_checksum: checksum,
      upload_timestamp: new Date().toISOString(),
      original_path: filePath,
      original_filename: originalFilename,
      is_active: true // New version becomes active
    };
    
    // Deactivate previous active version
    entry.versions.forEach(v => v.is_active = false);
    
    // Add new version
    entry.versions.push(versionEntry);
    entry.last_updated = new Date().toISOString();
    
    return versionEntry;
  }

  /**
   * Creates a new resume entry with the first version
   */
  async createNewEntry(
    jobUuid: string,
    company: string,
    role: string,
    fileExtension: string,
    filePath: string,
    managedFolderPath: string,
    originalFilename: string,
    keepOriginal: boolean,
    yourName: string = ''
  ): Promise<ResumeManifestEntry> {
    const sanitizeString = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const sanitizedCompany = sanitizeString(company);
    const sanitizedRole = sanitizeString(role);
    const sanitizedName = yourName.trim() ? sanitizeString(yourName.trim()) : '';
    const nameSection = sanitizedName ? `_${sanitizedName}` : '';
    const baseFilename = `${sanitizedCompany}_${sanitizedRole}${nameSection}_${date}`;
    
    // Get version suffix (should be empty string for first version)
    const versionSuffix = await this.getNextVersionSuffix(
      baseFilename,
      fileExtension,
      managedFolderPath
    );
    
    const managedFilename = `${baseFilename}${versionSuffix}${fileExtension}`;
    const managedPath = join(managedFolderPath, managedFilename);
    
    // Copy file to managed location
    await fs.copyFile(filePath, managedPath);
    
    // Calculate checksum
    const checksum = await this.calculateFileChecksum(managedPath);
    
    // Create version entry
    const versionEntry: ResumeVersionEntry = {
      version_id: uuidv4(),
      version_suffix: versionSuffix,
      managed_path: managedPath,
      file_checksum: checksum,
      upload_timestamp: new Date().toISOString(),
      original_path: filePath,
      original_filename: originalFilename,
      is_active: true
    };
    
    // Create manifest entry
    const manifestEntry: ResumeManifestEntry = {
      id: uuidv4(),
      job_uuid: jobUuid,
      base_filename: baseFilename,
      filename_components: {
        company,
        role,
        date
      },
      file_extension: fileExtension,
      keep_original: keepOriginal,
      versions: [versionEntry],
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };
    
    return manifestEntry;
  }

  /**
   * Rolls back to a previous version by making it active and creating a new version entry
   */
  async rollbackToVersion(
    entry: ResumeManifestEntry,
    targetVersionId: string,
    managedFolderPath: string
  ): Promise<ResumeVersionEntry> {
    const targetVersion = entry.versions.find(v => v.version_id === targetVersionId);
    if (!targetVersion) {
      throw new Error('Target version not found');
    }
    
    // Verify target file still exists
    try {
      await fs.access(targetVersion.managed_path);
    } catch {
      throw new Error('Target version file no longer exists');
    }
    
    // Get next version suffix for the rollback
    const versionSuffix = await this.getNextVersionSuffix(
      entry.base_filename,
      entry.file_extension,
      managedFolderPath
    );
    
    const newManagedFilename = `${entry.base_filename}${versionSuffix}${entry.file_extension}`;
    const newManagedPath = join(managedFolderPath, newManagedFilename);
    
    // Copy the target version to become the new active version
    await fs.copyFile(targetVersion.managed_path, newManagedPath);
    
    // Calculate checksum of the rolled-back file
    const checksum = await this.calculateFileChecksum(newManagedPath);
    
    // Create new version entry for the rollback
    const rollbackVersionEntry: ResumeVersionEntry = {
      version_id: uuidv4(),
      version_suffix: versionSuffix,
      managed_path: newManagedPath,
      file_checksum: checksum,
      upload_timestamp: new Date().toISOString(),
      original_path: targetVersion.original_path, // Preserve original path reference
      original_filename: `ROLLBACK_TO_${targetVersion.version_suffix || 'original'}_${targetVersion.original_filename}`,
      is_active: true
    };
    
    // Deactivate all current versions
    entry.versions.forEach(v => v.is_active = false);
    
    // Add rollback version
    entry.versions.push(rollbackVersionEntry);
    entry.last_updated = new Date().toISOString();
    
    return rollbackVersionEntry;
  }

  /**
   * Gets version history for a resume entry
   */
  getVersionHistory(entry: ResumeManifestEntry): ResumeVersionEntry[] {
    return [...entry.versions].sort((a, b) => 
      new Date(a.upload_timestamp).getTime() - new Date(b.upload_timestamp).getTime()
    );
  }

  /**
   * Gets the active version of a resume entry
   */
  getActiveVersion(entry: ResumeManifestEntry): ResumeVersionEntry | null {
    return entry.versions.find(v => v.is_active) || null;
  }

  /**
   * Cleanup method to ensure lock is released
   */
  async cleanup(): Promise<void> {
    await this.releaseLock();
  }
}

export const resumeVersioningService = new ResumeVersioningService();