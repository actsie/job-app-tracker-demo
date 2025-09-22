import { promises as fs } from 'fs';
import { join } from 'path';
import { parseJobDescription } from './enhanced-job-parser';
import { formatJobDescription } from './content-formatter';
import { saveJobDescription } from './storage';
import { JobDescription } from './types';



const STORAGE_DIR = join(process.cwd(), 'job-descriptions');

export async function saveJobDescriptionFromBrowser(
  text: string,
  sourceUrl: string,
  sourceHtml?: string
): Promise<{ jsonPath: string; txtPath: string; uuid: string }> {
  // Format content using new pipeline if HTML is available
  let formatted = null;
  let company = null;
  let role = null;

  try {
    if (sourceHtml) {
      // Use content formatter for 3-format processing
      formatted = await formatJobDescription(sourceHtml, sourceUrl, '');
      
      // Parse job description for company/role extraction
      const parsed = parseJobDescription(text, {
        url: sourceUrl,
        html: sourceHtml
      });
      
      company = parsed.company;
      role = parsed.role;
    } else {
      // Fallback: parse text only
      const parsed = parseJobDescription(text, { url: sourceUrl });
      company = parsed.company;
      role = parsed.role;
    }
  } catch (error) {
    console.warn('Content formatting failed in browser capture:', error);
    // Continue with basic text processing
  }

  // Use the unified storage function with browser_helper capture method
  // Pass formatted content if available
  return await saveJobDescription(
    formatted?.plain_text_excerpt || text, // Use excerpt if available
    sourceUrl,
    company,
    role,
    sourceHtml,
    'browser_helper',
    undefined, // company override
    undefined, // role override  
    formatted  // Pass formatted content
  );
}

export async function getRecentCaptures(limit: number = 20): Promise<JobDescription[]> {
  
  try {
    const files = await fs.readdir(STORAGE_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json')).slice(0, limit);
    
    const captures: JobDescription[] = [];
    
    for (const file of jsonFiles) {
      try {
        const filePath = join(STORAGE_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as JobDescription;
        captures.push(data);
      } catch (error) {
        console.error(`Error reading capture file ${file}:`, error);
      }
    }
    
    // Sort by captured_at or fetched_at_iso timestamp (most recent first)
    captures.sort((a, b) => {
      const aTime = a.captured_at || a.fetched_at_iso;
      const bTime = b.captured_at || b.fetched_at_iso;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    
    return captures;
  } catch (error) {
    console.error('Error getting recent captures:', error);
    return [];
  }
}