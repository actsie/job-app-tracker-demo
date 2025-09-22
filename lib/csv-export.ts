import { JobDescription } from './types';

export interface ExportConfig {
  scope: 'all' | 'selected' | 'filtered';
  includeExtendedFields: boolean;
  saveToFile: boolean;
}

export interface ExportOptions {
  jobs: JobDescription[];
  selectedIds?: string[];
  filteredJobs?: JobDescription[];
  config: ExportConfig;
}

export interface ExportHistoryEntry {
  id: string;
  timestamp: string;
  filePath: string;
  filename: string;
  scope: 'all' | 'selected' | 'filtered';
  scopeDescription: string;
  includedFields: string[];
  rowCount: number;
  config: ExportConfig;
  originalJobs: JobDescription[]; // Store jobs for re-run functionality
}

const CORE_FIELDS = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'applied_date', label: 'AppliedDate' },
  { key: 'application_status', label: 'Status' },
  { key: 'source_html_path', label: 'JDPath' },
  { key: 'resume_path', label: 'ResumePath' },
  { key: 'source_url', label: 'SourceURL' },
  { key: 'next_reminder', label: 'NextReminder' },
];

const EXTENDED_FIELDS = [
  { key: 'jd_text', label: 'FullJD' },
  { key: 'jd_summary', label: 'JDSummary' },
];

// Note: CSV generation and file operations are now handled server-side via API

export function getExportFields(config: ExportConfig) {
  let fields = [...CORE_FIELDS];
  
  if (config.includeExtendedFields) {
    fields = [...fields, ...EXTENDED_FIELDS];
  }
  
  return fields;
}

export function getJobsToExport(options: ExportOptions): JobDescription[] {
  const { jobs, selectedIds, filteredJobs, config } = options;
  
  switch (config.scope) {
    case 'selected':
      if (!selectedIds || selectedIds.length === 0) {
        throw new Error('No jobs selected for export');
      }
      return jobs.filter(job => selectedIds.includes(job.uuid));
    
    case 'filtered':
      if (!filteredJobs || filteredJobs.length === 0) {
        throw new Error('No filtered jobs available for export');
      }
      return filteredJobs;
    
    case 'all':
    default:
      return jobs;
  }
}

export function formatFieldValue(job: JobDescription, fieldKey: string): string {
  const value = (job as any)[fieldKey];
  
  if (value === null || value === undefined) {
    return '';
  }
  
  // Format dates - simplified to just date for better CSV compatibility
  if (fieldKey.includes('date') || fieldKey.includes('reminder') || fieldKey === 'fetched_at_iso' || fieldKey === 'last_updated') {
    if (typeof value === 'string') {
      try {
        const date = new Date(value);
        return date.toLocaleDateString('en-US'); // MM/DD/YYYY format for Excel compatibility
      } catch {
        return value;
      }
    }
  }
  
  // Format booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.join('; ');
  }
  
  // Proper CSV escaping for text fields
  if (typeof value === 'string') {
    // Replace newlines with spaces and properly escape quotes
    return value
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return String(value);
}

export function generateCSV(jobs: JobDescription[], config: ExportConfig): string {
  if (jobs.length === 0) {
    throw new Error('No jobs to export');
  }
  
  const fields = getExportFields(config);
  
  // Create header row
  const headers = fields.map(field => field.label);
  const csvRows = [headers.join(',')];
  
  // Create data rows with proper CSV escaping
  jobs.forEach(job => {
    const row = fields.map(field => {
      const value = formatFieldValue(job, field.key);
      // Properly escape CSV values
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

// Save CSV to local filesystem via API
export async function saveCSVToFile(jobs: JobDescription[], config: ExportConfig, filename?: string): Promise<{ filePath: string; recordCount: number }> {
  try {
    const response = await fetch('/api/csv-export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobs,
        includeExtendedFields: config.includeExtendedFields,
        filename
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to export CSV');
    }
    
    const result = await response.json();
    return {
      filePath: result.filePath,
      recordCount: result.recordCount
    };
  } catch (error) {
    console.error('Failed to save CSV file:', error);
    throw new Error(`Failed to save CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy download function for browser compatibility
export function downloadCSV(csvContent: string, filename?: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename || `job_applications_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function getExportSummary(jobs: JobDescription[], config: ExportConfig): string {
  const fields = getExportFields(config);
  const scopeText = config.scope === 'all' ? 'all' : 
                   config.scope === 'selected' ? 'selected' : 'filtered';
  
  return `Exporting ${jobs.length} job${jobs.length === 1 ? '' : 's'} (${scopeText}) with ${fields.length} field${fields.length === 1 ? '' : 's'}`;
}

// Export History Management
const EXPORT_HISTORY_KEY = 'csv_export_history';
const MAX_HISTORY_ENTRIES = 50;

export function getExportHistory(): ExportHistoryEntry[] {
  try {
    const stored = localStorage.getItem(EXPORT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load export history:', error);
    return [];
  }
}

export function saveExportToHistory(entry: Omit<ExportHistoryEntry, 'id' | 'timestamp'>): ExportHistoryEntry {
  const newEntry: ExportHistoryEntry = {
    ...entry,
    id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  };

  try {
    const history = getExportHistory();
    const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(updatedHistory));
    return newEntry;
  } catch (error) {
    console.error('Failed to save export to history:', error);
    throw new Error('Failed to save export to history');
  }
}

export function removeExportFromHistory(id: string): void {
  try {
    const history = getExportHistory();
    const updatedHistory = history.filter(entry => entry.id !== id);
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Failed to remove export from history:', error);
    throw new Error('Failed to remove export from history');
  }
}

export function clearExportHistory(): void {
  try {
    localStorage.removeItem(EXPORT_HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear export history:', error);
    throw new Error('Failed to clear export history');
  }
}

// Get scope description for history display
export function getScopeDescription(config: ExportConfig, jobs: JobDescription[], selectedIds?: string[], filteredJobs?: JobDescription[]): string {
  switch (config.scope) {
    case 'selected':
      return `${selectedIds?.length || 0} selected job${(selectedIds?.length || 0) === 1 ? '' : 's'}`;
    case 'filtered':
      return `${filteredJobs?.length || 0} filtered job${(filteredJobs?.length || 0) === 1 ? '' : 's'}`;
    case 'all':
    default:
      return `All ${jobs.length} job${jobs.length === 1 ? '' : 's'}`;
  }
}