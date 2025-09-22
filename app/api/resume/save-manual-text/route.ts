import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { jobUuid, filename, content } = await request.json();
    
    if (!jobUuid || !filename || !content) {
      return NextResponse.json(
        { error: 'Job UUID, filename, and content are required' },
        { status: 400 }
      );
    }

    // Normalize line endings and ensure UTF-8 encoding
    const normalizedContent = content
      .replace(/\r\n/g, '\n')  // Convert Windows line endings
      .replace(/\r/g, '\n')    // Convert Mac line endings
      .trim();                 // Remove trailing whitespace

    // Ensure managed-resumes directory exists
    const managedResumesDir = './managed-resumes';
    try {
      await fs.access(managedResumesDir);
    } catch {
      await fs.mkdir(managedResumesDir, { recursive: true });
    }

    // Create full file path
    const relativePath = join(managedResumesDir, filename);
    const absolutePath = resolve(relativePath);
    
    // Write content to file with explicit UTF-8 encoding
    await fs.writeFile(relativePath, normalizedContent, { encoding: 'utf-8' });

    // Verify the file was written correctly by reading it back
    const savedContent = await fs.readFile(relativePath, { encoding: 'utf-8' });
    const contentMatches = savedContent === normalizedContent;

    return NextResponse.json({
      success: true,
      filename,
      filePath: absolutePath, // Return absolute path
      relativePath, // Also return relative path for compatibility
      contentVerified: contentMatches,
      message: 'Manual resume text saved successfully'
    });

  } catch (error) {
    console.error('Save manual resume text error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to save manual resume text',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}