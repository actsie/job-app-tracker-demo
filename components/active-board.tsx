'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { JobDescription } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, ChevronDown, ChevronRight, Trash2, RotateCcw, Bell, Edit2, Calendar, Clock, Mail, Download, History, FileText, Presentation, Plus, Link, File, CalendarPlus } from 'lucide-react';
import { AddApplication } from './add-application';
import { UpcomingReminders } from './upcoming-reminders';
import { ReminderEditor } from './reminder-editor';
import { FollowupToggle } from './followup-toggle';
import { EmailDraftEditor } from './email-draft-editor';
import { CSVExportModal } from './csv-export-modal';
import { ExportHistoryPanel } from './export-history-panel';
import JDViewer from './jd-viewer';
import InterviewPrepMode from './interview-prep-mode';
import { notificationManager } from '@/lib/notifications';
import { updateJobWithFollowupLogic, saveJobWithFollowup } from '@/lib/followup-reminders';
import { AttachExistingResumeDialog } from './attach-existing-resume-dialog';

interface ActiveBoardProps {
  className?: string;
  refreshTrigger?: number;
}

type SortField = 'company' | 'date' | 'status' | 'reminder';
type SortOrder = 'asc' | 'desc';
type RejectedFilter = 'hide' | 'show' | 'only';
type StatusFilter = 'all' | 'saved' | 'interested' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';

export function ActiveBoard({ className, refreshTrigger }: ActiveBoardProps) {
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [rejectedFilter, setRejectedFilter] = useState<RejectedFilter>('hide');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedRejected, setExpandedRejected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobDescription | null>(null);
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false);
  const [jobForReminder, setJobForReminder] = useState<JobDescription | null>(null);
  const [emailDraftEditorOpen, setEmailDraftEditorOpen] = useState(false);
  const [jobForEmailDraft, setJobForEmailDraft] = useState<JobDescription | null>(null);
  const [editingField, setEditingField] = useState<{jobId: string, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [csvExportModalOpen, setCsvExportModalOpen] = useState(false);
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false);
  const [jdViewerOpen, setJdViewerOpen] = useState(false);
  const [jobForJdViewer, setJobForJdViewer] = useState<JobDescription | null>(null);
  const [interviewPrepOpen, setInterviewPrepOpen] = useState(false);
  const [jobForInterviewPrep, setJobForInterviewPrep] = useState<JobDescription | null>(null);
  const [attachResumeDialogOpen, setAttachResumeDialogOpen] = useState(false);
  const [jobForAttachResume, setJobForAttachResume] = useState<JobDescription | null>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const { toast } = useToast();

  // Load jobs and sorting preferences from localStorage
  useEffect(() => {
    const savedSort = localStorage.getItem('activeBoard_sort');
    if (savedSort) {
      const { field, order } = JSON.parse(savedSort);
      setSortField(field);
      setSortOrder(order);
    }
    
    // Load status filter preference for session
    const savedStatusFilter = sessionStorage.getItem('activeBoard_statusFilter');
    if (savedStatusFilter) {
      setStatusFilter(savedStatusFilter as StatusFilter);
    }
  }, []);

  // Fetch jobs function
  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs');
      const data = await response.json();
      
      // Filter to only active applications (not archived)
      const activeJobs = data.jobs.filter((job: JobDescription) => !job.is_archived);
      
      // Merge with localStorage data (reminders, etc.)
      const jobsWithLocalData = activeJobs.map((job: JobDescription) => {
        const storageKey = `job_${job.uuid}`;
        const localData = localStorage.getItem(storageKey);
        
        if (localData) {
          try {
            const localJob = JSON.parse(localData);
            // Merge local data (reminders, etc.) with server data
            return {
              ...job,
              next_reminder: localJob.next_reminder,
              reminder_ics_downloaded: localJob.reminder_ics_downloaded,
              followup_reminder: localJob.followup_reminder,
              followup_enabled: localJob.followup_enabled,
              // Preserve other local-only fields
              last_updated: localJob.last_updated || job.last_updated,
            };
          } catch (error) {
            console.warn(`Failed to parse local data for job ${job.uuid}:`, error);
            return job;
          }
        }
        
        return job;
      });
      
      setJobs(jobsWithLocalData);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch jobs on mount and when refreshTrigger changes
  useEffect(() => {
    fetchJobs();
  }, [refreshTrigger]);

  // Save sorting and filter preferences
  useEffect(() => {
    localStorage.setItem('activeBoard_sort', JSON.stringify({ 
      field: sortField, 
      order: sortOrder 
    }));
  }, [sortField, sortOrder]);

  // Save status filter preference for session
  useEffect(() => {
    sessionStorage.setItem('activeBoard_statusFilter', statusFilter);
  }, [statusFilter]);

  // Handle status updates with local storage and follow-up reminder logic
  const updateJobStatus = useCallback(async (jobId: string, newStatus: string) => {
    // Find the job to update
    const jobToUpdate = jobs.find(job => job.uuid === jobId);
    if (!jobToUpdate) return;

    const updates = {
      application_status: newStatus as JobDescription['application_status'],
      last_updated: new Date().toISOString()
    };
    
    // Apply follow-up reminder logic
    const updatedJob = updateJobWithFollowupLogic(jobToUpdate, updates);
    
    // Save to localStorage for persistence
    saveJobWithFollowup(updatedJob);
    
    // Auto-open reminder modal when status changes to "Applied"
    if (newStatus === 'applied' && !jobToUpdate.next_reminder) {
      handleSetReminder(updatedJob);
    }
    
    // Persist to backend API
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update job status');
      }

      // Update local state
      const updatedJobs = jobs.map(job => 
        job.uuid === jobId ? updatedJob : job
      );
      setJobs(updatedJobs);
    } catch (error) {
      console.error('Failed to update job status:', error);
      toast({
        title: "Update failed",
        description: "Failed to update job status. Please try again.",
        variant: "destructive",
      });
    }
  }, [jobs, toast]);

  const updateJobField = useCallback(async (jobId: string, field: string, newValue: string) => {
    // Find the job to update
    const jobToUpdate = jobs.find(job => job.uuid === jobId);
    if (!jobToUpdate) return;

    const updates = {
      [field]: newValue,
      last_updated: new Date().toISOString()
    };
    
    // Apply follow-up reminder logic
    const updatedJob = updateJobWithFollowupLogic(jobToUpdate, updates);
    
    // Save to localStorage for persistence
    saveJobWithFollowup(updatedJob);
    
    // Persist to backend API
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update job field');
      }

      // Update local state
      const updatedJobs = jobs.map(job => 
        job.uuid === jobId ? updatedJob : job
      );
      setJobs(updatedJobs);
    } catch (error) {
      console.error('Failed to update job field:', error);
      toast({
        title: "Update failed",
        description: "Failed to update job field. Please try again.",
        variant: "destructive",
      });
    }
  }, [jobs, toast]);

  // Load job data from localStorage on mount and ensure follow-up reminders are properly scheduled
  useEffect(() => {
    const loadJobsFromStorage = () => {
      const updatedJobs = jobs.map(job => {
        const storageKey = `job_${job.uuid}`;
        const storedData = localStorage.getItem(storageKey);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          const mergedJob = { ...job, ...parsed };
          
          // Ensure follow-up reminder logic is applied (in case it wasn't properly saved before)
          const processedJob = updateJobWithFollowupLogic(mergedJob, {});
          
          // Save back if there were any updates
          if (JSON.stringify(processedJob) !== JSON.stringify(mergedJob)) {
            saveJobWithFollowup(processedJob);
          }
          
          return processedJob;
        }
        return job;
      });
      
      if (JSON.stringify(updatedJobs) !== JSON.stringify(jobs)) {
        setJobs(updatedJobs);
      }
    };

    if (jobs.length > 0) {
      loadJobsFromStorage();
    }
  }, [jobs.length]); // Only run when jobs are initially loaded

  // Handle permanent delete
  const handleDeleteJob = useCallback(async (job: JobDescription) => {
    try {
      const response = await fetch(`/api/jobs/${job.uuid}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setJobs(jobs.filter(j => j.uuid !== job.uuid));
        localStorage.removeItem(`job_${job.uuid}`);
        
        // Cancel any reminders for this job
        const reminderId = `reminder_${job.uuid}`;
        notificationManager.cancelReminder(reminderId);
        
        toast({
          title: "Job deleted",
          description: `${job.company} - ${job.role} has been permanently deleted.`,
        });
      } else {
        throw new Error('Failed to delete job');
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete the job. Please try again.",
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  }, [jobs, toast]);

  // Handle restore (change from rejected to interested)
  const handleRestoreJob = useCallback(async (jobId: string) => {
    await updateJobStatus(jobId, 'interested');
    toast({
      title: "Job restored",
      description: "Job status changed to 'interested' and is now visible in active applications.",
    });
  }, [updateJobStatus, toast]);

  // Toggle expanded state for rejected items
  const toggleExpandedRejected = useCallback((jobId: string) => {
    const newExpanded = new Set(expandedRejected);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedRejected(newExpanded);
  }, [expandedRejected]);

  const handleApplicationAdded = useCallback((newApplication: JobDescription) => {
    setJobs(prevJobs => [...prevJobs, newApplication]);
  }, []);

  const handleEditField = (jobId: string, field: string, currentValue: string) => {
    setEditingField({ jobId, field });
    setEditingValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (editingField) {
      updateJobField(editingField.jobId, editingField.field, editingValue);
      setEditingField(null);
      setEditingValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditingValue('');
  };

  const handleSetReminder = (job: JobDescription) => {
    setJobForReminder(job);
    setReminderEditorOpen(true);
  };

  const handleExportReminderToCalendar = (job: JobDescription) => {
    if (!job.next_reminder) {
      toast({
        title: "No reminder set",
        description: "Please set a reminder first before exporting to calendar.",
        variant: "destructive",
      });
      return;
    }

    const reminderDate = new Date(job.next_reminder);
    
    // Create URL with query parameters
    const params = new URLSearchParams({
      company: job.company || 'Unknown Company',
      role: job.role || 'Unknown Role',
      date: reminderDate.toISOString(),
      message: 'Follow up on this application',
      ...(job.source_url && { url: job.source_url }),
      ...(job.uuid && { uuid: job.uuid }),
    });

    // Trigger download
    const downloadUrl = `/api/reminder/ics?${params.toString()}`;
    window.open(downloadUrl, '_blank');

    // Update job to mark ICS as downloaded
    const updatedJob = {
      ...job,
      reminder_ics_downloaded: true,
      last_updated: new Date().toISOString(),
    };

    // Save to localStorage
    const storageKey = `job_${job.uuid}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedJob));

    // Update the jobs state
    const updatedJobs = jobs.map(j => j.uuid === job.uuid ? updatedJob : j);
    setJobs(updatedJobs);

    toast({
      title: "Calendar event exported",
      description: "The .ics file will download. Double-click it to add to your calendar.",
    });
  };

  const handleOpenEmailDraft = (job: JobDescription) => {
    setJobForEmailDraft(job);
    setEmailDraftEditorOpen(true);
  };

  const handleViewJD = (job: JobDescription) => {
    setJobForJdViewer(job);
    setJdViewerOpen(true);
  };

  const handleInterviewPrep = (job: JobDescription) => {
    setJobForInterviewPrep(job);
    setInterviewPrepOpen(true);
  };

  const handleAttachResume = (job: JobDescription) => {
    setJobForAttachResume(job);
    setAttachResumeDialogOpen(true);
  };

  const handleReminderChange = () => {
    // Reload jobs from localStorage to get updated reminder info
    const updatedJobs = jobs.map(job => {
      const storageKey = `job_${job.uuid}`;
      const storedData = localStorage.getItem(storageKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        return { ...job, ...parsed };
      }
      return job;
    });
    setJobs(updatedJobs);
  };

  const handleOpenJobFromReminder = (companyName: string, jobUuid?: string) => {
    // If we have a specific UUID, try to find and highlight that job
    if (jobUuid) {
      const job = jobs.find(j => j.uuid === jobUuid);
      if (job) {
        setHighlightedJobId(jobUuid);
        setSearchTerm(companyName);
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedJobId(null), 3000);
        return;
      }
    }
    
    // Fallback: filter by company name
    setSearchTerm(companyName);
    
    // Find first job matching company name and highlight it
    const matchingJob = jobs.find(j => 
      j.company?.toLowerCase().includes(companyName.toLowerCase())
    );
    if (matchingJob) {
      setHighlightedJobId(matchingJob.uuid);
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightedJobId(null), 3000);
    }
  };

  const handleEmailDraftFromNotification = useCallback((reminder: any) => {
    // Find the job by UUID and open email draft
    const job = jobs.find(j => j.uuid === reminder.jobUuid);
    if (job) {
      handleOpenEmailDraft(job);
    } else {
      toast({
        title: 'Job not found',
        description: 'Could not find the job application for this reminder.',
        variant: 'destructive'
      });
    }
  }, [jobs, toast]);

  // Listen for notification events to open email draft
  useEffect(() => {
    notificationManager.on('openEmailDraft', handleEmailDraftFromNotification);
    
    return () => {
      notificationManager.off('openEmailDraft', handleEmailDraftFromNotification);
    };
  }, [handleEmailDraftFromNotification]);

  const handleLoadTestApplications = async () => {
    try {
      // Use existing jobs from the file system as test data
      // Update some of them with different statuses and reminders to showcase all features
      const existingJobs = [...jobs];
      
      // If we have existing jobs, enhance them with better test data
      if (existingJobs.length > 0) {
        const statusOptions = ['interested', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];
        const enhancedJobs = existingJobs.slice(0, 6).map((job, index) => ({
          ...job,
          application_status: statusOptions[index] as JobDescription['application_status'],
          applied_date: new Date(Date.now() - (index * 3 + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          next_reminder: index < 3 ? new Date(Date.now() + (index + 1) * 2 * 24 * 60 * 60 * 1000).toISOString() : undefined,
          last_updated: new Date().toISOString()
        }));

        // Save the enhanced jobs to persistent storage
        for (const job of enhancedJobs) {
          try {
            await fetch(`/api/jobs/${job.uuid}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                application_status: job.application_status,
                applied_date: job.applied_date,
                next_reminder: job.next_reminder || null,
                last_updated: job.last_updated
              })
            });
          } catch (error) {
            console.warn(`Failed to update job ${job.uuid}:`, error);
          }
        }

        // Update state with enhanced jobs
        setJobs(prevJobs => prevJobs.map(existingJob => {
          const enhanced = enhancedJobs.find(ej => ej.uuid === existingJob.uuid);
          return enhanced || existingJob;
        }));
        
        toast({
          title: 'Test Applications Loaded',
          description: `Enhanced ${enhancedJobs.length} applications with test data including all 6 status types.`
        });
      } else {
        // Create sample test applications when no existing jobs are found
        const testCompanies = [
          { 
            company: 'Google', 
            role: 'Software Engineer', 
            location: 'Mountain View, CA',
            jobDescription: `Google is seeking a talented Software Engineer to join our team in Mountain View. You'll work on large-scale distributed systems that impact billions of users worldwide.

Key Responsibilities:
• Design and implement scalable backend services
• Collaborate with cross-functional teams on product development  
• Write efficient, maintainable code in Go, Java, or Python
• Participate in code reviews and technical discussions
• Debug and optimize system performance

Requirements:
• Bachelor's degree in Computer Science or related field
• 3+ years of software development experience
• Strong knowledge of data structures and algorithms
• Experience with distributed systems and microservices
• Proficiency in at least one programming language

What we offer:
• Competitive salary and equity package
• Comprehensive health benefits
• 401(k) matching
• Professional development opportunities
• Flexible work arrangements`,
            interviewPrepNotes: `## Key Questions to Ask
• What does a typical day look like for this team?
• How do you measure success for this role?
• What are the biggest technical challenges the team is facing?
• How does the team handle code reviews and technical debt?
• What opportunities are there for growth and learning?

## Personal Experiences & Examples
• Project where I optimized database queries reducing response time by 40%
• Led migration of monolithic service to microservices architecture
• Experience debugging production issues in distributed systems
• Collaboration with product managers on feature prioritization

## Company Research
• Google's mission: "Organize the world's information and make it universally accessible"
• Recent focus on AI/ML integration across products
• Strong engineering culture with emphasis on code quality
• Known for innovative projects like Search, Cloud, and Android

## Technical Preparation
• Review system design principles (load balancing, caching, databases)
• Practice coding problems on data structures and algorithms
• Understand Google's tech stack (Go, Java, Python, Kubernetes)
• Be ready to discuss scalability and performance optimization`
          },
          { 
            company: 'Microsoft', 
            role: 'Frontend Developer', 
            location: 'Seattle, WA',
            jobDescription: `Microsoft is looking for a Frontend Developer to work on cutting-edge web applications that serve millions of users globally.

Key Responsibilities:
• Develop responsive web applications using React and TypeScript
• Collaborate with UX designers to implement pixel-perfect interfaces
• Optimize application performance and accessibility
• Write unit tests and participate in automated testing practices
• Work closely with backend teams to integrate APIs

Requirements:
• Bachelor's degree in Computer Science or equivalent experience
• 2+ years of frontend development experience
• Strong proficiency in JavaScript, HTML, and CSS
• Experience with React, Angular, or Vue.js
• Knowledge of modern build tools and workflows

Benefits:
• Competitive compensation and stock options
• Comprehensive healthcare coverage
• Flexible work from home options
• Learning and development budget
• Inclusive and diverse work environment`,
            interviewPrepNotes: `## Key Questions to Ask
• What frontend frameworks and tools does the team use?
• How do you ensure accessibility and performance standards?
• What's the process for collaborating with designers and product teams?
• How do you handle browser compatibility and testing?
• What opportunities exist for frontend architecture decisions?

## Personal Experiences & Examples
• Built responsive dashboard improving user engagement by 30%
• Implemented accessibility features meeting WCAG 2.1 standards
• Led frontend migration from jQuery to React
• Experience with performance optimization (lazy loading, code splitting)

## Company Research
• Microsoft's transformation to cloud-first, mobile-first company
• Strong commitment to accessibility and inclusive design
• Azure cloud platform and Office 365 ecosystem
• Focus on developer productivity and tools

## Technical Preparation
• Review React hooks, context, and performance optimization
• Practice CSS Grid, Flexbox, and responsive design
• Understand webpack, babel, and modern build tools
• Be ready to discuss accessibility best practices and performance metrics`
          },
          { 
            company: 'Apple', 
            role: 'iOS Developer', 
            location: 'Cupertino, CA',
            jobDescription: `Apple is seeking an iOS Developer to create exceptional mobile experiences for millions of users worldwide.

Key Responsibilities:
• Develop native iOS applications using Swift and Objective-C
• Collaborate with design and product teams to implement user interfaces
• Optimize app performance and memory usage
• Integrate with backend services and APIs
• Follow Apple's Human Interface Guidelines and best practices

Requirements:
• Bachelor's degree in Computer Science or related field
• 3+ years of iOS development experience
• Strong knowledge of Swift and iOS frameworks
• Experience with Xcode, Interface Builder, and debugging tools
• Understanding of app store submission and review process

Apple offers:
• Competitive salary and stock purchase plan
• Comprehensive health and wellness benefits
• On-site fitness facilities and wellness programs
• Employee discounts on Apple products
• Innovation-focused work environment`,
            interviewPrepNotes: `## Key Questions to Ask
• What iOS frameworks and technologies does the team work with?
• How does the team handle app performance and optimization?
• What's the process for user interface design and implementation?
• How do you ensure app quality and user experience?
• What opportunities exist for working on new iOS features?

## Personal Experiences & Examples
• Developed iOS app with 50k+ downloads and 4.8 star rating
• Implemented Core Data for efficient local storage
• Experience with SwiftUI and Combine for reactive programming
• Optimized app reducing memory usage by 25% and improving launch time

## Company Research
• Apple's focus on privacy, security, and user experience
• Continuous innovation in mobile technology and hardware
• Strong ecosystem integration (iPhone, iPad, Mac, Watch)
• Commitment to environmental sustainability

## Technical Preparation
• Review iOS architecture patterns (MVC, MVVM, VIPER)
• Practice Swift programming and iOS-specific APIs
• Understand memory management and performance optimization
• Be ready to discuss app store guidelines and user experience principles`
          },
          { 
            company: 'Amazon', 
            role: 'Full Stack Developer', 
            location: 'Seattle, WA',
            jobDescription: `Amazon Web Services (AWS) is looking for a Full Stack Developer to build scalable web applications that power the world's most comprehensive cloud platform.

Key Responsibilities:
• Develop end-to-end web applications using modern frameworks
• Design and implement RESTful APIs and microservices
• Work with databases, caching systems, and message queues
• Collaborate in an agile development environment
• Ensure application security and performance at scale

Requirements:
• Bachelor's degree in Computer Science or equivalent
• 4+ years of full stack development experience
• Proficiency in multiple programming languages (Java, Python, JavaScript)
• Experience with cloud platforms and distributed systems
• Strong understanding of database design and optimization

Amazon benefits:
• Competitive salary and equity compensation
• Comprehensive medical, dental, and vision insurance
• 401(k) plan with company match
• Paid parental leave and flexible time off
• Career development and mentorship opportunities`,
            interviewPrepNotes: `## Key Questions to Ask
• How does the team balance innovation with operational excellence?
• What's Amazon's approach to handling technical debt and code quality?
• How do you ensure scalability and reliability for high-traffic systems?
• What opportunities exist for learning cloud technologies and architecture?
• How does the team collaborate across different time zones and locations?

## Personal Experiences & Examples
• Built e-commerce platform handling 10k+ concurrent users
• Implemented caching strategy reducing database load by 60%
• Experience with AWS services (EC2, S3, RDS, Lambda)
• Led team of 3 developers on microservices migration project

## Company Research
• Amazon's leadership principles and customer obsession culture
• AWS dominance in cloud computing market
• Focus on long-term thinking and innovation
• Strong emphasis on ownership and delivering results

## Technical Preparation
• Review system design for high-scale applications
• Practice database optimization and distributed system concepts
• Understand AWS services and cloud architecture patterns
• Be ready to discuss performance monitoring and operational excellence`
          },
          { 
            company: 'Meta', 
            role: 'React Developer', 
            location: 'Menlo Park, CA',
            jobDescription: `Meta (formerly Facebook) is seeking a React Developer to build next-generation social experiences that connect billions of people worldwide.

Key Responsibilities:
• Develop user interfaces using React, Redux, and modern JavaScript
• Build reusable components and frontend libraries
• Collaborate with product designers on user experience improvements
• Optimize applications for maximum speed and scalability
• Participate in code reviews and maintain high code quality standards

Requirements:
• Bachelor's degree in Computer Science or related field
• 3+ years of experience with React and modern JavaScript
• Strong understanding of component lifecycle and state management
• Experience with testing frameworks (Jest, React Testing Library)
• Knowledge of build tools and modern development workflows

Meta offers:
• Highly competitive compensation packages
• Comprehensive healthcare and wellness benefits
• Flexible work arrangements and unlimited PTO
• Learning and development stipend
• Access to cutting-edge technology and research`,
            interviewPrepNotes: `## Key Questions to Ask
• How does Meta approach component reusability and design systems?
• What's the process for A/B testing and feature rollouts?
• How do you ensure performance with billions of users?
• What opportunities exist for working on emerging technologies (VR, AR)?
• How does the team balance move fast mentality with code quality?

## Personal Experiences & Examples
• Developed React component library used by 5+ teams
• Implemented performance optimizations reducing bundle size by 35%
• Experience with state management (Redux, Context API, Zustand)
• Built real-time chat application using WebSockets and React

## Company Research
• Meta's mission to connect people and build communities
• Investment in metaverse and virtual reality technologies
• React and other open-source contributions to the community
• Focus on innovation in social networking and communication

## Technical Preparation
• Deep dive into React internals, hooks, and performance optimization
• Practice building complex UI components and state management
• Understand testing strategies for React applications
• Be ready to discuss scalability challenges in frontend development`
          },
          { 
            company: 'Netflix', 
            role: 'Backend Engineer', 
            location: 'Los Gatos, CA',
            jobDescription: `Netflix is seeking a Backend Engineer to help build and scale the infrastructure that delivers entertainment to over 200 million subscribers globally.

Key Responsibilities:
• Design and implement high-performance backend services
• Build and maintain microservices architecture at massive scale
• Optimize data pipelines and streaming infrastructure
• Collaborate with data scientists on recommendation algorithms
• Ensure system reliability and performance under high load

Requirements:
• Bachelor's or Master's degree in Computer Science
• 4+ years of backend development experience
• Strong experience with Java, Python, or Scala
• Knowledge of distributed systems and microservices
• Experience with databases, caching, and message queuing systems

Netflix perks:
• Unlimited vacation policy and flexible work schedule
• Top-tier medical, dental, and vision coverage
• Annual learning and development budget
• Stock options and competitive salary
• Access to Netflix content and exclusive screenings`,
            interviewPrepNotes: `## Key Questions to Ask
• How does Netflix handle the scale of global content delivery?
• What's the approach to microservices architecture and service communication?
• How do you ensure system reliability during peak viewing times?
• What role does data play in backend system design and optimization?
• How does the team contribute to Netflix's recommendation engine?

## Personal Experiences & Examples
• Built streaming service architecture handling 1M+ concurrent users
• Implemented distributed caching system reducing latency by 45%
• Experience with Kafka, Redis, and event-driven architectures
• Optimized database queries for recommendation system processing millions of records

## Company Research
• Netflix's evolution from DVD to streaming to content creation
• Global expansion and localization challenges
• Strong engineering culture and freedom & responsibility philosophy
• Investment in original content and data-driven decision making

## Technical Preparation
• Review distributed systems concepts (CAP theorem, consistency, partitioning)
• Practice designing high-scale streaming and recommendation systems
• Understand event sourcing, CQRS, and microservices patterns
• Be ready to discuss performance optimization and monitoring strategies`
          }
        ];
        
        const statusOptions = ['interested', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];
        const createdJobs: JobDescription[] = [];
        
        for (let i = 0; i < testCompanies.length; i++) {
          const testCompany = testCompanies[i];
          const uuid = `test-${Date.now()}-${i}`;
          
          const newJob: JobDescription = {
            uuid,
            company: testCompany.company,
            role: testCompany.role,
            jd_text: testCompany.jobDescription,
            source_url: `https://${testCompany.company.toLowerCase()}.com/careers/${uuid}`,
            fetched_at_iso: new Date().toISOString(),
            content_hash: `hash-${uuid}`,
            application_status: statusOptions[i] as JobDescription['application_status'],
            applied_date: new Date(Date.now() - (i * 3 + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            last_updated: new Date().toISOString(),
            next_reminder: i < 3 ? new Date(Date.now() + (i + 1) * 2 * 24 * 60 * 60 * 1000).toISOString() : undefined,
            resume_path: `managed-resumes/${testCompany.company}_${testCompany.role.replace(/\s+/g, '_')}_2025-09-04.pdf`,
            is_archived: false
          };
          
          // Save to persistent storage via API
          try {
            const response = await fetch('/api/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newJob)
            });
            
            if (response.ok) {
              createdJobs.push(newJob);
              
              // Also save interview prep notes to localStorage
              const notesKey = `interview_prep_${uuid}`;
              const interviewNotes = {
                keyPoints: testCompany.interviewPrepNotes.split('## Key Questions to Ask')[1]?.split('## Personal Experiences & Examples')[0]?.trim() || '',
                questionsToAsk: testCompany.interviewPrepNotes.split('## Key Questions to Ask')[1]?.split('## Personal Experiences & Examples')[0]?.trim() || '',
                personalExperiences: testCompany.interviewPrepNotes.split('## Personal Experiences & Examples')[1]?.split('## Company Research')[0]?.trim() || '',
                companyResearch: testCompany.interviewPrepNotes.split('## Company Research')[1]?.split('## Technical Preparation')[0]?.trim() || '',
                technicalPrep: testCompany.interviewPrepNotes.split('## Technical Preparation')[1]?.trim() || ''
              };
              localStorage.setItem(notesKey, JSON.stringify(interviewNotes));
            }
          } catch (error) {
            console.warn(`Failed to save test job ${uuid}:`, error);
          }
        }
        
        // Update local state
        setJobs(createdJobs);
        
        toast({
          title: 'Test Applications Created',
          description: `Created ${createdJobs.length} sample applications with all 6 status types for testing.`
        });
      }
    } catch (error) {
      console.error('Error loading test applications:', error);
      toast({
        title: 'Error Loading Test Applications',
        description: 'Failed to load test applications. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleClearAllApplications = () => {
    setClearAllDialogOpen(true);
  };

  const handleClearAllConfirmed = async (exportFirst: boolean = false) => {
    try {
      // Export CSV if requested
      if (exportFirst) {
        setCsvExportModalOpen(true);
        setClearAllDialogOpen(false);
        return; // CSV export will handle closing both modals
      }

      // Delete all job files from persistent storage
      for (const job of jobs) {
        try {
          const response = await fetch(`/api/jobs/${job.uuid}`, {
            method: 'DELETE'
          });
          if (!response.ok) {
            console.warn(`Failed to delete job ${job.uuid}:`, await response.text());
          }
        } catch (error) {
          console.warn(`Failed to delete job ${job.uuid}:`, error);
        }
      }
      
      // Clear all jobs from state
      setJobs([]);
      
      // Clear search and filters
      setSearchTerm('');
      setStatusFilter('all');
      
      setClearAllDialogOpen(false);
      
      toast({
        title: 'All Applications Cleared',
        description: 'All job applications have been permanently removed.'
      });
    } catch (error) {
      console.error('Error clearing applications:', error);
      toast({
        title: 'Error Clearing Applications',
        description: 'Failed to clear applications. Please try again.',
        variant: 'destructive'
      });
      setClearAllDialogOpen(false);
    }
  };

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
      // First apply status filter
      if (statusFilter !== 'all') {
        if (job.application_status !== statusFilter) return false;
      }
      
      // Then apply search filter
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      const company = job.company?.toLowerCase() || '';
      const role = job.role?.toLowerCase() || '';
      return company.includes(searchLower) || role.includes(searchLower);
    });

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'company':
          aValue = a.company?.toLowerCase() || '';
          bValue = b.company?.toLowerCase() || '';
          break;
        case 'date':
          aValue = new Date(a.applied_date || a.fetched_at_iso).getTime();
          bValue = new Date(b.applied_date || b.fetched_at_iso).getTime();
          break;
        case 'status':
          // Custom status priority order for better sorting (follows JobApplication lifecycle)
          const statusPriority = {
            'saved': 1,
            'interested': 2,
            'applied': 3,
            'interviewing': 4,
            'offer': 5,
            'rejected': 6,
            'withdrawn': 7
          };
          aValue = statusPriority[a.application_status || 'interested'] || statusPriority['interested'];
          bValue = statusPriority[b.application_status || 'interested'] || statusPriority['interested'];
          break;
        case 'reminder':
          // Sort actual dates first, then "None" entries
          // Use a large future date for "None" so they appear last when sorting ASC
          aValue = a.next_reminder ? new Date(a.next_reminder).getTime() : Number.MAX_SAFE_INTEGER;
          bValue = b.next_reminder ? new Date(b.next_reminder).getTime() : Number.MAX_SAFE_INTEGER;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobs, searchTerm, sortField, sortOrder, statusFilter]);

  const handleSort = (field: SortField) => {
    if (field === 'status') {
      // Cycle through status filters instead of sorting
      const statusCycle: StatusFilter[] = ['all', 'saved', 'interested', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];
      const currentIndex = statusCycle.indexOf(statusFilter);
      const nextIndex = (currentIndex + 1) % statusCycle.length;
      setStatusFilter(statusCycle[nextIndex]);
    } else {
      if (field === sortField) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    }
  };

  const getSortIcon = (field: SortField) => {
    if (field === 'status') {
      return <span className="text-xs bg-gray-100 px-2 py-1 rounded">
        {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
      </span>;
    }
    if (field !== sortField) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: JobDescription['application_status']) => {
    switch (status) {
      case 'saved': return 'bg-slate-100 text-slate-800';
      case 'interested': return 'bg-purple-100 text-purple-800';
      case 'applied': return 'bg-blue-100 text-blue-800';
      case 'interviewing': return 'bg-yellow-100 text-yellow-800';
      case 'offer': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'withdrawn': return 'bg-gray-100 text-gray-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Active Applications ({filteredAndSortedJobs.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCsvExportModalOpen(true)}
                className="h-9"
                disabled={jobs.length === 0}
                title="Export applications as CSV file"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportHistoryOpen(true)}
                className="h-9"
                title="View export history and manage previous exports"
              >
                <History className="h-4 w-4 mr-2" />
                Export History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllApplications}
                className="h-9"
                title="Clear all applications from the list"
                disabled={jobs.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
              <div className="hidden">
                <AddApplication onApplicationAdded={handleApplicationAdded} />
              </div>
            </div>
          </div>
          
          {/* Upcoming Reminders */}
          <UpcomingReminders 
            className="" 
            limit={5} 
            onReminderCancel={handleReminderChange}
            onOpenJob={handleOpenJobFromReminder}
          />
        </div>
        
        {/* Search Bar and Controls */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by company or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Status Filter Info */}
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-gray-600">Current filter:</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              {statusFilter === 'all' ? 'All Applications' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Applications`}
            </span>
            <span className="text-xs text-gray-500">Click "Status" column header to cycle filters</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Headers */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(150px,1fr)_minmax(180px,1.2fr)_100px_120px_140px_minmax(200px,1fr)] gap-4 pb-2 border-b font-medium text-sm text-gray-600">
            <Button 
              variant="ghost" 
              className="justify-start p-0 h-auto font-medium hover:bg-transparent"
              onClick={() => handleSort('company')}
              title="Sort by company name"
            >
              Company {getSortIcon('company')}
            </Button>
            
            <div className="font-medium">Role</div>
            
            <Button 
              variant="ghost" 
              className="justify-start p-0 h-auto font-medium hover:bg-transparent"
              onClick={() => handleSort('date')}
              title="Sort by application date"
            >
              Date {getSortIcon('date')}
            </Button>
            
            <Button 
              variant="ghost" 
              className="justify-start p-0 h-auto font-medium hover:bg-transparent"
              onClick={() => handleSort('status')}
              title="Click to cycle through status filters: All → Interested → Applied → Interviewing → Offer → Rejected → Withdrawn"
            >
              Status {getSortIcon('status')}
            </Button>
            
            <Button 
              variant="ghost" 
              className="justify-start p-0 h-auto font-medium hover:bg-transparent"
              onClick={() => handleSort('reminder')}
              title="Sort by next reminder date"
            >
              Next Reminder {getSortIcon('reminder')}
            </Button>
            
            <div className="font-medium">Actions</div>
          </div>

          {/* Job Rows */}
          {filteredAndSortedJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No applications match your search.' : 
               statusFilter !== 'all' ? `No ${statusFilter} applications found.` :
               'No applications found.'}
            </div>
          ) : (
            filteredAndSortedJobs.map((job) => {
              const isRejected = job.application_status === 'rejected';
              const isExpanded = expandedRejected.has(job.uuid);
              const isHighlighted = highlightedJobId === job.uuid;
              
              return (
                <div key={job.uuid} className={`border-b border-gray-100 transition-all duration-500 ${
                  isHighlighted 
                    ? 'bg-blue-100 border-l-4 border-l-blue-500 shadow-md' 
                    : isRejected 
                      ? 'bg-red-50/50' 
                      : 'hover:bg-gray-50'
                }`}>
                  {/* Main Row (always visible for rejected items in collapsed mode) */}
                  <div className={`grid grid-cols-1 md:grid-cols-[minmax(150px,1fr)_minmax(180px,1.2fr)_100px_120px_140px_minmax(200px,1fr)] gap-4 py-3 ${isRejected && !isExpanded ? 'md:grid-cols-[minmax(150px,1fr)_minmax(180px,1.2fr)_100px_minmax(200px,1fr)]' : ''}`}>
                    {/* Company - Always Visible */}
                    <div className="font-medium flex items-center gap-2 min-w-0" title={job.company || 'Unknown'}>
                      {editingField?.jobId === job.uuid && editingField?.field === 'company' ? (
                        <div className="flex items-center gap-1 w-full">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="h-6 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            className="h-6 px-2 text-xs"
                          >
                            ✓
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full group">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditField(job.uuid, 'company', job.company || '')}
                            className="p-0 h-auto hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          {isRejected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandedRejected(job.uuid)}
                              className="p-0 h-4 w-4 hover:bg-transparent"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          )}
                          <span className="truncate">{job.company || 'Unknown'}</span>
                          {job.active_resume_version_id && (
                            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-2 whitespace-nowrap" title="Resume attached">
                              <File className="h-3 w-3" />
                              Resume
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Role - Always Visible */}
                    <div className="truncate" title={job.role || 'Unknown'}>
                      {editingField?.jobId === job.uuid && editingField?.field === 'role' ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="h-6 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            className="h-6 px-2 text-xs"
                          >
                            ✓
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditField(job.uuid, 'role', job.role || '')}
                            className="p-0 h-auto hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <span className="truncate">{job.role || 'Unknown'}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Date - Always Visible */}
                    <div className="text-sm text-gray-600">
                      {editingField?.jobId === job.uuid && editingField?.field === 'applied_date' ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="h-6 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            className="h-6 px-2 text-xs"
                          >
                            ✓
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditField(job.uuid, 'applied_date', job.applied_date?.split('T')[0] || new Date().toISOString().split('T')[0])}
                            className="p-0 h-auto hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Calendar className="h-3 w-3" />
                          </Button>
                          <span>{formatDate(job.applied_date || job.fetched_at_iso)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* For rejected items in collapsed mode, show actions directly */}
                    {isRejected && !isExpanded ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewJD(job)}
                          className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 h-8 px-2"
                          title="View job description"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEmailDraft(job)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 px-2"
                          title="Create follow-up email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestoreJob(job.uuid)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-2"
                          title="Restore to active"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setJobToDelete(job);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                          title="Permanently delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium truncate max-w-[100px] ${getStatusColor(job.application_status)}`}>
                          {job.application_status || 'interested'}
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Status Dropdown */}
                        <div>
                          <Select
                            value={job.application_status || 'interested'}
                            onValueChange={(value) => updateJobStatus(job.uuid, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="saved">Saved</SelectItem>
                              <SelectItem value="interested">Interested</SelectItem>
                              <SelectItem value="applied">Applied</SelectItem>
                              <SelectItem value="interviewing">Interviewing</SelectItem>
                              <SelectItem value="offer">Offer</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="withdrawn">Withdrawn</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Next Reminder */}
                        <div className="text-sm text-gray-600">
                          <div className="flex items-center gap-2 group">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetReminder(job)}
                              title="Add to calendar"
                              className={`p-0 h-auto hover:bg-transparent transition-all ${
                                job.next_reminder && job.reminder_ics_downloaded 
                                  ? 'opacity-100' // Always visible when ICS downloaded
                                  : job.next_reminder 
                                    ? 'opacity-100' // Always visible when reminder set but not downloaded
                                    : 'opacity-0 group-hover:opacity-100' // Only visible on hover when no reminder
                              }`}
                            >
                              <Bell className={`h-3 w-3 ${
                                job.next_reminder && job.reminder_ics_downloaded 
                                  ? 'text-green-600' // Green when ICS downloaded
                                  : job.next_reminder 
                                    ? 'text-red-600' // Red when reminder set but not downloaded
                                    : 'text-gray-400' // Gray when no reminder
                              }`} />
                            </Button>
                            <FollowupToggle 
                              job={job} 
                              onToggle={(updatedJob) => {
                                const updatedJobs = jobs.map(j => j.uuid === updatedJob.uuid ? updatedJob : j);
                                setJobs(updatedJobs);
                              }}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <span>{job.next_reminder ? formatDate(job.next_reminder) : 'None'}</span>
                                {job.next_reminder && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleExportReminderToCalendar(job)}
                                    className="p-0 h-auto hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Export to calendar"
                                  >
                                    <CalendarPlus className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                  </Button>
                                )}
                              </div>
                              {job.followup_reminder && (
                                <span className="text-xs text-blue-600" title="Auto follow-up reminder">
                                  Follow-up: {formatDate(job.followup_reminder)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions/Status */}
                        <div className="flex items-center gap-2 min-w-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewJD(job)}
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 h-8 px-2"
                            title="View job description"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInterviewPrep(job)}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-8 px-2"
                            title="Interview prep mode"
                          >
                            <Presentation className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAttachResume(job)}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-8 px-2"
                            title="Attach existing resume"
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEmailDraft(job)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 px-2"
                            title="Create follow-up email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          {isRejected && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestoreJob(job.uuid)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-2"
                                title="Restore to active"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setJobToDelete(job);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                                title="Permanently delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium truncate max-w-[100px] ${getStatusColor(job.application_status)}`}>
                            {job.application_status || 'interested'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this job application? This action cannot be undone.
              {jobToDelete?.next_reminder && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Bell className="h-4 w-4" />
                    <span className="font-medium">This application has a scheduled reminder</span>
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">
                    Reminder: {formatDate(jobToDelete.next_reminder)}
                  </div>
                  <div className="text-sm text-yellow-700">
                    The reminder will be cancelled if you delete this application.
                  </div>
                </div>
              )}
              {jobToDelete && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <div className="font-medium">{jobToDelete.company} - {jobToDelete.role}</div>
                  <div className="text-sm text-gray-600">
                    Applied: {formatDate(jobToDelete.applied_date || jobToDelete.fetched_at_iso)}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => jobToDelete && handleDeleteJob(jobToDelete)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Editor */}
      {jobForReminder && (
        <ReminderEditor
          isOpen={reminderEditorOpen}
          onClose={() => {
            setReminderEditorOpen(false);
            setJobForReminder(null);
          }}
          job={jobForReminder}
          onReminderChange={handleReminderChange}
        />
      )}

      {/* Email Draft Editor */}
      {jobForEmailDraft && (
        <EmailDraftEditor
          isOpen={emailDraftEditorOpen}
          onClose={() => {
            setEmailDraftEditorOpen(false);
            setJobForEmailDraft(null);
          }}
          job={jobForEmailDraft}
        />
      )}

      {/* CSV Export Modal */}
      <CSVExportModal
        isOpen={csvExportModalOpen}
        onClose={() => setCsvExportModalOpen(false)}
        jobs={jobs}
        filteredJobs={filteredAndSortedJobs}
        defaultScope="filtered"
      />

      {/* Export History Panel */}
      <ExportHistoryPanel
        isOpen={exportHistoryOpen}
        onClose={() => setExportHistoryOpen(false)}
      />

      {/* JD Viewer */}
      {jobForJdViewer && (
        <JDViewer
          isOpen={jdViewerOpen}
          onClose={() => {
            setJdViewerOpen(false);
            setJobForJdViewer(null);
          }}
          job={jobForJdViewer}
        />
      )}

      {/* Interview Prep Mode */}
      {jobForInterviewPrep && (
        <InterviewPrepMode
          isOpen={interviewPrepOpen}
          onClose={() => {
            setInterviewPrepOpen(false);
            setJobForInterviewPrep(null);
          }}
          job={jobForInterviewPrep}
        />
      )}

      {/* Attach Existing Resume Dialog */}
      <AttachExistingResumeDialog
        isOpen={attachResumeDialogOpen}
        onClose={() => {
          setAttachResumeDialogOpen(false);
          setJobForAttachResume(null);
        }}
        jobUuid={jobForAttachResume?.uuid || ''}
        jobInfo={jobForAttachResume ? {
          company: jobForAttachResume.company || 'Unknown Company',
          role: jobForAttachResume.role || 'Unknown Role'
        } : undefined}
        onResumeAttached={fetchJobs}
      />

      {/* Clear All Confirmation Dialog */}
      <Dialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Clear All Applications</DialogTitle>
            <DialogDescription>
              This action will permanently delete all {jobs.length} job applications and cannot be undone. 
              Would you like to export your data as CSV first?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setClearAllDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleClearAllConfirmed(true)}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV & Clear
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleClearAllConfirmed(false)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}