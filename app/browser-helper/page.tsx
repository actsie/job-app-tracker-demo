'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function BrowserHelperPage() {
  const [authToken, setAuthToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAuthToken();
  }, []);

  const fetchAuthToken = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth-token');
      if (!response.ok) {
        throw new Error(`Failed to get auth token: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAuthToken(data.token);
    } catch (error) {
      console.error('Error fetching auth token:', error);
      setError(error instanceof Error ? error.message : 'Failed to load auth token');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${description} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadExtensionFiles = async () => {
    try {
      const response = await fetch('/api/download-extension');
      if (!response.ok) {
        throw new Error('Failed to download extension files');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'job-tracker-browser-extension.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started!",
        description: "Extension files are being downloaded",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download extension files",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Browser Helper Setup</CardTitle>
          <CardDescription>
            Set up the browser helper to capture job descriptions directly from your browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Desktop app is running and ready to receive captures
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Error: {error}
              </span>
              <Button onClick={fetchAuthToken} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser Extension Setup</CardTitle>
          <CardDescription>
            Install the browser extension for seamless job description capture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              1. Download the extension files and install them in your browser
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={downloadExtensionFiles}
              >
                <Download className="h-4 w-4" />
                Download Extension Files
              </Button>
              <Badge variant="secondary">Chrome, Firefox, Edge</Badge>
            </div>
            <p className="text-xs text-gray-500">
              Extension files are located in the browser-extension folder of this project
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              2. Installation instructions:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
              <li>Open Chrome and go to chrome://extensions/</li>
              <li>Enable "Developer mode" in the top right</li>
              <li>Click "Load unpacked" and select the browser-extension folder</li>
              <li>The Job App Tracker icon will appear in your browser toolbar</li>
            </ul>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Authentication Token</CardTitle>
          <CardDescription>
            Your current authentication token (automatically refreshed every 24 hours)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <input
              readOnly
              value={authToken || 'Loading...'}
              className="w-full p-3 font-mono text-sm border rounded-md bg-gray-50"
            />
            <Button
              onClick={() => copyToClipboard(authToken, "Auth token")}
              className="absolute top-2 right-2"
              size="sm"
              variant="outline"
              disabled={!authToken}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            This token authenticates browser helpers with your desktop app. It refreshes automatically.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testing</CardTitle>
          <CardDescription>
            Test your browser helper setup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Visit any job posting website (like LinkedIn, Indeed, Glassdoor) and use your browser helper to capture a job description. 
              The captured job will appear in the Recent Captures section of the main page.
            </p>
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              <a href="/" className="no-underline">
                Go to Main Page
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}