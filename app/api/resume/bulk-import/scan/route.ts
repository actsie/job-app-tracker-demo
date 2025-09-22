import { NextRequest, NextResponse } from 'next/server';
import { bulkImportService } from '@/lib/bulk-import';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { folderPath } = await request.json();
    
    if (!folderPath) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      );
    }

    // Load available jobs for mapping suggestions
    const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
    const availableJobs: any[] = [];
    
    try {
      const files = await fs.readdir(jobDescriptionsPath);
      const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('archived'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = join(jobDescriptionsPath, file);
          const jobData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          availableJobs.push(jobData);
        } catch (error) {
          console.warn(`Failed to load job file ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load job descriptions:', error);
    }

    const operation = await bulkImportService.createPreview(folderPath, availableJobs);
    
    return NextResponse.json({ operation });
  } catch (error) {
    console.error('Error scanning folder for bulk import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan folder' },
      { status: 500 }
    );
  }
}