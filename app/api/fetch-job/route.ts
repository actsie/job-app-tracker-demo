import { NextRequest, NextResponse } from 'next/server';
import { fetchJobDescriptionFromUrl } from '@/lib/url-fetcher';
import { parseJobDescription } from '@/lib/enhanced-job-parser';
import { JSDOM } from 'jsdom';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Valid URL is required' },
        { status: 400 }
      );
    }

    const result = await fetchJobDescriptionFromUrl(url);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Enhanced parsing with structured data extraction
    let title = '';
    if (result.html) {
      try {
        const dom = new JSDOM(result.html);
        const titleElement = dom.window.document.querySelector('title');
        title = titleElement?.textContent || '';
      } catch (e) {
        // Ignore title extraction errors
      }
    }

    const parsed = parseJobDescription(result.text, {
      url,
      title,
      html: result.html
    });

    return NextResponse.json({
      text: result.text,
      jd_text: result.text,
      // New 3-format fields
      raw_html: result.raw_html,
      markdown: result.markdown,
      plain_text_excerpt: result.plain_text_excerpt,
      // Enhanced parsing
      company: parsed.company,
      role: parsed.role,
      hasHtml: !!result.html,
      // Include candidates for suggestions
      roleCandidates: parsed.roleCandidates || [],
      companyCandidates: parsed.companyCandidates || [],
    });
  } catch (error) {
    console.error('Error in fetch-job API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}