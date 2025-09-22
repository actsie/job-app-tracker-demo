import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { basename } from 'path';
import { lookup } from 'mime-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Security check: ensure the path is within expected directories
    if (!filePath.includes('managed-resumes') && !filePath.includes('temp-uploads')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);
    const fileName = basename(filePath);
    const mimeType = lookup(filePath) || 'application/octet-stream';
    
    // Return file for download
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to download file'
      },
      { status: 500 }
    );
  }
}