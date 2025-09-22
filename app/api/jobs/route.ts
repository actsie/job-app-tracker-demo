import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { JobDescription } from '@/lib/types';

export async function GET() {
  try {
    const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
    const jobs: JobDescription[] = [];
    
    try {
      const files = await fs.readdir(jobDescriptionsPath);
      const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('archived'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = join(jobDescriptionsPath, file);
          const jobData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          
          // Only include jobs that have company and role information
          if (jobData.company && jobData.role) {
            jobs.push(jobData);
          }
        } catch (error) {
          console.warn(`Failed to load job file ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Job descriptions directory not found or not accessible:', error);
    }
    
    // Sort by most recently fetched
    jobs.sort((a, b) => new Date(b.fetched_at_iso).getTime() - new Date(a.fetched_at_iso).getTime());
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error loading jobs:', error);
    return NextResponse.json(
      { error: 'Failed to load jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const jobData: JobDescription = await request.json();
    const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
    
    // Ensure directory exists
    try {
      await fs.mkdir(jobDescriptionsPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
    
    // Save as JSON file
    const filePath = join(jobDescriptionsPath, `${jobData.uuid}.json`);
    await fs.writeFile(filePath, JSON.stringify(jobData, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true, job: jobData });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}