import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { folderPath } = await request.json();
    
    if (!folderPath) {
      return NextResponse.json(
        { valid: false, error: 'Folder path is required' },
        { status: 400 }
      );
    }

    try {
      // Check if folder exists
      await fs.access(folderPath);
      
      // Check if folder is writable by trying to create a temporary file
      const testFile = `${folderPath}/.write-test-${Date.now()}`;
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return NextResponse.json({ valid: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      let errorMessage = 'Folder is not accessible';
      
      if (nodeError.code === 'ENOENT') {
        errorMessage = 'Folder does not exist';
      } else if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        errorMessage = 'Folder is not writable';
      }
      
      return NextResponse.json({ valid: false, error: errorMessage });
    }
  } catch (error) {
    console.error('Error validating folder:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate folder' },
      { status: 500 }
    );
  }
}