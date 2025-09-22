import { ResumeManifestEntry, ResumeVersionEntry, JobDescription } from './types';

interface ResumeUploadResult {
  success: boolean;
  resumeId: string;
  filename: string;
  managedPath?: string;
  error?: string;
}

interface ResumeNamingOptions {
  company: string;
  role: string;
  date?: string;
  keepOriginal?: boolean;
  format?: 'Company_Role_Date' | 'Company_Role_Date_Time';
}

export class ResumeManager {
  private manifestPath = '/tmp/resume-manifest.json';

  /**
   * Generate filename based on naming convention
   */
  generateResumeFilename(options: ResumeNamingOptions): string {
    const { company, role, date, format = 'Company_Role_Date' } = options;
    
    // Clean company and role names for filename
    const cleanCompany = company.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    const cleanRole = role.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    
    // Use provided date or current date
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (format === 'Company_Role_Date_Time') {
      const timeStr = targetDate.toISOString().split('T')[1].replace(/[:.]/g, '').slice(0, 6);
      return `${cleanCompany}_${cleanRole}_${dateStr}_${timeStr}`;
    }
    
    return `${cleanCompany}_${cleanRole}_${dateStr}`;
  }

  /**
   * Process and save resume file with proper naming
   */
  async processResumeUpload(
    file: File, 
    job: Partial<JobDescription>,
    options: { keepOriginal?: boolean; managedFolder?: string } = {}
  ): Promise<ResumeUploadResult> {
    try {
      if (!job.company || !job.role) {
        return {
          success: false,
          resumeId: '',
          filename: file.name,
          error: 'Company and role are required for resume processing'
        };
      }

      // Generate new filename
      const baseName = this.generateResumeFilename({
        company: job.company,
        role: job.role,
        date: job.applied_date,
        keepOriginal: options.keepOriginal
      });

      // Get file extension
      const ext = file.name.split('.').pop() || 'pdf';
      const newFilename = `${baseName}.${ext}`;

      // Create resume entry
      const resumeId = crypto.randomUUID();
      const versionEntry: ResumeVersionEntry = {
        version_id: crypto.randomUUID(),
        version_suffix: '',
        managed_path: options.managedFolder ? `${options.managedFolder}/${newFilename}` : newFilename,
        file_checksum: await this.calculateFileChecksum(file),
        upload_timestamp: new Date().toISOString(),
        original_path: file.name,
        original_filename: file.name,
        mime_type: file.type || this.detectMimeTypeFromExtension(ext),
        is_active: true
      };

      const manifestEntry: ResumeManifestEntry = {
        id: resumeId,
        job_uuid: job.uuid || '',
        base_filename: baseName,
        filename_components: {
          company: job.company,
          role: job.role,
          date: job.applied_date || new Date().toISOString().split('T')[0]
        },
        file_extension: ext,
        keep_original: options.keepOriginal || false,
        versions: [versionEntry],
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      // Save to manifest
      await this.saveToManifest(manifestEntry);

      // If we have a managed folder, copy/move the file
      let managedPath: string | undefined;
      if (options.managedFolder) {
        managedPath = await this.saveResumeFile(file, `${options.managedFolder}/${newFilename}`);
      }

      return {
        success: true,
        resumeId,
        filename: newFilename,
        managedPath
      };

    } catch (error) {
      console.error('Resume upload processing failed:', error);
      return {
        success: false,
        resumeId: '',
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get resume information for a job
   */
  async getResumeForJob(jobUuid: string): Promise<ResumeManifestEntry | null> {
    try {
      const manifest = await this.loadManifest();
      return manifest.find(entry => entry.job_uuid === jobUuid) || null;
    } catch (error) {
      console.error('Failed to get resume for job:', error);
      return null;
    }
  }

  /**
   * List all resumes for a specific job or all jobs
   */
  async listResumes(jobUuid?: string): Promise<ResumeManifestEntry[]> {
    try {
      const manifest = await this.loadManifest();
      return jobUuid ? 
        manifest.filter(entry => entry.job_uuid === jobUuid) : 
        manifest;
    } catch (error) {
      console.error('Failed to list resumes:', error);
      return [];
    }
  }

  /**
   * Open resume file (implementation depends on platform)
   */
  async openResume(resumeId: string): Promise<boolean> {
    try {
      const manifest = await this.loadManifest();
      const resume = manifest.find(entry => entry.id === resumeId);
      
      if (!resume || !resume.versions.length) {
        return false;
      }

      const activeVersion = resume.versions.find(v => v.is_active) || resume.versions[0];
      
      // Use file management API to open the resume
      const response = await fetch('/api/file-actions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: activeVersion.managed_path })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to open resume:', error);
      return false;
    }
  }

  /**
   * Delete resume and clean up files
   */
  async deleteResume(resumeId: string): Promise<boolean> {
    try {
      const manifest = await this.loadManifest();
      const resumeIndex = manifest.findIndex(entry => entry.id === resumeId);
      
      if (resumeIndex === -1) {
        return false;
      }

      const resume = manifest[resumeIndex];
      
      // Delete files
      for (const version of resume.versions) {
        try {
          await fetch('/api/file-actions/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: version.managed_path })
          });
        } catch (error) {
          console.warn('Failed to delete resume file:', version.managed_path, error);
        }
      }

      // Remove from manifest
      manifest.splice(resumeIndex, 1);
      await this.saveManifest(manifest);

      return true;
    } catch (error) {
      console.error('Failed to delete resume:', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private detectMimeTypeFromExtension(ext: string): string {
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'txt': 'text/plain',
      'rtf': 'application/rtf'
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }

  private async calculateFileChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async saveResumeFile(file: File, targetPath: string): Promise<string> {
    // This would need to be implemented with proper file system access
    // For now, we'll use the browser's File System Access API if available
    // or fall back to a download/manual save approach
    
    // Create a blob URL for the file
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    
    // For now, return the blob URL - in a real implementation,
    // this would save to the actual file system
    return url;
  }

  private async loadManifest(): Promise<ResumeManifestEntry[]> {
    try {
      const saved = localStorage.getItem('resume_manifest');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load resume manifest:', error);
      return [];
    }
  }

  private async saveManifest(manifest: ResumeManifestEntry[]): Promise<void> {
    localStorage.setItem('resume_manifest', JSON.stringify(manifest));
  }

  private async saveToManifest(entry: ResumeManifestEntry): Promise<void> {
    const manifest = await this.loadManifest();
    const existingIndex = manifest.findIndex(e => e.id === entry.id);
    
    if (existingIndex >= 0) {
      manifest[existingIndex] = entry;
    } else {
      manifest.push(entry);
    }
    
    await this.saveManifest(manifest);
  }
}

export const resumeManager = new ResumeManager();

/**
 * Helper function to get resume display info
 */
export function getResumeDisplayInfo(resume: ResumeManifestEntry): string {
  const { company, role, date } = resume.filename_components;
  return `${company} - ${role} (${new Date(date).toLocaleDateString()})`;
}

/**
 * Helper function to validate resume file
 */
export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not supported. Please upload PDF, DOC, DOCX, or TXT files.' };
  }

  return { valid: true };
}