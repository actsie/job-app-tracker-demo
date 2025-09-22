/**
 * PII scrubbing utilities for demo mode
 * Redacts sensitive information from parsed content
 */

import { config } from './config';

// Common PII patterns
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// Replacement tokens
const REDACTED_EMAIL = '[email-redacted]';
const REDACTED_PHONE = '[phone-redacted]';
const REDACTED_SSN = '[ssn-redacted]';
const REDACTED_URL = '[url-redacted]';

/**
 * Scrub PII from text content
 */
export const scrubText = (text: string): string => {
  if (!config.features.piiScrubbing || !text) return text;
  
  return text
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(PHONE_PATTERN, REDACTED_PHONE)
    .replace(SSN_PATTERN, REDACTED_SSN)
    .replace(URL_PATTERN, REDACTED_URL);
};

/**
 * Scrub PII from file upload results
 */
export const scrubFileResult = (result: any) => {
  if (!config.features.piiScrubbing || !result) return result;
  
  return {
    ...result,
    text: scrubText(result.text || ''),
    extractedText: scrubText(result.extractedText || ''),
    // Keep analysis metadata but scrub the raw text
    analysis: result.analysis ? {
      ...result.analysis,
      // Don't scrub detected company/role as they're intentionally extracted
      detectedCompany: result.analysis.detectedCompany,
      detectedRole: result.analysis.detectedRole,
      wordCount: result.analysis.wordCount,
      hasContactInfo: result.analysis.hasContactInfo,
    } : result.analysis,
  };
};

/**
 * Scrub PII from bulk upload results
 */
export const scrubBulkResults = (results: any[]) => {
  if (!config.features.piiScrubbing) return results;
  
  return results.map(result => scrubFileResult(result));
};

/**
 * Scrub PII from job application data
 */
export const scrubJobData = (job: any) => {
  if (!config.features.piiScrubbing || !job) return job;
  
  return {
    ...job,
    notes: scrubText(job.notes || ''),
    description: scrubText(job.description || ''),
    // Keep company/role/title as they're core functionality
    company: job.company,
    role: job.role,
    title: job.title,
  };
};

/**
 * Check if text contains PII (for warnings)
 */
export const containsPII = (text: string): boolean => {
  if (!text) return false;
  
  return (
    EMAIL_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    SSN_PATTERN.test(text)
  );
};

/**
 * Get PII scrubbing status message
 */
export const getPIIStatus = () => {
  return config.features.piiScrubbing 
    ? 'PII scrubbing enabled (demo mode)'
    : 'PII scrubbing disabled (production mode)';
};

// Export patterns for testing
export const patterns = {
  EMAIL_PATTERN,
  PHONE_PATTERN,
  SSN_PATTERN,
  URL_PATTERN,
} as const;