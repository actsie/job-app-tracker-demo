import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { JobDescription } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }

    const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
    
    try {
      const files = await fs.readdir(jobDescriptionsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = join(jobDescriptionsPath, file);
            const jobData: JobDescription = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            
            if (jobData.uuid === uuid) {
              return NextResponse.json(jobData);
            }
          } catch (error) {
            console.warn(`Failed to read job file ${file}:`, error);
          }
        }
      }
      
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
      
    } catch (error) {
      console.error('Error reading job files:', error);
      return NextResponse.json(
        { error: 'Failed to read job files' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/jobs/[uuid]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }

    const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
    
    // Find and delete the job file
    try {
      const files = await fs.readdir(jobDescriptionsPath);
      let fileFound = false;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = join(jobDescriptionsPath, file);
            const jobData: JobDescription = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            
            if (jobData.uuid === uuid) {
              await fs.unlink(filePath);
              fileFound = true;
              break;
            }
          } catch (error) {
            console.warn(`Failed to read job file ${file}:`, error);
          }
        }
      }
      
      if (!fileFound) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Job deleted successfully' 
      });
      
    } catch (error) {
      console.error('Error deleting job file:', error);
      return NextResponse.json(
        { error: 'Failed to delete job file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in DELETE /api/jobs/[uuid]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const updates = await request.json();


    const jobDescriptionsPath = join(process.cwd(), 'job-descriptions');
    
    // Find and update the job file
    try {
      const files = await fs.readdir(jobDescriptionsPath);
      let fileFound = false;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = join(jobDescriptionsPath, file);
            const jobData: JobDescription = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            
            if (jobData.uuid === uuid) {
              // Merge updates with existing data
              const updatedJob: JobDescription = {
                ...jobData,
                ...updates,
                last_updated: new Date().toISOString()
              };


              // Save updated job back to disk
              await fs.writeFile(filePath, JSON.stringify(updatedJob, null, 2), 'utf-8');
              
              fileFound = true;
              return NextResponse.json({ success: true, job: updatedJob });
            }
          } catch (error) {
            console.warn(`Failed to read job file ${file}:`, error);
          }
        }
      }
      
      if (!fileFound) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
    } catch (error) {
      console.error('Error updating job file:', error);
      return NextResponse.json(
        { error: 'Failed to update job file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in PATCH /api/jobs/[uuid]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}