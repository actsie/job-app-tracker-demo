import { NextRequest, NextResponse } from 'next/server';
import { deduplicationService } from '@/lib/deduplication';

export async function GET() {
  try {
    const result = await deduplicationService.findDuplicates();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to find duplicates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, primaryUuid, duplicateUuids, userAction } = body;

    if (action === 'merge') {
      if (!primaryUuid || !duplicateUuids || !Array.isArray(duplicateUuids)) {
        return NextResponse.json(
          { error: 'primaryUuid and duplicateUuids are required for merge action' },
          { status: 400 }
        );
      }

      const mergedJob = await deduplicationService.mergeJobs(primaryUuid, duplicateUuids, userAction);
      return NextResponse.json({ success: true, mergedJob });
    }

    if (action === 'delete') {
      const { uuid } = body;
      if (!uuid) {
        return NextResponse.json(
          { error: 'uuid is required for delete action' },
          { status: 400 }
        );
      }

      await deduplicationService.deleteJob(uuid, userAction);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "merge" or "delete"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing deduplication action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}