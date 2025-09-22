import { JSDOM } from 'jsdom';
import { formatJobDescription } from './content-formatter';

export async function fetchJobDescriptionFromUrl(url: string): Promise<{
  text: string;
  html?: string;
  raw_html?: string;
  markdown?: string;
  plain_text_excerpt?: string;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return {
        text: '',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    
    // Use new content formatter for 3-format processing
    try {
      const formatted = await formatJobDescription(html, url, '');
      
      // Ensure we have meaningful content
      if (!formatted.plain_text_excerpt || formatted.plain_text_excerpt.length < 100) {
        // Fallback to legacy extraction
        const dom = new JSDOM(html);
        const document = dom.window.document;
        removeUnwantedElements(document);
        const textContent = extractJobDescriptionText(document);
        
        if (!textContent || textContent.length < 100) {
          return {
            text: '',
            html,
            raw_html: html,
            error: 'Could not extract meaningful job description content from the page',
          };
        }
        
        return {
          text: textContent,
          html,
          raw_html: html,
          markdown: textContent, // Fallback markdown
          plain_text_excerpt: textContent.substring(0, 2000),
        };
      }

      return {
        text: formatted.plain_text_excerpt, // Keep compatibility
        html,
        raw_html: formatted.raw_html,
        markdown: formatted.markdown,
        plain_text_excerpt: formatted.plain_text_excerpt,
      };
      
    } catch (formattingError) {
      console.warn('Content formatting failed, using legacy extraction:', formattingError);
      
      // Fallback to legacy method
      const dom = new JSDOM(html);
      const document = dom.window.document;
      removeUnwantedElements(document);
      const textContent = extractJobDescriptionText(document);
      
      if (!textContent || textContent.length < 100) {
        return {
          text: '',
          html,
          raw_html: html,
          error: 'Could not extract meaningful job description content from the page',
        };
      }

      return {
        text: textContent,
        html,
        raw_html: html,
        markdown: textContent, // Basic fallback
        plain_text_excerpt: textContent.substring(0, 2000),
      };
    }
  } catch (error) {
    return {
      text: '',
      html: '',
      raw_html: '',
      markdown: '',
      plain_text_excerpt: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

function removeUnwantedElements(document: Document): void {
  const selectorsToRemove = [
    'nav', 'header', 'footer', 'aside',
    '.navigation', '.nav', '.header', '.footer', '.sidebar',
    '.cookie', '.popup', '.modal', '.advertisement', '.ads',
    'script', 'style', 'noscript',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  ];

  selectorsToRemove.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => element.remove());
  });
}

function extractJobDescriptionText(document: Document): string {
  const jobSelectors = [
    '[class*="job-description"]',
    '[class*="job_description"]',
    '[class*="jobdescription"]',
    '[id*="job-description"]',
    '[id*="job_description"]',
    '[id*="jobdescription"]',
    '.description',
    '.job-content',
    '.job-details',
    'main',
    'article',
    '.content',
  ];

  for (const selector of jobSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = cleanText(element.textContent || '');
      if (text.length > 200) {
        return text;
      }
    }
  }

  const bodyText = cleanText(document.body.textContent || '');
  return bodyText;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}