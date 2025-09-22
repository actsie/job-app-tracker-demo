import { deduplicationService } from './deduplication';

class BackgroundScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Background scheduler started');
    
    // Load config and start scheduled tasks
    await this.setupScheduledDeduplication();
    
    // Check for config changes every minute
    const configCheckInterval = setInterval(async () => {
      await this.setupScheduledDeduplication();
    }, 60 * 1000);
    
    this.intervals.set('config-check', configCheckInterval);
  }

  async stop() {
    this.isRunning = false;
    
    // Clear all intervals
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`Cleared interval: ${key}`);
    }
    
    this.intervals.clear();
    console.log('Background scheduler stopped');
  }

  private async setupScheduledDeduplication() {
    const config = await deduplicationService.loadConfig();
    
    // Clear existing deduplication interval if it exists
    const existingInterval = this.intervals.get('deduplication');
    if (existingInterval) {
      clearInterval(existingInterval);
      this.intervals.delete('deduplication');
    }

    if (config.schedule_enabled) {
      console.log(`Setting up scheduled deduplication every ${config.schedule_interval} minutes`);
      
      const intervalMs = config.schedule_interval * 60 * 1000;
      const deduplicationInterval = setInterval(async () => {
        console.log('Running scheduled deduplication...');
        try {
          const result = await deduplicationService.findDuplicates();
          console.log(`Scheduled deduplication completed. Found ${result.total_duplicates_found} duplicates in ${result.duplicate_groups.length} groups`);
          
          // Store the result for later retrieval if needed
          // In a real application, you might want to store this in a database or cache
          await this.storeScheduledResult(result);
        } catch (error) {
          console.error('Error during scheduled deduplication:', error);
        }
      }, intervalMs);
      
      this.intervals.set('deduplication', deduplicationInterval);
      console.log(`Scheduled deduplication interval set for ${config.schedule_interval} minutes`);
    } else {
      console.log('Scheduled deduplication is disabled');
    }
  }

  private async storeScheduledResult(result: any) {
    // In a more sophisticated implementation, you would store this in a database
    // For now, we'll just log it and optionally write to a file
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const resultsDir = path.join(process.cwd(), 'scheduled-results');
      await fs.mkdir(resultsDir, { recursive: true });
      
      const resultFile = path.join(resultsDir, `dedup-${Date.now()}.json`);
      await fs.writeFile(resultFile, JSON.stringify({
        ...result,
        scheduled_run: true,
        run_timestamp: new Date().toISOString()
      }, null, 2));
      
      console.log(`Scheduled deduplication result saved to: ${resultFile}`);
    } catch (error) {
      console.error('Failed to store scheduled result:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeIntervals: Array.from(this.intervals.keys()),
      intervalCount: this.intervals.size
    };
  }
}

export const backgroundScheduler = new BackgroundScheduler();

// Auto-start the scheduler when the module is loaded
if (typeof window === 'undefined') {
  // Only run on server-side
  backgroundScheduler.start().catch(console.error);
}