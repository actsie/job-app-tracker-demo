import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { generateDemoApplications, createDemoSession } from '@/lib/demo-data';

/**
 * Demo seed API endpoint
 * Generates deterministic demo data for testing
 */
export async function POST(request: Request) {
  try {
    // Only allow in demo mode
    if (!config.demo.server) {
      return NextResponse.json(
        { error: 'Demo seed endpoint is only available in demo mode' },
        { status: 403 }
      );
    }

    // Get session ID from request or generate default
    const body = await request.json().catch(() => ({}));
    const sessionId = body.sessionId || 'default';
    
    // Log demo usage event
    console.log('🎯 Demo seed requested', {
      sessionId,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')?.slice(0, 100),
    });
    
    // Generate demo session data
    const demoSession = createDemoSession(sessionId);
    
    // Return preview-only response (no persistence)
    return NextResponse.json({
      mode: 'demo',
      preview: demoSession.applications,
      session: {
        id: demoSession.id,
        createdAt: demoSession.createdAt,
        itemCount: demoSession.applications.length,
      },
      persisted: false,
      message: 'Demo data generated successfully. Data is temporary and will not be saved.',
    });

  } catch (error) {
    console.error('Demo seed error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate demo data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get demo session info (GET)
 */
export async function GET() {
  if (!config.demo.server) {
    return NextResponse.json(
      { error: 'Demo mode not active' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    mode: 'demo',
    config: {
      maxFiles: config.upload.maxFiles,
      maxSizeMB: config.upload.maxSizeMB,
      allowedExtensions: config.upload.allowedExtensions,
      piiScrubbing: config.features.piiScrubbing,
    },
    message: 'Demo mode active - uploads work but data resets periodically',
  });
}