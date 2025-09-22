import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { JobDescription } from '@/lib/types';

// Default export path
const DEFAULT_EXPORT_DIR = join(homedir(), 'Documents', 'Pawgrammer-Exports');

// Ensure export directory exists
async function ensureExportDirectory(): Promise<string> {
  try {
    await fs.access(DEFAULT_EXPORT_DIR);
  } catch {
    await fs.mkdir(DEFAULT_EXPORT_DIR, { recursive: true });
  }
  return DEFAULT_EXPORT_DIR;
}

// Generate JD summary if missing
function generateJobSummary(jdText: string): string {
  if (!jdText || jdText.trim().length === 0) {
    return 'No job description available';
  }
  
  // Simple summary generation - take first few sentences and key requirements
  const sentences = jdText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const firstSentences = sentences.slice(0, 2).map(s => s.trim()).join('. ');
  
  // Look for key sections
  const requirements = jdText.match(/(?:requirements|qualifications|skills)[^\n]*([^\n]*\n){0,3}/gi)?.[0];
  const responsibilities = jdText.match(/(?:responsibilities|duties|role)[^\n]*([^\n]*\n){0,2}/gi)?.[0];
  
  let summary = firstSentences;
  if (requirements) {
    summary += ' ' + requirements.replace(/\s+/g, ' ').trim().substring(0, 100);
  }
  if (responsibilities) {
    summary += ' ' + responsibilities.replace(/\s+/g, ' ').trim().substring(0, 100);
  }
  
  // Limit to 300 characters
  if (summary.length > 300) {
    summary = summary.substring(0, 297) + '...';
  }
  
  return summary || 'Job description summary not available';
}

// Core fields matching requirements
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

function formatFieldValue(job: JobDescription, fieldKey: string): string {
  let value = (job as any)[fieldKey];
  
  // Handle special case for JD summary - generate if missing
  if (fieldKey === 'jd_summary') {
    if (!value && job.jd_text) {
      try {
        value = generateJobSummary(job.jd_text);
      } catch (error) {
        console.error('Failed to generate JD summary:', error);
        value = 'Summary generation failed';
      }
    }
  }
  
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

function generateCSV(jobs: JobDescription[], includeExtendedFields: boolean): string {
  if (jobs.length === 0) {
    throw new Error('No jobs to export');
  }
  
  let fields = [...CORE_FIELDS];
  if (includeExtendedFields) {
    fields = [...fields, ...EXTENDED_FIELDS];
  }
  
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobs, includeExtendedFields, filename } = body;
    
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: 'No jobs provided for export' },
        { status: 400 }
      );
    }

    // Privacy note: CSV export only contains requested fields and file paths - 
    // no embedded binary data or sensitive system information
    
    // Generate CSV content
    const csvContent = generateCSV(jobs, includeExtendedFields || false);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const finalFilename = filename || `job_applications_${timestamp}.csv`;
    
    // Save to file system
    const exportDir = await ensureExportDirectory();
    const filePath = join(exportDir, finalFilename);
    
    // Write file with user-readable permissions only (security measure)
    await fs.writeFile(filePath, csvContent, 'utf-8');
    
    // Set file permissions to be readable only by the owner (privacy protection)
    try {
      await fs.chmod(filePath, 0o600); // Read/write for owner only
    } catch (chmodError) {
      console.warn('Failed to set file permissions:', chmodError);
      // Continue - file was written successfully, just with default permissions
    }
    
    return NextResponse.json({
      success: true,
      filePath,
      filename: finalFilename,
      recordCount: jobs.length,
      message: `Successfully exported ${jobs.length} job applications to ${filePath}`
    });
    
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to export CSV',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}