import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { JobDescription } from './types';
import { FormattedContent } from './content-formatter';

const STORAGE_DIR = join(process.cwd(), 'job-descriptions');

export async function ensureStorageDirectory(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

export async function saveJobDescription(
  text: string,
  sourceUrl: string | null = null,
  company: string | null = null,
  role: string | null = null,
  sourceHtml?: string,
  captureMethod: 'manual' | 'url_fetch' | 'browser_helper' = 'manual',
  companyOverride?: string,
  roleOverride?: string,
  formattedContent?: FormattedContent | null,
  resumeTextExtracted?: string,
  resumeTextSource?: 'extracted' | 'manual' | 'none'
): Promise<{ jsonPath: string; txtPath: string; uuid: string }> {
  await ensureStorageDirectory();
  
  const uuid = uuidv4();
  const timestamp = new Date().toISOString();
  const contentHash = createHash('sha256').update(text).digest('hex');
  
  const jobDescription: JobDescription = {
    uuid,
    company: companyOverride || company,
    role: roleOverride || role,
    jd_text: text,
    // Add new 3-format fields from formatted content
    raw_html: formattedContent?.raw_html || sourceHtml,
    markdown: formattedContent?.markdown,
    plain_text_excerpt: formattedContent?.plain_text_excerpt || text.substring(0, 2000),
    source_url: sourceUrl,
    fetched_at_iso: timestamp,
    content_hash: contentHash,
    capture_method: captureMethod,
    captured_at: timestamp,
    // Add resume text fields for interview prep
    resumeTextExtracted,
    resumeTextSource,
  };

  const jsonFilename = `${uuid}.json`;
  const txtFilename = `${uuid}.txt`;
  const jsonPath = join(STORAGE_DIR, jsonFilename);
  const txtPath = join(STORAGE_DIR, txtFilename);

  if (sourceHtml) {
    const htmlFilename = `${uuid}.html`;
    const htmlPath = join(STORAGE_DIR, htmlFilename);
    await fs.writeFile(htmlPath, sourceHtml, 'utf-8');
    jobDescription.source_html_path = htmlPath;
  }

  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(jobDescription, null, 2), 'utf-8'),
    fs.writeFile(txtPath, text, 'utf-8'),
  ]);

  return { jsonPath, txtPath, uuid };
}