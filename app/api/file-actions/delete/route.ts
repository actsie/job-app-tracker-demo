import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Security check: Only allow deletion in the export directory
    const expectedExportDir = 'Pawgrammer-Exports';
    if (!filePath.includes(expectedExportDir)) {
      return NextResponse.json(
        { error: 'File deletion is only allowed in the Pawgrammer-Exports directory' },
        { status: 403 }
      );
    }

    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(filePath);
      fileExists = true;
    } catch (error) {
      // File doesn't exist, which is fine for deletion
      return NextResponse.json({
        success: true,
        message: 'File does not exist (already deleted)',
        filePath
      });
    }

    if (fileExists) {
      try {
        await fs.unlink(filePath);
        return NextResponse.json({
          success: true,
          message: 'File deleted successfully',
          filePath
        });
      } catch (error) {
        console.error('Failed to delete file:', error);
        
        // Check if it's a permission/lock error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('EBUSY') || errorMessage.includes('ENOENT') || errorMessage.includes('permission')) {
          return NextResponse.json(
            { 
              error: 'File is in use by another application or permission denied',
              details: 'Please close the file in any applications and try again',
              originalError: errorMessage
            },
            { status: 423 } // Locked
          );
        }

        return NextResponse.json(
          { 
            error: 'Failed to delete file',
            details: errorMessage
          },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to delete file',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}