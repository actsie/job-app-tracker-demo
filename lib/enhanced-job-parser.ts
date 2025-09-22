import { JobDescriptionPreview } from './types';

interface ExtractionCandidate {
  value: string;
  confidence: number;
  source: string;
}

interface ExtractionResult {
  role: ExtractionCandidate[];
  company: ExtractionCandidate[];
  preview: string;
  source_url: string | null;
}

export interface ParseOptions {
  url?: string;
  title?: string;
  html?: string;
}

export function parseJobDescription(text: string, options: ParseOptions = {}): JobDescriptionPreview {
  const result = extractJobInfo(text, options);
  
  // Get top candidates
  const topRole = result.role[0]?.value || null;
  const topCompany = result.company[0]?.value || null;
  const preview = text.substring(0, 300);
  
  return { 
    company: topCompany, 
    role: topRole, 
    preview, 
    source_url: options.url || null,
    // Add candidates for UI suggestions
    roleCandidates: result.role.slice(0, 3),
    companyCandidates: result.company.slice(0, 3)
  };
}

function extractJobInfo(text: string, options: ParseOptions): ExtractionResult {
  const roleCandidates: ExtractionCandidate[] = [];
  const companyCandidates: ExtractionCandidate[] = [];

  // 1. Structured Data First (highest confidence)
  if (options.html) {
    const structuredData = extractStructuredData(options.html);
    if (structuredData.role) {
      roleCandidates.push({ value: structuredData.role, confidence: 0.95, source: 'structured-data' });
    }
    if (structuredData.company) {
      companyCandidates.push({ value: structuredData.company, confidence: 0.95, source: 'structured-data' });
    }

    // OpenGraph/Twitter meta tags
    const metaData = extractMetaData(options.html);
    if (metaData.role) {
      roleCandidates.push({ value: metaData.role, confidence: 0.85, source: 'meta-tags' });
    }
    if (metaData.company) {
      companyCandidates.push({ value: metaData.company, confidence: 0.85, source: 'meta-tags' });
    }
  }

  // 2. Title/URL patterns (high confidence)
  if (options.title) {
    const titleData = extractFromTitle(options.title);
    if (titleData.role) {
      roleCandidates.push({ value: titleData.role, confidence: 0.8, source: 'page-title' });
    }
    if (titleData.company) {
      companyCandidates.push({ value: titleData.company, confidence: 0.8, source: 'page-title' });
    }
  }

  if (options.url) {
    const urlData = extractFromUrl(options.url);
    if (urlData.company) {
      companyCandidates.push({ value: urlData.company, confidence: 0.7, source: 'url-pattern' });
    }
  }

  // 3. Page chrome and headlines (medium confidence)
  if (options.html) {
    const chromeData = extractPageChrome(options.html);
    chromeData.roles.forEach(role => {
      roleCandidates.push({ value: role, confidence: 0.75, source: 'page-chrome' });
    });
    chromeData.companies.forEach(company => {
      companyCandidates.push({ value: company, confidence: 0.75, source: 'page-chrome' });
    });
  }

  // 4. Text patterns (medium confidence)
  const textData = extractFromText(text);
  textData.roles.forEach(role => {
    roleCandidates.push({ value: role, confidence: 0.6, source: 'text-patterns' });
  });
  textData.companies.forEach(company => {
    companyCandidates.push({ value: company, confidence: 0.6, source: 'text-patterns' });
  });

  // 5. NER fallback (lower confidence)
  const nerData = extractNER(text.substring(0, 2000));
  nerData.roles.forEach(role => {
    roleCandidates.push({ value: role, confidence: 0.4, source: 'ner-fallback' });
  });
  nerData.companies.forEach(company => {
    companyCandidates.push({ value: company, confidence: 0.4, source: 'ner-fallback' });
  });

  // Rank and deduplicate
  const rankedRoles = rankAndDedup(roleCandidates, 'role');
  const rankedCompanies = rankAndDedup(companyCandidates, 'company');

  return {
    role: rankedRoles,
    company: rankedCompanies,
    preview: text.substring(0, 300),
    source_url: options.url || null
  };
}

function extractStructuredData(html: string): { role?: string; company?: string } {
  const result: { role?: string; company?: string } = {};

  // JSON-LD extraction
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonLdMatches = html.matchAll(jsonLdRegex);
  
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'JobPosting') {
        if (data.title || data.name) {
          result.role = cleanText(data.title || data.name);
        }
        if (data.hiringOrganization?.name) {
          result.company = cleanText(data.hiringOrganization.name);
        }
        break; // Use first valid JobPosting
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }

  // Microdata extraction
  if (!result.role || !result.company) {
    const microdataRole = html.match(/itemprop=["']title["'][^>]*>([^<]+)/i);
    const microdataCompany = html.match(/itemprop=["']hiringOrganization["'][^>]*>([^<]+)/i);
    
    if (microdataRole && !result.role) {
      result.role = cleanText(microdataRole[1]);
    }
    if (microdataCompany && !result.company) {
      result.company = cleanText(microdataCompany[1]);
    }
  }

  return result;
}

function extractMetaData(html: string): { role?: string; company?: string } {
  const result: { role?: string; company?: string } = {};

  // OpenGraph and Twitter meta tags
  const metaPatterns = [
    { pattern: /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i, type: 'title' },
    { pattern: /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i, type: 'title' },
    { pattern: /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i, type: 'company' },
  ];

  for (const { pattern, type } of metaPatterns) {
    const match = html.match(pattern);
    if (match) {
      const value = cleanText(match[1]);
      if (type === 'title' && !result.role) {
        const parsed = parseTitle(value);
        if (parsed.role) result.role = parsed.role;
        if (parsed.company) result.company = parsed.company;
      } else if (type === 'company' && !result.company) {
        result.company = value;
      }
    }
  }

  return result;
}

function extractFromTitle(title: string): { role?: string; company?: string } {
  return parseTitle(title);
}

function parseTitle(title: string): { role?: string; company?: string } {
  const cleanTitle = cleanText(title);
  
  // Common patterns in job titles
  const patterns = [
    // "Senior PM – Company | Indeed"
    { regex: /^([^–—\-\|]+)[–—\-\|]\s*([^–—\-\|]+?)\s*[–—\-\|]/, roleIdx: 1, companyIdx: 2 },
    // "Role at Company"
    { regex: /^(.+?)\s+at\s+(.+?)(?:\s*[–—\-\|]|$)/, roleIdx: 1, companyIdx: 2 },
    // "Company - Role"
    { regex: /^([^–—\-\|]+?)\s*[–—\-]\s*(.+?)(?:\s*[–—\-\|]|$)/, roleIdx: 2, companyIdx: 1 },
    // "Role | Company"
    { regex: /^([^|]+?)\s*\|\s*([^|]+?)(?:\s*\||$)/, roleIdx: 1, companyIdx: 2 },
  ];

  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern.regex);
    if (match) {
      const role = match[pattern.roleIdx]?.trim();
      const company = match[pattern.companyIdx]?.trim();
      
      if (role && company && isValidRole(role) && isValidCompany(company)) {
        return { role, company };
      }
    }
  }

  return {};
}

function extractFromUrl(url: string): { company?: string } {
  try {
    const urlObj = new URL(url);
    
    // careers.company.com pattern
    const careerSubdomain = urlObj.hostname.match(/^careers\.(.+)\.com$/);
    if (careerSubdomain) {
      const company = careerSubdomain[1];
      if (company && company !== 'indeed' && company !== 'linkedin') {
        return { company: capitalizeCompany(company) };
      }
    }
    
    // company.com/careers or company.com/jobs
    if (urlObj.pathname.includes('/careers') || urlObj.pathname.includes('/jobs')) {
      const hostname = urlObj.hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length >= 2 && parts[0] !== 'indeed' && parts[0] !== 'linkedin') {
        return { company: capitalizeCompany(parts[0]) };
      }
    }
  } catch (e) {
    // Invalid URL
  }
  
  return {};
}

function extractPageChrome(html: string): { roles: string[]; companies: string[] } {
  const roles: string[] = [];
  const companies: string[] = [];

  // H1/H2 extraction
  const headingRegex = /<h[12][^>]*>([^<]+)</gi;
  const headings = [...html.matchAll(headingRegex)];
  
  for (const heading of headings) {
    const text = cleanText(heading[1]);
    if (isValidRole(text)) {
      roles.push(text);
    }
  }

  // Breadcrumb extraction
  const breadcrumbPatterns = [
    /aria-label=["']breadcrumb["'][^>]*>.*?<[^>]*>([^<]+)/gi,
    /class=["'][^"']*breadcrumb[^"']*["'][^>]*>.*?<[^>]*>([^<]+)/gi,
  ];

  for (const pattern of breadcrumbPatterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const text = cleanText(match[1]);
      if (isValidCompany(text)) {
        companies.push(text);
      }
    }
  }

  // Apply buttons with company names
  const applyButtonRegex = /Apply\s+(?:at|to)\s+([^<"']+)/gi;
  const applyMatches = [...html.matchAll(applyButtonRegex)];
  
  for (const match of applyMatches) {
    const company = cleanText(match[1]);
    if (isValidCompany(company)) {
      companies.push(company);
    }
  }

  return { roles: [...new Set(roles)], companies: [...new Set(companies)] };
}

function extractFromText(text: string): { roles: string[]; companies: string[] } {
  const roles: string[] = [];
  const companies: string[] = [];

  // Enhanced regex patterns from original parser
  const companyPatterns = [
    /(?:at|@)\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s+(?:is|are|we|you|team|company)|[,.\n!]|$)/g,
    /([A-Z][a-zA-Z\s&.,-]+?)\s+(?:is|are)\s+(?:looking|seeking|hiring)/gi,
    /join\s+(?:the\s+team\s+at\s+)?([A-Z][a-zA-Z\s&.,-]+?)(?:[,.\n!]|$)/gi,
    /work\s+(?:at|for)\s+([A-Z][a-zA-Z\s&.,-]+?)(?:[,.\n!]|$)/gi,
  ];

  const rolePatterns = [
    /(?:position|role|job|opening):\s*([A-Z][a-zA-Z\s/&-]+?)(?:[,.\n!]|$)/gi,
    /(?:hiring|seeking|looking for)(?:\s+a|\s+an)?\s+([A-Z][a-zA-Z\s/&-]+?)(?:\s+(?:at|for)|[,.\n!]|$)/gi,
    /^([A-Z][a-zA-Z\s/&-]+?)\s+(?:position|role|job|opening)/gim,
    /we(?:'re|\s+are)\s+looking\s+for\s+(?:a|an)\s+([A-Z][a-zA-Z\s/&-]+?)(?:[,.\n!]|$)/gi,
  ];

  // Extract companies
  for (const pattern of companyPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const company = cleanText(match[1]);
      if (isValidCompany(company)) {
        companies.push(company);
      }
    }
  }

  // Extract roles
  for (const pattern of rolePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const role = cleanText(match[1]);
      if (isValidRole(role)) {
        roles.push(role);
      }
    }
  }

  // First line heuristic (if looks like a role)
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (isValidRole(firstLine) && !roles.includes(firstLine)) {
      roles.push(firstLine);
    }
  }

  return { 
    roles: [...new Set(roles)].slice(0, 5), 
    companies: [...new Set(companies)].slice(0, 5) 
  };
}

function extractNER(text: string): { roles: string[]; companies: string[] } {
  // Simplified NER-like extraction
  const roles: string[] = [];
  const companies: string[] = [];

  // Look for capitalized phrases that might be companies
  const orgPatterns = [
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s+(?:Inc|Corp|LLC|Ltd|Group|Company|Technologies|Systems|Solutions)\b/g,
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\s+(?:team|company|organization)\b/gi,
  ];

  for (const pattern of orgPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const company = cleanText(match[1]);
      if (isValidCompany(company)) {
        companies.push(company);
      }
    }
  }

  // Look for job title keywords
  const jobTitleKeywords = /\b(Senior|Junior|Lead|Principal|Staff|Director|Manager|Engineer|Developer|Analyst|Specialist|Coordinator|Assistant)\s+([A-Za-z\s]+?)(?:\s|$|,|\.|!)/g;
  const titleMatches = [...text.matchAll(jobTitleKeywords)];
  
  for (const match of titleMatches) {
    const role = cleanText(`${match[1]} ${match[2]}`);
    if (isValidRole(role)) {
      roles.push(role);
    }
  }

  return { 
    roles: [...new Set(roles)].slice(0, 3), 
    companies: [...new Set(companies)].slice(0, 3) 
  };
}

function rankAndDedup(candidates: ExtractionCandidate[], type: 'role' | 'company'): ExtractionCandidate[] {
  // Deduplicate by normalized value
  const seen = new Set<string>();
  const deduped: ExtractionCandidate[] = [];

  for (const candidate of candidates) {
    const normalized = candidate.value.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(candidate);
    } else {
      // If we've seen this value, boost confidence of existing entry
      const existing = deduped.find(c => c.value.toLowerCase().trim() === normalized);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, candidate.confidence + 0.1);
      }
    }
  }

  // Sort by confidence, then by source priority
  const sourcePriority: Record<string, number> = {
    'structured-data': 5,
    'meta-tags': 4,
    'page-title': 3,
    'page-chrome': 2,
    'url-pattern': 2,
    'text-patterns': 1,
    'ner-fallback': 0
  };

  return deduped
    .sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) < 0.05) {
        return (sourcePriority[b.source] || 0) - (sourcePriority[a.source] || 0);
      }
      return b.confidence - a.confidence;
    })
    .slice(0, 5); // Keep top 5
}

// Utility functions
function cleanText(text: string): string {
  return text
    .replace(/&[a-zA-Z]+;/g, '') // Remove HTML entities
    .replace(/[^\w\s&.,-]/g, '') // Keep basic punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidRole(text: string): boolean {
  if (!text || text.length < 3 || text.length > 100) return false;
  if (text.toUpperCase() === text && text.length > 20) return false; // All caps long text
  if (text.includes('http')) return false;
  if (['Indeed', 'LinkedIn', 'Glassdoor', 'Monster'].includes(text)) return false;
  return true;
}

function isValidCompany(text: string): boolean {
  if (!text || text.length < 2 || text.length > 80) return false;
  if (text.includes('http')) return false;
  if (['Indeed', 'LinkedIn', 'Glassdoor', 'Monster', 'Jobs', 'Careers'].includes(text)) return false;
  return true;
}

function capitalizeCompany(company: string): string {
  return company
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}