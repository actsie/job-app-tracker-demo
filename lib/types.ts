// Unified JobApplication entity - represents a job throughout its entire lifecycle:
// Saved (job description captured) → Interested → Applied → Interviewing → Offer/Rejected/Withdrawn
export interface JobDescription {
  uuid: string;
  company: string | null;
  role: string | null;
  jd_text: string;
  // New formatting fields - 3-format storage
  raw_html?: string;           // Original HTML from source
  markdown?: string;           // Formatted markdown version
  plain_text_excerpt?: string; // First 1-2k chars for search/preview
  // Existing fields
  source_url: string | null;
  fetched_at_iso: string;
  content_hash: string;
  source_html_path?: string;
  capture_method?: 'manual' | 'url_fetch' | 'browser_helper';
  captured_at?: string;
  // Application tracking - unified JobApplication lifecycle
  application_status?: 'saved' | 'interested' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';
  next_reminder?: string; // ISO date string for next reminder
  reminder_ics_downloaded?: boolean; // Track if ICS file has been downloaded
  applied_date?: string; // ISO date string for when application was submitted
  last_updated?: string; // ISO date string for last status update
  // Follow-up reminder settings
  auto_followup_enabled?: boolean; // Whether to automatically schedule follow-up reminders
  followup_reminder?: string; // ISO date string for follow-up reminder (7 days after applied_date)
  followup_reminder_id?: string; // ID for the follow-up reminder notification
  // Resume mapping
  resume_id?: string; // Reference to the resume used for this application
  resume_filename?: string; // Original filename of the resume used
  resume_path?: string; // Path to the resume file (if managed)
  active_resume_version_id?: string; // ID of the currently active resume version for this job
  // Resume text management
  resumeTextExtracted?: string; // Text extracted from resume file
  resumeTextManual?: string; // Manually input resume text
  resumeTextPath?: string; // Absolute path to the saved resume text file
  resumeTextSource?: 'extracted' | 'manual' | 'none'; // Current text source
  extractionMethod?: 'pdf-text' | 'docx' | 'plain' | 'failed'; // How text was extracted
  extractionStatus?: 'ok' | 'failed'; // Extraction success status
  extractionError?: string; // Error message if extraction failed
  // Deduplication metadata
  merged_from?: string[]; // Array of source UUIDs that were merged into this record
  merge_history?: MergeHistoryEntry[];
  archived_at?: string;
  is_archived?: boolean;
  // Import metadata
  imported_from?: string; // Original file path when imported
  imported_at?: string; // Import timestamp
  // Enhanced parsing candidates (temporary fields for captured jobs)
  roleCandidates?: ExtractionCandidate[];
  companyCandidates?: ExtractionCandidate[];
}

// Type alias for clarity in unified workflow contexts
export type JobApplication = JobDescription;

export interface MergeHistoryEntry {
  timestamp: string;
  action: 'merge' | 'delete' | 'archive';
  source_uuids: string[];
  user_action?: string;
  original_file_paths?: string[];
}

export interface SaveJobDescriptionRequest {
  text?: string;
  url?: string;
}

export interface ExtractionCandidate {
  value: string;
  confidence: number;
  source: string;
}

export interface ContentSection {
  type: 'title' | 'responsibilities' | 'requirements' | 'benefits' | 'other';
  heading: string;
  content: string;
  markdown: string;
}

export interface JobDescriptionPreview {
  company: string | null;
  role: string | null;
  preview: string;
  source_url?: string | null;
  // Enhanced extraction candidates for suggestions
  roleCandidates?: ExtractionCandidate[];
  companyCandidates?: ExtractionCandidate[];
}

export interface DuplicateMatch {
  uuid: string;
  similarity_score: number;
  job_description: JobDescription;
}

export interface DuplicateGroup {
  id: string;
  primary_job: JobDescription;
  duplicates: DuplicateMatch[];
  max_similarity: number;
  created_at: string;
}

export interface DeduplicationResult {
  duplicate_groups: DuplicateGroup[];
  total_duplicates_found: number;
  threshold_used: number;
  processed_at: string;
}

export interface DeduplicationConfig {
  similarity_threshold: number;
  auto_merge_threshold: number;
  schedule_enabled: boolean;
  schedule_interval: number; // minutes
  comparison_fields: ('jd_text' | 'company' | 'role')[];
}

export interface ResumeVersionEntry {
  version_id: string;
  version_suffix: string; // e.g., "", "_v1", "_v2"
  managed_path: string;
  file_checksum: string;
  upload_timestamp: string;
  original_path: string;
  original_filename: string;
  mime_type?: string; // MIME type for better file type detection
  is_active: boolean;
  // Text extraction fields
  extracted_text?: string;
  extraction_status?: 'pending' | 'success' | 'failed';
  extraction_error?: string;
  extraction_method?: 'pdf-parse' | 'mammoth' | 'rtf' | 'plain-text';
}

export interface ResumeManifestEntry {
  id: string;
  job_uuid: string;
  base_filename: string; // e.g., "Company_Role_YYYY-MM-DD"
  filename_components: {
    company: string;
    role: string;
    date: string;
  };
  file_extension: string;
  keep_original: boolean;
  versions: ResumeVersionEntry[];
  created_at: string;
  last_updated: string;
  // Convenience field for latest version's extracted text
  latest_extracted_text?: string;
  latest_extraction_status?: 'pending' | 'success' | 'failed';
}

export interface ResumeConfig {
  managed_folder_path: string;
  keep_original_default: boolean;
  supported_file_types: string[];
  naming_format: 'Company_Role_Date' | 'Company_Role_Date_Time';
}

export interface BulkImportPreview {
  id: string;
  original_filename: string;
  original_path: string;
  proposed_filename: string;
  job_mapping?: JobDescription;
  manual_company?: string;
  manual_role?: string;
  status: 'pending' | 'mapped' | 'error';
  error_message?: string;
}

export interface BulkImportOperation {
  id: string;
  source_folder: string;
  preview_items: BulkImportPreview[];
  created_at: string;
  status: 'preview' | 'completed' | 'cancelled';
}

// Unassigned resume entry - resumes in the holding area before job assignment
export interface UnassignedResumeEntry {
  id: string;
  filename: string;
  original_path?: string; // Original path if imported
  managed_path: string; // Where file is stored
  file_size: number; // File size in bytes
  file_extension: string; // .pdf, .docx, etc.
  content_hash: string; // For deduplication
  uploaded_at: string; // ISO timestamp
  extracted_text?: string; // Extracted text content
  extraction_status?: 'pending' | 'success' | 'failed';
  preview_available: boolean; // Whether preview can be shown
}

export interface OperationLogEntry {
  id: string;
  operation_type: 'upload' | 'bulk_import' | 'delete' | 'restore' | 'rename' | 'rollback';
  timestamp: string;
  details: {
    affected_files?: string[];
    manifest_entries?: string[];
    source_paths?: string[];
    target_paths?: string[];
    job_uuid?: string;
    user_action?: string;
  };
  can_undo: boolean;
  session_id: string;
}