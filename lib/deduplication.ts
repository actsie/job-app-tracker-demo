import { promises as fs } from 'fs';
import { join } from 'path';
import { compareTwoStrings } from 'string-similarity';
import { 
  JobDescription, 
  DuplicateMatch, 
  DuplicateGroup, 
  DeduplicationResult, 
  DeduplicationConfig,
  MergeHistoryEntry 
} from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_DIR = join(process.cwd(), 'job-descriptions');
const ARCHIVE_DIR = join(STORAGE_DIR, 'archived');
const CONFIG_FILE = join(process.cwd(), 'deduplication-config.json');

const DEFAULT_CONFIG: DeduplicationConfig = {
  similarity_threshold: 0.8,
  auto_merge_threshold: 0.95,
  schedule_enabled: false,
  schedule_interval: 60, // 1 hour
  comparison_fields: ['jd_text', 'company', 'role']
};

export class DeduplicationService {
  private config: DeduplicationConfig;

  constructor() {
    this.config = DEFAULT_CONFIG;
  }

  async loadConfig(): Promise<DeduplicationConfig> {
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
    } catch {
      // Use default config if file doesn't exist
      this.config = DEFAULT_CONFIG;
    }
    return this.config;
  }

  async saveConfig(config: DeduplicationConfig): Promise<void> {
    this.config = config;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  async getAllJobDescriptions(): Promise<JobDescription[]> {
    try {
      const files = await fs.readdir(STORAGE_DIR);
      const jsonFiles = files.filter(file => file.endsWith('.json') && !file.startsWith('.'));
      
      const jobs: JobDescription[] = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = join(STORAGE_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const job: JobDescription = JSON.parse(content);
          
          // Skip archived jobs
          if (!job.is_archived) {
            jobs.push(job);
          }
        } catch (error) {
          console.warn(`Failed to parse job description file: ${file}`, error);
        }
      }
      
      return jobs;
    } catch (error) {
      console.error('Failed to load job descriptions:', error);
      return [];
    }
  }

  calculateSimilarity(job1: JobDescription, job2: JobDescription): number {
    const weights = {
      jd_text: 0.7,
      company: 0.2,
      role: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    if (this.config.comparison_fields.includes('jd_text')) {
      const textSimilarity = compareTwoStrings(
        job1.jd_text.toLowerCase(),
        job2.jd_text.toLowerCase()
      );
      totalScore += textSimilarity * weights.jd_text;
      totalWeight += weights.jd_text;
    }

    if (this.config.comparison_fields.includes('company') && job1.company && job2.company) {
      const companySimilarity = compareTwoStrings(
        job1.company.toLowerCase(),
        job2.company.toLowerCase()
      );
      totalScore += companySimilarity * weights.company;
      totalWeight += weights.company;
    }

    if (this.config.comparison_fields.includes('role') && job1.role && job2.role) {
      const roleSimilarity = compareTwoStrings(
        job1.role.toLowerCase(),
        job2.role.toLowerCase()
      );
      totalScore += roleSimilarity * weights.role;
      totalWeight += weights.role;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  async findDuplicates(targetJob?: JobDescription): Promise<DeduplicationResult> {
    await this.loadConfig();
    const allJobs = await this.getAllJobDescriptions();
    
    if (allJobs.length === 0) {
      return {
        duplicate_groups: [],
        total_duplicates_found: 0,
        threshold_used: this.config.similarity_threshold,
        processed_at: new Date().toISOString()
      };
    }

    const duplicateGroups: DuplicateGroup[] = [];
    const processedJobs = new Set<string>();

    // If targetJob is provided, only check for duplicates of that job
    const jobsToCheck = targetJob ? [targetJob] : allJobs;

    for (const primaryJob of jobsToCheck) {
      if (processedJobs.has(primaryJob.uuid)) continue;

      const duplicates: DuplicateMatch[] = [];
      
      for (const otherJob of allJobs) {
        if (otherJob.uuid === primaryJob.uuid) continue;
        if (targetJob && processedJobs.has(otherJob.uuid)) continue;

        const similarity = this.calculateSimilarity(primaryJob, otherJob);
        
        if (similarity >= this.config.similarity_threshold) {
          duplicates.push({
            uuid: otherJob.uuid,
            similarity_score: similarity,
            job_description: otherJob
          });
          
          if (!targetJob) {
            processedJobs.add(otherJob.uuid);
          }
        }
      }

      if (duplicates.length > 0) {
        const maxSimilarity = Math.max(...duplicates.map(d => d.similarity_score));
        
        duplicateGroups.push({
          id: uuidv4(),
          primary_job: primaryJob,
          duplicates,
          max_similarity: maxSimilarity,
          created_at: new Date().toISOString()
        });

        if (!targetJob) {
          processedJobs.add(primaryJob.uuid);
        }
      }
    }

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0);

    return {
      duplicate_groups: duplicateGroups,
      total_duplicates_found: totalDuplicates,
      threshold_used: this.config.similarity_threshold,
      processed_at: new Date().toISOString()
    };
  }

  async ensureArchiveDirectory(): Promise<void> {
    try {
      await fs.access(ARCHIVE_DIR);
    } catch {
      await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    }
  }

  async mergeJobs(primaryUuid: string, duplicateUuids: string[], userAction?: string): Promise<JobDescription> {
    const allJobs = await this.getAllJobDescriptions();
    const primaryJob = allJobs.find(job => job.uuid === primaryUuid);
    const duplicateJobs = allJobs.filter(job => duplicateUuids.includes(job.uuid));

    if (!primaryJob) {
      throw new Error('Primary job not found');
    }

    if (duplicateJobs.length === 0) {
      throw new Error('No duplicate jobs found');
    }

    await this.ensureArchiveDirectory();

    // Create merge history entry
    const mergeEntry: MergeHistoryEntry = {
      timestamp: new Date().toISOString(),
      action: 'merge',
      source_uuids: duplicateUuids,
      user_action: userAction,
      original_file_paths: []
    };

    // Archive duplicate files
    for (const dupJob of duplicateJobs) {
      const originalJsonPath = join(STORAGE_DIR, `${dupJob.uuid}.json`);
      const originalTxtPath = join(STORAGE_DIR, `${dupJob.uuid}.txt`);
      const originalHtmlPath = dupJob.source_html_path;

      const archivedJsonPath = join(ARCHIVE_DIR, `${dupJob.uuid}.json`);
      const archivedTxtPath = join(ARCHIVE_DIR, `${dupJob.uuid}.txt`);

      try {
        // Move files to archive
        await fs.rename(originalJsonPath, archivedJsonPath);
        await fs.rename(originalTxtPath, archivedTxtPath);
        
        mergeEntry.original_file_paths?.push(originalJsonPath, originalTxtPath);

        if (originalHtmlPath) {
          const archivedHtmlPath = join(ARCHIVE_DIR, `${dupJob.uuid}.html`);
          await fs.rename(originalHtmlPath, archivedHtmlPath);
          mergeEntry.original_file_paths?.push(originalHtmlPath);
        }
      } catch (error) {
        console.warn(`Failed to archive files for job ${dupJob.uuid}:`, error);
      }
    }

    // Update primary job with merge metadata
    const updatedPrimaryJob: JobDescription = {
      ...primaryJob,
      merged_from: [
        ...(primaryJob.merged_from || []),
        ...duplicateUuids
      ],
      merge_history: [
        ...(primaryJob.merge_history || []),
        mergeEntry
      ]
    };

    // Save updated primary job
    const primaryJsonPath = join(STORAGE_DIR, `${primaryJob.uuid}.json`);
    await fs.writeFile(primaryJsonPath, JSON.stringify(updatedPrimaryJob, null, 2), 'utf-8');

    return updatedPrimaryJob;
  }

  async deleteJob(uuid: string, userAction?: string): Promise<void> {
    const allJobs = await this.getAllJobDescriptions();
    const job = allJobs.find(j => j.uuid === uuid);

    if (!job) {
      throw new Error('Job not found');
    }

    await this.ensureArchiveDirectory();

    const originalJsonPath = join(STORAGE_DIR, `${uuid}.json`);
    const originalTxtPath = join(STORAGE_DIR, `${uuid}.txt`);
    const originalHtmlPath = job.source_html_path;

    const archivedJsonPath = join(ARCHIVE_DIR, `${uuid}.json`);
    const archivedTxtPath = join(ARCHIVE_DIR, `${uuid}.txt`);

    // Create deletion history entry
    const deletionEntry: MergeHistoryEntry = {
      timestamp: new Date().toISOString(),
      action: 'delete',
      source_uuids: [uuid],
      user_action: userAction,
      original_file_paths: [originalJsonPath, originalTxtPath]
    };

    // Mark job as archived and add history
    const archivedJob: JobDescription = {
      ...job,
      is_archived: true,
      archived_at: new Date().toISOString(),
      merge_history: [
        ...(job.merge_history || []),
        deletionEntry
      ]
    };

    // Move files to archive
    try {
      await fs.writeFile(archivedJsonPath, JSON.stringify(archivedJob, null, 2), 'utf-8');
      await fs.rename(originalTxtPath, archivedTxtPath);
      await fs.unlink(originalJsonPath);

      if (originalHtmlPath) {
        const archivedHtmlPath = join(ARCHIVE_DIR, `${uuid}.html`);
        await fs.rename(originalHtmlPath, archivedHtmlPath);
        deletionEntry.original_file_paths?.push(originalHtmlPath);
      }
    } catch (error) {
      console.warn(`Failed to archive job ${uuid}:`, error);
      throw error;
    }
  }

  async checkForDuplicatesOnSave(newJob: JobDescription): Promise<DuplicateGroup[]> {
    const result = await this.findDuplicates(newJob);
    return result.duplicate_groups;
  }
}

export const deduplicationService = new DeduplicationService();