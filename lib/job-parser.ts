import { JobDescriptionPreview } from './types';

export function parseJobDescription(text: string): JobDescriptionPreview {
  const company = extractCompany(text);
  const role = extractRole(text);
  const preview = text.substring(0, 300);
  
  return { company, role, preview, source_url: null };
}

function extractCompany(text: string): string | null {
  const patterns = [
    /(?:at|@)\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s|$|,|\.|!)/g,
    /([A-Z][a-zA-Z\s&.,-]+?)\s+(?:is|are)\s+(?:looking|seeking|hiring)/gi,
    /join\s+(?:the\s+team\s+at\s+)?([A-Z][a-zA-Z\s&.,-]+?)(?:\s|$|,|\.|!)/gi,
    /work\s+(?:at|for)\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s|$|,|\.|!)/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const company = matches[0][1]?.trim();
      if (company && company.length > 1 && company.length < 50) {
        return company.replace(/[,.!]$/, '').trim();
      }
    }
  }
  
  return null;
}

function extractRole(text: string): string | null {
  const patterns = [
    /(?:position|role|job|opening):\s*([A-Z][a-zA-Z\s/&-]+?)(?:\s|$|,|\.|!)/gi,
    /(?:hiring|seeking|looking for)(?:\s+a|\s+an)?\s+([A-Z][a-zA-Z\s/&-]+?)(?:\s+(?:at|for)|$|,|\.|!)/gi,
    /^([A-Z][a-zA-Z\s/&-]+?)\s+(?:position|role|job|opening)/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const role = matches[0][1]?.trim();
      if (role && role.length > 3 && role.length < 80) {
        return role.replace(/[,.!]$/, '').trim();
      }
    }
  }
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length > 5 && firstLine.length < 80 && 
        /^[A-Z]/.test(firstLine) && 
        !/https?:\/\//.test(firstLine)) {
      return firstLine.replace(/[,.!]$/, '').trim();
    }
  }
  
  return null;
}