import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OperationLogEntry } from './types';

const OPERATIONS_LOG_FILE = join(process.cwd(), 'operations-log.json');
const MAX_LOG_ENTRIES = 1000;

export class OperationsLogService {
  private sessionId: string;
  private logEntries: OperationLogEntry[] = [];

  constructor() {
    this.sessionId = uuidv4();
  }

  async loadLog(): Promise<OperationLogEntry[]> {
    try {
      const logData = await fs.readFile(OPERATIONS_LOG_FILE, 'utf-8');
      this.logEntries = JSON.parse(logData);
    } catch {
      this.logEntries = [];
    }
    return this.logEntries;
  }

  async saveLog(): Promise<void> {
    // Keep only the most recent entries
    if (this.logEntries.length > MAX_LOG_ENTRIES) {
      this.logEntries = this.logEntries.slice(-MAX_LOG_ENTRIES);
    }
    
    await fs.writeFile(OPERATIONS_LOG_FILE, JSON.stringify(this.logEntries, null, 2), 'utf-8');
  }

  async logOperation(
    operationType: OperationLogEntry['operation_type'],
    details: OperationLogEntry['details'],
    canUndo: boolean = false
  ): Promise<string> {
    const entry: OperationLogEntry = {
      id: uuidv4(),
      operation_type: operationType,
      timestamp: new Date().toISOString(),
      details,
      can_undo: canUndo,
      session_id: this.sessionId
    };

    await this.loadLog();
    this.logEntries.push(entry);
    await this.saveLog();

    return entry.id;
  }

  async getRecentOperations(limit: number = 10): Promise<OperationLogEntry[]> {
    await this.loadLog();
    return this.logEntries
      .slice(-limit)
      .reverse(); // Most recent first
  }

  async getUndoableOperations(): Promise<OperationLogEntry[]> {
    await this.loadLog();
    return this.logEntries
      .filter(entry => entry.can_undo && entry.session_id === this.sessionId)
      .slice(-10) // Last 10 undoable operations in current session
      .reverse();
  }

  async markOperationAsUndone(operationId: string): Promise<void> {
    await this.loadLog();
    const entry = this.logEntries.find(e => e.id === operationId);
    if (entry) {
      entry.can_undo = false;
      await this.saveLog();
    }
  }

  async getOperationsByType(operationType: OperationLogEntry['operation_type']): Promise<OperationLogEntry[]> {
    await this.loadLog();
    return this.logEntries.filter(entry => entry.operation_type === operationType);
  }

  async clearOldEntries(olderThanDays: number = 30): Promise<number> {
    await this.loadLog();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const originalCount = this.logEntries.length;
    this.logEntries = this.logEntries.filter(entry => 
      new Date(entry.timestamp) > cutoffDate
    );
    
    await this.saveLog();
    return originalCount - this.logEntries.length;
  }
}

export const operationsLog = new OperationsLogService();