import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { lookup } from 'mime-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams, pathname } = new URL(request.url);
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

    // Check if file exists and get file stats
    let stats;
    try {
      await fs.access(filePath);
      stats = await fs.stat(filePath);
    } catch (error) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const mimeType = lookup(filePath) || 'application/octet-stream';
    const fileSize = stats.size;
    
    // Reject non-PDF files with 415 if they request Range
    const rangeHeader = request.headers.get('range');
    const isPdf = mimeType === 'application/pdf';
    
    if (rangeHeader && !isPdf) {
      return NextResponse.json(
        { error: 'Range requests not supported for non-PDF files' },
        { status: 415 }
      );
    }

    // Handle Range requests for PDFs
    if (rangeHeader && isPdf) {
      const ranges = parseRange(rangeHeader, fileSize);
      
      if (!ranges || ranges.length === 0 || ranges[0].start >= fileSize) {
        return NextResponse.json(
          { error: 'Invalid range' },
          { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } }
        );
      }

      const { start, end } = ranges[0];
      const chunkSize = (end - start) + 1;
      
      // Read only the requested chunk
      const buffer = Buffer.alloc(chunkSize);
      const fileHandle = await fs.open(filePath, 'r');
      
      try {
        await fileHandle.read(buffer, 0, chunkSize, start);
        
        return new NextResponse(buffer as unknown as BodyInit, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': mimeType,
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      } finally {
        await fileHandle.close();
      }
    }

    // Normal response (no range request)
    const fileBuffer = await fs.readFile(filePath);
    
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': isPdf ? 'bytes' : 'none',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('File view error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to view file'
      },
      { status: 500 }
    );
  }
}

function parseRange(rangeHeader: string, fileSize: number): Array<{ start: number; end: number }> | null {
  const ranges = [];
  const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  
  if (!rangeMatch) {
    return null;
  }

  const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  ranges.push({ start, end });
  return ranges;
}