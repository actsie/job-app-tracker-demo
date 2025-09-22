/**
 * Centralized configuration with demo-safe defaults
 * Single source of truth for demo vs production behavior
 */

// Parse environment variables with safe defaults
const isDemoServer = process.env.DEMO_MODE === 'true';
const isDemoClient = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const maxFiles = parseInt(process.env.MAX_UPLOAD_FILES || '10', 10);
const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10);
const allowedExts = (process.env.ALLOWED_EXTENSIONS || 'pdf,docx,txt').split(',').map(ext => ext.trim().toLowerCase());
const demoSeed = process.env.DEMO_DATA_SEED || '42';
const sessionTimeout = parseInt(process.env.DEMO_SESSION_TIMEOUT || '3600000', 10); // 1 hour

export const config = {
  // Demo mode detection
  demo: {
    server: isDemoServer,
    client: isDemoClient,
    seed: demoSeed,
    sessionTimeout,
  },
  
  // Upload constraints (stricter in demo)
  upload: {
    maxFiles,
    maxSizeMB,
    maxSizeBytes: maxSizeMB * 1024 * 1024,
    allowedExtensions: allowedExts,
    // Supported MIME types for validation
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ] as const,
  },
  
  // Feature toggles (disabled in demo)
  features: {
    persistence: !isDemoServer,
    webhooks: !isDemoServer && process.env.ENABLE_WEBHOOKS === 'true',
    emailNotifications: !isDemoServer && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    piiScrubbing: isDemoServer, // Only scrub in demo
  },
  
  // Database (ignored in demo)
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./data/tracker.db',
  },
} as const;

// Type helpers
export type Config = typeof config;

// Validation helpers
export const validateFileType = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? config.upload.allowedExtensions.includes(ext) : false;
};

export const validateFileSize = (file: File): boolean => {
  return file.size <= config.upload.maxSizeBytes;
};

export const validateFileMime = (file: File): boolean => {
  return config.upload.allowedMimeTypes.includes(file.type as any);
};

// Demo-specific helpers
export const isDemoMode = () => config.demo.server || config.demo.client;

export const getUploadLimitsMessage = () => {
  const { maxFiles, maxSizeMB, allowedExtensions } = config.upload;
  return `Demo limits: max ${maxFiles} files, ${maxSizeMB}MB each. Allowed: ${allowedExtensions.join(', ')}.`;
};

// Environment logging (development only)
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Config loaded:', {
    demoServer: config.demo.server,
    demoClient: config.demo.client,
    maxFiles: config.upload.maxFiles,
    maxSizeMB: config.upload.maxSizeMB,
    persistence: config.features.persistence,
  });
}