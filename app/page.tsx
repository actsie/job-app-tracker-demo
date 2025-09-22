'use client';

import { ActiveBoard } from '@/components/active-board';
import { AddJobSimplified } from '@/components/add-job-simplified';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/toaster';
import { FileText, Settings, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import DemoBanner from '@/components/demo-banner';

export default function Home() {
  const [showJobSaver, setShowJobSaver] = useState(false);
  const [activeBoardRefreshTrigger, setActiveBoardRefreshTrigger] = useState(0);
  const [preselectedResumeId, setPreselectedResumeId] = useState<string | null>(null);
  const jobSaverRef = useRef<HTMLDivElement>(null);

  const handleJobSaved = () => {
    // Trigger ActiveBoard refresh when a job is saved via JobDescriptionSaver
    setActiveBoardRefreshTrigger(prev => prev + 1);
    // Reset preselected resume after job is saved
    setPreselectedResumeId(null);
  };

  const handleApplicationAdded = () => {
    // Trigger ActiveBoard refresh when an application is added from recent captures
    setActiveBoardRefreshTrigger(prev => prev + 1);
  };

  // Handle URL parameters for Create Job from Resume Manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const resumeId = urlParams.get('resumeId');
      const fromSource = urlParams.get('from');
      const step = urlParams.get('step');

      if (resumeId && fromSource === 'resumeManager' && step === '1') {
        setPreselectedResumeId(resumeId);
        setShowJobSaver(true);
        
        // Clean up URL parameters
        window.history.replaceState({}, document.title, '/');
        
        // Scroll to job saver after opening
        setTimeout(() => {
          jobSaverRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 100);
      }
    }
  }, []);

  const handleAddJobClick = () => {
    const newState = !showJobSaver;
    setShowJobSaver(newState);
    
    // If opening the job saver, scroll to it after a brief delay to allow rendering
    if (newState) {
      setTimeout(() => {
        jobSaverRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Demo Banner */}
        <DemoBanner />
        
        {/* Header */}
        <div className="text-center space-y-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Job Application Tracker</h1>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            Track your active applications and manage your job search progress
          </p>
        </div>

        
        {/* Main Active Board */}
        <ActiveBoard className="mb-6" refreshTrigger={activeBoardRefreshTrigger} />

        {/* Quick Actions - Compact Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Button 
            onClick={handleAddJobClick}
            className="bg-[#7866CC] hover:bg-[#9B7EF7] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>

          <Link href="/resume-manager">
            <Button variant="outline" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Resumes
            </Button>
          </Link>

          <Link href="/settings">
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>

        {/* Collapsible Add Job Form */}
        {showJobSaver && (
          <div ref={jobSaverRef} className="animate-in slide-in-from-top-2 duration-300">
            <AddJobSimplified 
              onJobSaved={handleJobSaved}
              onCancel={() => {
                setShowJobSaver(false);
                setPreselectedResumeId(null);
              }}
              preselectedResumeId={preselectedResumeId}
            />
          </div>
        )}
      </div>
      
      <Toaster />
    </main>
  );
}