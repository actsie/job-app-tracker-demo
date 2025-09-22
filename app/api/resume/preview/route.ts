import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    try {
      await fs.access(filePath);
      const fileBuffer = await fs.readFile(filePath);
      const extension = filePath.split('.').pop()?.toLowerCase();
      
      let contentType = 'application/octet-stream';
      switch (extension) {
        case 'pdf':
          contentType = 'application/pdf';
          break;
        case 'doc':
          contentType = 'application/msword';
          break;
        case 'docx':
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
        case 'rtf':
          contentType = 'application/rtf';
          break;
      }

      return new NextResponse(fileBuffer as BodyInit, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'File not found or not accessible' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error previewing file:', error);
    return NextResponse.json(
      { error: 'Failed to preview file' },
      { status: 500 }
    );
  }
}