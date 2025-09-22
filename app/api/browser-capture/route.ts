import { NextRequest, NextResponse } from 'next/server';
import { saveJobDescriptionFromBrowser } from '@/lib/browser-capture';
import { verifyBrowserCapture } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Parse the request
    const body = await request.json();
    const { text, url, html, auth_token } = body;

    // Verify authentication token
    if (!verifyBrowserCapture(auth_token)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Job description text is required' },
        { status: 400 }
      );
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Source URL is required for browser captures' },
        { status: 400 }
      );
    }

    // Save the job description with browser helper metadata
    const result = await saveJobDescriptionFromBrowser(text, url, html);

    return NextResponse.json({
      success: true,
      message: 'Job description captured successfully',
      uuid: result.uuid,
      jsonPath: result.jsonPath,
      txtPath: result.txtPath,
    });
  } catch (error) {
    console.error('Error in browser-capture API:', error);
    return NextResponse.json(
      { error: 'Failed to process browser capture' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}