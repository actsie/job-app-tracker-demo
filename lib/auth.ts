import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const AUTH_FILE_PATH = join(process.cwd(), '.browser-auth-token');
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AuthToken {
  token: string;
  created_at: number;
  expires_at: number;
}

export async function generateAuthToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  
  const authData: AuthToken = {
    token,
    created_at: now,
    expires_at: now + TOKEN_LIFETIME_MS,
  };

  try {
    await fs.writeFile(AUTH_FILE_PATH, JSON.stringify(authData, null, 2), 'utf-8');
    return token;
  } catch (error) {
    console.error('Failed to save auth token:', error);
    throw new Error('Could not generate authentication token');
  }
}

export async function getCurrentAuthToken(): Promise<string | null> {
  try {
    const data = await fs.readFile(AUTH_FILE_PATH, 'utf-8');
    const authData: AuthToken = JSON.parse(data);
    
    // Check if token is still valid
    if (Date.now() > authData.expires_at) {
      // Token expired, generate new one
      return await generateAuthToken();
    }
    
    return authData.token;
  } catch (error) {
    // No token file or corrupted, generate new one
    return await generateAuthToken();
  }
}

export async function verifyBrowserCapture(providedToken: string): Promise<boolean> {
  if (!providedToken || typeof providedToken !== 'string') {
    return false;
  }

  try {
    const data = await fs.readFile(AUTH_FILE_PATH, 'utf-8');
    const authData: AuthToken = JSON.parse(data);
    
    // Check if token is valid and not expired
    return authData.token === providedToken && Date.now() <= authData.expires_at;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}

export async function refreshAuthTokenIfNeeded(): Promise<void> {
  try {
    await getCurrentAuthToken(); // This will automatically refresh if needed
  } catch (error) {
    console.error('Failed to refresh auth token:', error);
  }
}