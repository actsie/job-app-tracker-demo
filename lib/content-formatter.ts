import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import sanitizeHtml from 'sanitize-html';
import { JSDOM } from 'jsdom';

export interface FormattedContent {
  raw_html: string;
  markdown: string;
  plain_text_excerpt: string;
  extracted_title?: string;
  content_sections?: ContentSection[];
}

export interface ContentSection {
  type: 'title' | 'responsibilities' | 'requirements' | 'benefits' | 'other';
  heading: string;
  content: string;
  markdown: string;
}

// HTML size limit: 200KB
const MAX_HTML_SIZE = 200 * 1024;

// Excerpt limit: 2KB
const EXCERPT_LIMIT = 2000;

export class ContentFormatter {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    // Configure Turndown rules for better job description formatting
    this.setupTurndownRules();
  }

  private setupTurndownRules(): void {
    // Better handling of lists
    this.turndown.addRule('listItems', {
      filter: ['li'],
      replacement: (content, node) => {
        content = content.replace(/^\n+/, '').replace(/\n+$/, '\n');
        const parent = node.parentNode as Element;
        const isOrderedList = parent.nodeName === 'OL';
        
        if (isOrderedList) {
          const index = Array.prototype.indexOf.call(parent.children, node) + 1;
          return `${index}. ${content}`;
        } else {
          return `- ${content}`;
        }
      }
    });

    // Better handling of nested content
    this.turndown.addRule('nestedContent', {
      filter: ['div', 'section', 'article'],
      replacement: (content) => {
        return content + '\n\n';
      }
    });

    // Handle job-specific elements
    this.turndown.addRule('jobSections', {
      filter: (node) => {
        if (node.nodeName === 'DIV' || node.nodeName === 'SECTION') {
          const text = node.textContent?.toLowerCase() || '';
          return text.includes('responsibilities') || 
                 text.includes('requirements') || 
                 text.includes('qualifications') ||
                 text.includes('benefits');
        }
        return false;
      },
      replacement: (content) => {
        return `\n\n${content}\n\n`;
      }
    });
  }

  /**
   * Main formatting method: HTML → Readability → Sanitize → Turndown → Post-process
   */
  async formatJobDescription(html: string, url?: string, title?: string): Promise<FormattedContent> {
    try {
      // Guard against oversized HTML
      if (html.length > MAX_HTML_SIZE) {
        console.warn(`HTML size ${html.length} exceeds limit ${MAX_HTML_SIZE}, truncating`);
        html = html.substring(0, MAX_HTML_SIZE);
      }

      // Step 1: Extract main content using Readability
      const cleanedHtml = await this.extractMainContent(html, url, title);
      
      // Step 2: Sanitize HTML
      const sanitizedHtml = this.sanitizeHtml(cleanedHtml);
      
      // Step 3: Convert to Markdown
      const markdown = this.convertToMarkdown(sanitizedHtml);
      
      // Step 4: Post-process markdown
      const processedMarkdown = this.postProcessMarkdown(markdown);
      
      // Step 5: Extract plain text excerpt
      const plainTextExcerpt = this.extractPlainTextExcerpt(processedMarkdown);
      
      // Step 6: Detect content sections
      const sections = this.detectSections(processedMarkdown);

      return {
        raw_html: html,
        markdown: processedMarkdown,
        plain_text_excerpt: plainTextExcerpt,
        extracted_title: title,
        content_sections: sections
      };

    } catch (error) {
      console.error('Content formatting failed:', error);
      
      // Fallback: basic text extraction
      return this.createFallbackContent(html, title);
    }
  }

  /**
   * Extract main content using Mozilla Readability
   */
  private async extractMainContent(html: string, url?: string, title?: string): Promise<string> {
    try {
      const dom = new JSDOM(html, { url: url || 'http://localhost' });
      const document = dom.window.document;

      // Try Readability first
      const reader = new Readability(document, {
        debug: false,
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: ['job-description', 'job-content', 'description']
      });

      const article = reader.parse();
      
      if (article && article.content && article.content.length > 200) {
        return article.content;
      }

      // Fallback: try job-specific selectors
      return this.extractWithJobSelectors(document) || html;

    } catch (error) {
      console.warn('Readability extraction failed:', error);
      return html;
    }
  }

  /**
   * Fallback content extraction using job-specific selectors
   */
  private extractWithJobSelectors(document: Document): string | null {
    const jobSelectors = [
      '.job-description',
      '.job-details',
      '.job-content',
      '[data-testid*="job"][data-testid*="description"]',
      '.description',
      'main article',
      'main section',
      'main'
    ];

    for (const selector of jobSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.length > 200) {
          return element.outerHTML;
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  /**
   * Sanitize HTML to prevent XSS and clean up unwanted elements
   */
  private sanitizeHtml(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'div', 'section', 'article',
        'ul', 'ol', 'li',
        'strong', 'b', 'em', 'i', 'u',
        'a', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      allowedAttributes: {
        'a': ['href', 'title'],
        '*': ['class', 'id']
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        // Remove tracking and styling attributes
        '*': (tagName, attribs) => {
          const cleanedAttribs: any = {};
          if (attribs.class && (
            attribs.class.includes('job') ||
            attribs.class.includes('description') ||
            attribs.class.includes('content')
          )) {
            cleanedAttribs.class = attribs.class;
          }
          return { tagName, attribs: cleanedAttribs };
        }
      }
    });
  }

  /**
   * Convert sanitized HTML to Markdown
   */
  private convertToMarkdown(html: string): string {
    try {
      return this.turndown.turndown(html);
    } catch (error) {
      console.warn('Markdown conversion failed:', error);
      
      // Fallback: extract plain text and add basic structure
      const dom = new JSDOM(html);
      const text = dom.window.document.body?.textContent || html;
      return text.replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Post-process markdown for better job description formatting
   */
  private postProcessMarkdown(markdown: string): string {
    let processed = markdown;

    // Clean up excessive whitespace
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    // Improve section headers
    processed = processed.replace(/^([A-Z][A-Z\s:]+)$/gm, (match) => {
      const normalized = match.trim();
      if (normalized.length > 50) return match;
      
      // Convert ALL CAPS sections to proper headers
      if (this.isSectionHeader(normalized)) {
        return `## ${normalized.replace(/:/g, '')}`;
      }
      return match;
    });

    // Ensure proper list formatting
    processed = processed.replace(/^[\s]*-[\s]*/gm, '- ');
    processed = processed.replace(/^[\s]*\d+\.[\s]*/gm, (match) => {
      const num = match.match(/\d+/)?.[0] || '1';
      return `${num}. `;
    });

    // Clean up and normalize
    processed = processed.trim();
    
    return processed;
  }

  /**
   * Check if a text line is likely a section header
   */
  private isSectionHeader(text: string): boolean {
    const normalized = text.toLowerCase();
    const sectionKeywords = [
      'responsibilities', 'duties', 'role', 'job description',
      'requirements', 'qualifications', 'skills', 'experience',
      'benefits', 'perks', 'compensation', 'salary',
      'about', 'company', 'team', 'culture',
      'application', 'how to apply', 'contact'
    ];

    return sectionKeywords.some(keyword => normalized.includes(keyword)) &&
           text.length < 50 &&
           text.split(' ').length <= 5;
  }

  /**
   * Extract plain text excerpt for search and preview
   */
  private extractPlainTextExcerpt(markdown: string): string {
    // Convert markdown to plain text
    const plainText = markdown
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove emphasis
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/[-*+]\s+/g, '') // Remove list markers
      .replace(/\d+\.\s+/g, '') // Remove ordered list markers
      .replace(/\n+/g, ' ') // Convert newlines to spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate to excerpt limit
    return plainText.length > EXCERPT_LIMIT 
      ? plainText.substring(0, EXCERPT_LIMIT - 3) + '...'
      : plainText;
  }

  /**
   * Detect and categorize content sections
   */
  private detectSections(markdown: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = markdown.split('\n');
    
    let currentSection: ContentSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if this is a header line
      if (trimmed.match(/^#{1,3}\s+/)) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          currentSection.content = currentContent.join('\n').trim();
          currentSection.markdown = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        const heading = trimmed.replace(/^#+\s*/, '');
        const type = this.categorizeSection(heading);
        
        currentSection = {
          type,
          heading,
          content: '',
          markdown: ''
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      } else {
        // Content before any headers - create a general section
        if (!currentSection) {
          currentSection = {
            type: 'other',
            heading: 'Description',
            content: '',
            markdown: ''
          };
          currentContent = [];
        }
        currentContent.push(line);
      }
    }

    // Save final section
    if (currentSection && currentContent.length > 0) {
      currentSection.content = currentContent.join('\n').trim();
      currentSection.markdown = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Categorize a section based on its heading
   */
  private categorizeSection(heading: string): ContentSection['type'] {
    const normalized = heading.toLowerCase();
    
    if (normalized.includes('title') || normalized.includes('role') || normalized.includes('position')) {
      return 'title';
    }
    if (normalized.includes('responsibilit') || normalized.includes('duties') || normalized.includes('you will')) {
      return 'responsibilities';
    }
    if (normalized.includes('requirement') || normalized.includes('qualification') || 
        normalized.includes('skills') || normalized.includes('experience')) {
      return 'requirements';
    }
    if (normalized.includes('benefit') || normalized.includes('perks') || 
        normalized.includes('compensation') || normalized.includes('salary')) {
      return 'benefits';
    }
    
    return 'other';
  }

  /**
   * Create fallback content when formatting fails
   */
  private createFallbackContent(html: string, title?: string): FormattedContent {
    // Extract basic text content
    const dom = new JSDOM(html);
    const text = dom.window.document.body?.textContent || '';
    
    const cleanText = text
      .replace(/\s+/g, ' ')
      .trim();

    const excerpt = cleanText.length > EXCERPT_LIMIT 
      ? cleanText.substring(0, EXCERPT_LIMIT - 3) + '...'
      : cleanText;

    return {
      raw_html: html,
      markdown: cleanText,
      plain_text_excerpt: excerpt,
      extracted_title: title,
      content_sections: [{
        type: 'other',
        heading: 'Job Description',
        content: cleanText,
        markdown: cleanText
      }]
    };
  }
}

// Export singleton instance
export const contentFormatter = new ContentFormatter();

// Convenience function for simple formatting
export async function formatJobDescription(
  html: string, 
  url?: string, 
  title?: string
): Promise<FormattedContent> {
  return await contentFormatter.formatJobDescription(html, url, title);
}