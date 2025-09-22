'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResumeSettings } from '@/components/resume-settings';
import { ResumeManager } from '@/components/resume-manager';
import { Unassigned } from '@/components/unassigned';
import { UndoOperations } from '@/components/undo-operations';
import { 
  Settings, 
  FileText, 
  FolderUp, 
  RotateCcw,
  ArrowLeft,
  Upload
} from 'lucide-react';

type TabType = 'unassigned' | 'manager' | 'settings' | 'operations';

export default function ResumeManagerPage() {
  const [activeTab, setActiveTab] = useState<TabType>('unassigned');

  const tabs = [
    { id: 'unassigned' as TabType, label: 'Unassigned', icon: FolderUp },
    { id: 'manager' as TabType, label: 'Resume Manager', icon: FileText },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
    { id: 'operations' as TabType, label: 'Operations', icon: RotateCcw },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Resume Management System</h1>
            <p className="text-gray-600 mt-1">
              Manage your resume files, versions, and bulk import operations
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Card>
          <CardHeader>
            <div className="flex space-x-1 rounded-lg bg-gray-100 p-1">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              ))}
            </div>
          </CardHeader>
        </Card>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'unassigned' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Unassigned Resumes</CardTitle>
                  <CardDescription>
                    Your resume holding area - drop files here and attach them to jobs quickly
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <FolderUp className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-medium">Drop & Upload</p>
                              <p className="text-sm text-gray-600">Drag files or folders here</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium">Quick Attach</p>
                              <p className="text-sm text-gray-600">≤2 clicks to attach to job</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-purple-600" />
                            <div>
                              <p className="font-medium">Preview & Manage</p>
                              <p className="text-sm text-gray-600">View before attaching</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Unassigned 
                onAttachToJob={(resumeId) => {
                  // TODO: Implement quick attach workflow
                  console.log('Attach resume to job:', resumeId);
                }}
                onCreateJobFromResume={(resumeId) => {
                  // Navigate to home page with Add Job wizard open and resume preselected
                  const params = new URLSearchParams({
                    from: 'resumeManager',
                    resumeId: resumeId,
                    step: '1'
                  });
                  window.location.href = `/?${params.toString()}`;
                }}
              />
            </div>
          )}

          {activeTab === 'manager' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resume Manager</CardTitle>
                  <CardDescription>
                    View and manage your resume files with version history and file operations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-medium">Version Control</p>
                              <p className="text-sm text-gray-600">Track resume versions</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium">File Operations</p>
                              <p className="text-sm text-gray-600">Preview, download, reveal</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-purple-600" />
                            <div>
                              <p className="font-medium">Smart Naming</p>
                              <p className="text-sm text-gray-600">Company_Role_Date format</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <ResumeManager />
            </div>
          )}


          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>
                    Configure resume management behavior, folder paths, and naming conventions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-indigo-50 border-indigo-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-indigo-600" />
                            <div>
                              <p className="font-medium">Folder Path</p>
                              <p className="text-sm text-gray-600">Set managed folder location</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-pink-50 border-pink-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-pink-600" />
                            <div>
                              <p className="font-medium">Copy Behavior</p>
                              <p className="text-sm text-gray-600">Keep originals setting</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-teal-50 border-teal-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-teal-600" />
                            <div>
                              <p className="font-medium">Naming Format</p>
                              <p className="text-sm text-gray-600">Date vs DateTime</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <ResumeSettings />
            </div>
          )}

          {activeTab === 'operations' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Operations History</CardTitle>
                  <CardDescription>
                    View recent operations and undo actions from the current session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-red-50 border-red-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-red-600" />
                            <div>
                              <p className="font-medium">Undo Operations</p>
                              <p className="text-sm text-gray-600">Reverse recent changes</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-yellow-50 border-yellow-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-yellow-600" />
                            <div>
                              <p className="font-medium">Audit Log</p>
                              <p className="text-sm text-gray-600">Track all operations</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gray-50 border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-gray-600" />
                            <div>
                              <p className="font-medium">Session Based</p>
                              <p className="text-sm text-gray-600">Current session only</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <UndoOperations />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}