/**
 * Deterministic demo data generator
 * Creates consistent sample data for demos and testing
 */

import seedrandom from 'seedrandom';
import { config } from './config';

// Demo data pools (realistic but fake)
const COMPANIES = [
  'TechCorp', 'StartupInc', 'Analytics Co', 'Northline Systems', 
  'Brightway Digital', 'DataFlow Labs', 'CloudSync', 'InnovateTech',
  'Future Dynamics', 'Apex Solutions'
];

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Product Manager', 'Data Scientist', 'UX Designer',
  'QA Engineer', 'DevOps Engineer', 'Software Architect',
  'Technical Lead'
];

const STATUSES = ['Applied', 'Phone Screen', 'Interview', 'Final Round', 'Offer', 'Rejected'] as const;

// Stage mapping for consistent type handling
const STAGE_BY_STATUS: Record<typeof STATUSES[number], 'Application' | 'Active' | 'Closed'> = {
  'Applied': 'Application',
  'Phone Screen': 'Active', 
  'Interview': 'Active',
  'Final Round': 'Active',
  'Offer': 'Active',
  'Rejected': 'Closed'
};

const LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA',
  'Boston, MA', 'Chicago, IL', 'Remote', 'Los Angeles, CA'
];

const DEMO_NOTES = [
  'Great company culture and growth opportunities',
  'Interesting technical challenges in the role',
  'Competitive salary and benefits package',
  'Strong team collaboration and remote flexibility',
  'Exciting product with real user impact'
];

// Realistic job descriptions for demo
const JOB_DESCRIPTIONS = {
  'Frontend Developer': `We're looking for a passionate Frontend Developer to join our engineering team. You'll be responsible for building responsive, user-friendly web applications using modern JavaScript frameworks.

Key Responsibilities:
• Develop and maintain web applications using React, TypeScript, and modern CSS
• Collaborate with designers to implement pixel-perfect user interfaces
• Optimize applications for maximum speed and scalability
• Write clean, maintainable code with comprehensive test coverage
• Participate in code reviews and contribute to engineering best practices

Requirements:
• 3+ years of experience with React and modern JavaScript (ES6+)
• Strong knowledge of HTML5, CSS3, and responsive design principles
• Experience with state management libraries (Redux, Zustand, or similar)
• Familiarity with build tools (Webpack, Vite) and version control (Git)
• Understanding of web performance optimization and accessibility standards

Benefits:
• Competitive salary and equity package
• Health, dental, and vision insurance
• Flexible work arrangements and unlimited PTO
• Professional development budget and conference attendance
• Collaborative team environment with growth opportunities`,

  'Backend Developer': `Join our backend engineering team to build scalable, high-performance APIs and services that power millions of users worldwide.

Key Responsibilities:
• Design and implement RESTful APIs and microservices architecture
• Work with databases (PostgreSQL, Redis) to ensure data integrity and performance
• Collaborate with frontend teams to deliver seamless user experiences
• Implement security best practices and ensure system reliability
• Monitor and optimize system performance using APM tools

Requirements:
• 4+ years of experience with Node.js, Python, or Go
• Strong knowledge of database design and optimization
• Experience with cloud platforms (AWS, GCP, or Azure)
• Understanding of containerization and orchestration (Docker, Kubernetes)
• Familiarity with CI/CD pipelines and automated testing

Benefits:
• $120k-180k base salary plus equity
• Premium healthcare and wellness benefits
• Remote-first culture with quarterly team meetups
• Learning stipend for courses and certifications
• Stock options with high growth potential`,

  'Full Stack Developer': `We're seeking a versatile Full Stack Developer to work across our entire technology stack, from user interfaces to backend services.

Key Responsibilities:
• Build end-to-end features spanning frontend and backend systems
• Work with React, Node.js, and PostgreSQL to deliver complete solutions
• Collaborate with product managers to translate requirements into technical solutions
• Mentor junior developers and contribute to architectural decisions
• Ensure code quality through testing, documentation, and peer reviews

Requirements:
• 3+ years of full-stack development experience
• Proficiency with React, Node.js, and SQL databases
• Experience with cloud deployment and DevOps practices
• Strong problem-solving skills and attention to detail
• Excellent communication and teamwork abilities

Benefits:
• $100k-160k salary based on experience
• Equity participation and performance bonuses
• Flexible schedule and work-from-home options
• Health benefits and 401k matching
• Fast-paced startup environment with impact`,

  'Product Manager': `Drive product strategy and execution for our growing platform, working closely with engineering, design, and business stakeholders.

Key Responsibilities:
• Define product roadmap and prioritize features based on user needs and business goals
• Conduct user research and analyze product metrics to inform decisions
• Work with engineering teams to ensure timely and quality product delivery
• Collaborate with design team to create intuitive user experiences
• Communicate product updates and strategy to stakeholders and leadership

Requirements:
• 3+ years of product management experience, preferably in B2B SaaS
• Strong analytical skills with experience in data-driven decision making
• Understanding of software development processes and technical constraints
• Excellent written and verbal communication skills
• Bachelor's degree in business, engineering, or related field

Benefits:
• $130k-190k base salary plus variable compensation
• Significant equity upside in growing company
• Comprehensive benefits package
• Professional development and conference budget
• Direct impact on product direction and company growth`
};

// Interview notes and application timeline data
const INTERVIEW_SCENARIOS = {
  'applied': [
    'Applied through company website. Resume automatically screened and moved to recruiter review.',
    'Application submitted via LinkedIn. Recruiter reached out within 2 days to schedule phone screen.',
    'Applied directly to hiring manager after networking event. Quick response and positive initial feedback.'
  ],
  'phone_screen': [
    'Phone screen with recruiter went well. Discussed role expectations, salary range ($120k-150k), and next steps. Technical screen scheduled for next week.',
    '30min call with hiring manager. Great conversation about team culture and growth opportunities. Technical assessment sent to complete before next round.',
    'Initial screening call covered background, motivations, and basic technical questions. Strong cultural fit, moving to technical interview stage.'
  ],
  'technical': [
    'Technical interview focused on system design and coding problems. Solved algorithm question efficiently and discussed trade-offs well. Positive feedback from interviewer.',
    'Pair programming session on React components. Good collaboration and clean code approach. Some areas for improvement in testing, but overall strong performance.',
    'Take-home coding challenge completed. Built a full-stack application with authentication and database. Code review scheduled for next week.'
  ],
  'final': [
    'Final round interviews with team members. Discussed past projects, problem-solving approach, and team collaboration. Everyone seemed engaged and positive.',
    'Panel interview with 4 team members. Technical deep-dive into previous work and hypothetical scenarios. Felt confident about answers and team dynamic.',
    'Executive interview with CTO. Strategic discussion about technology choices and career goals. Great conversation about company vision and growth.'
  ],
  'offer': [
    'Verbal offer received! $145k base + 0.2% equity + signing bonus. Benefits package looks excellent. Need to review and respond by Friday.',
    'Formal offer letter received. Salary negotiation successful - got additional $10k and extra week vacation. Start date flexible.',
    'Competing offers to consider. This role offers better growth potential and team culture fit. Leaning towards accepting.'
  ]
};

// Resume content tailored to different roles
const RESUME_CONTENT = {
  'Frontend Developer': `JOHN DOE
Software Engineer | Frontend Specialist
john.doe@email.com | (555) 123-4567 | LinkedIn: /in/johndoe | GitHub: /johndoe

PROFESSIONAL SUMMARY
Frontend developer with 4+ years of experience building responsive web applications using React, TypeScript, and modern CSS. Passionate about creating exceptional user experiences and writing clean, maintainable code.

TECHNICAL SKILLS
• Languages: JavaScript (ES6+), TypeScript, HTML5, CSS3, Python
• Frameworks: React, Next.js, Vue.js, Express.js
• Tools: Git, Webpack, Vite, Jest, Cypress, Figma
• Databases: PostgreSQL, MongoDB, Redis
• Cloud: AWS, Vercel, Netlify

PROFESSIONAL EXPERIENCE
Senior Frontend Developer | TechStart Inc | 2022 - Present
• Led frontend architecture for customer dashboard, serving 50k+ daily active users
• Implemented design system that reduced development time by 30%
• Optimized bundle size by 40% through code splitting and lazy loading
• Mentored 2 junior developers and conducted code reviews

Frontend Developer | StartupCo | 2020 - 2022
• Built responsive e-commerce platform using React and Redux
• Collaborated with UX team to implement accessible components
• Achieved 95+ PageSpeed Insights score through performance optimization
• Integrated payment systems and third-party APIs

EDUCATION
Bachelor of Computer Science | State University | 2020
• Relevant Coursework: Web Development, Data Structures, Software Engineering

PROJECTS
• E-commerce Dashboard - React/TypeScript SPA with real-time analytics
• Weather App - Progressive Web App with geolocation and offline support
• Component Library - Reusable UI components published to npm`,

  'Backend Developer': `JANE SMITH
Backend Software Engineer
jane.smith@email.com | (555) 987-6543 | GitHub: /janesmith

PROFESSIONAL SUMMARY
Backend engineer with 5+ years of experience designing and implementing scalable APIs and microservices. Expertise in cloud architecture, database optimization, and system reliability.

TECHNICAL SKILLS
• Languages: Node.js, Python, Go, SQL, TypeScript
• Frameworks: Express.js, FastAPI, Gin, Django
• Databases: PostgreSQL, MongoDB, Redis, Elasticsearch
• Cloud: AWS (EC2, RDS, Lambda, S3), Docker, Kubernetes
• Tools: Git, Jenkins, Terraform, Prometheus, Grafana

PROFESSIONAL EXPERIENCE
Senior Backend Engineer | CloudTech Solutions | 2021 - Present
• Architected microservices handling 1M+ requests/day with 99.9% uptime
• Reduced database query times by 60% through optimization and indexing
• Implemented CI/CD pipelines reducing deployment time from 2hrs to 15min
• Led migration from monolith to microservices architecture

Backend Developer | DataCorp | 2019 - 2021
• Built RESTful APIs serving mobile and web applications
• Designed real-time data processing pipeline handling 100k events/hour
• Implemented authentication and authorization systems
• Collaborated with frontend teams on API design and integration

SOFTWARE ENGINEER | StartupXYZ | 2018 - 2019
• Developed MVP backend for social media platform
• Built scalable user management and content delivery systems
• Implemented automated testing achieving 85% code coverage

EDUCATION
Bachelor of Software Engineering | Tech University | 2018
• Graduated Cum Laude, GPA: 3.7/4.0
• Senior Project: Distributed file storage system using Go and Docker

CERTIFICATIONS
• AWS Solutions Architect Associate (2022)
• Kubernetes Administrator (2021)`
};

export interface DemoJobApplication {
  id: string;
  company: string;
  role: string;
  status: typeof STATUSES[number];
  appliedAt: string;
  location: string;
  salary?: string;
  notes: string;
  jdLink: string;
  resumeUsed?: string;
  stage: string;
  priority: 'high' | 'medium' | 'low';
  // Enhanced demo fields
  jobDescription?: string;
  companyDescription?: string;
  interviewNotes?: string[];
  resumeContent?: string;
  techStack?: string[];
  benefits?: string[];
  applicationTimeline?: Array<{
    stage: string;
    date: string;
    notes: string;
    interviewer?: string;
    nextSteps?: string;
  }>;
}

/**
 * Generate deterministic demo job applications with realistic scenarios
 */
export function generateDemoApplications(count = 8, seed = config.demo.seed): DemoJobApplication[] {
  const rng = seedrandom(seed);
  
  // Helper to pick random item from array
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  
  // Helper to generate realistic dates in the past
  const generateDate = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(rng() * daysAgo));
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  // Predefined realistic demo scenarios
  const demoScenarios = [
    {
      company: 'Meta',
      role: 'Frontend Developer',
      status: 'Final Round' as const,
      appliedDaysAgo: 18,
      location: 'Menlo Park, CA',
      salary: '$140k - $180k',
      priority: 'high' as const,
      interviewNotes: [
        'Phone screen (Sept 15): Great conversation with Sarah Chen (Recruiter). Discussed role expectations and team structure. Technical screen scheduled for Sept 22.',
        'Technical Interview (Sept 22): 45min coding session with Alex Rodriguez (Senior Engineer). Solved React optimization problem and discussed state management patterns. Positive feedback.',
        'System Design (Sept 29): Whiteboard session on building scalable frontend architecture. Covered CDN strategies, caching, and performance monitoring. Strong technical discussion.',
        'Team Match (Oct 5): Met with potential team members. Great culture fit discussion about remote work, code reviews, and growth opportunities. Final decision pending.'
      ],
      applicationTimeline: [
        { stage: 'Applied', date: '2024-09-12', notes: 'Application submitted via careers page', nextSteps: 'Recruiter review within 1 week' },
        { stage: 'Phone Screen', date: '2024-09-15', notes: 'Initial screening call', interviewer: 'Sarah Chen (Recruiter)', nextSteps: 'Technical assessment scheduled' },
        { stage: 'Technical', date: '2024-09-22', notes: 'Coding interview passed', interviewer: 'Alex Rodriguez (Senior Engineer)', nextSteps: 'System design round' },
        { stage: 'System Design', date: '2024-09-29', notes: 'Architecture discussion went well', interviewer: 'Jordan Kim (Tech Lead)', nextSteps: 'Team matching interviews' },
        { stage: 'Team Match', date: '2024-10-05', notes: 'Cultural fit interviews with team members', nextSteps: 'Final decision by Oct 12' }
      ],
      techStack: ['React', 'TypeScript', 'GraphQL', 'Relay', 'Jest', 'Webpack'],
      benefits: ['$140k-180k base salary', 'RSUs vesting over 4 years', 'Health/dental/vision', 'Unlimited PTO', '$5k learning budget']
    },
    {
      company: 'Google',
      role: 'Backend Developer',
      status: 'Interview' as const,
      appliedDaysAgo: 12,
      location: 'Mountain View, CA',
      salary: '$150k - $190k',
      priority: 'high' as const,
      interviewNotes: [
        'Recruiter call (Sept 20): Detailed discussion about the role in Google Cloud team. Strong match for backend infrastructure work. Coding challenge sent.',
        'Coding Assessment: Completed take-home challenge in Go. Built distributed system for log processing. Clean code and good test coverage.',
        'Technical Phone Screen (Oct 1): 1-hour interview covering algorithms, system design basics, and Go experience. Solved binary search problem efficiently.',
        'Waiting for on-site scheduling. Recruiter mentioned strong performance so far and positive team feedback.'
      ],
      applicationTimeline: [
        { stage: 'Applied', date: '2024-09-18', notes: 'Applied through referral from former colleague', nextSteps: 'Recruiter contact within days' },
        { stage: 'Recruiter Screen', date: '2024-09-20', notes: 'Positive initial conversation', interviewer: 'Mike Thompson (Technical Recruiter)', nextSteps: 'Coding assessment sent' },
        { stage: 'Coding Challenge', date: '2024-09-25', notes: 'Submitted Go project for distributed logs', nextSteps: 'Technical phone screen' },
        { stage: 'Phone Technical', date: '2024-10-01', notes: 'Algorithms and system design interview', interviewer: 'Lisa Park (Staff Engineer)', nextSteps: 'On-site interviews to be scheduled' }
      ],
      techStack: ['Go', 'gRPC', 'Kubernetes', 'Google Cloud', 'Spanner', 'BigQuery'],
      benefits: ['$150k-190k base salary', 'GSUs with excellent growth', 'World-class benefits', 'Free meals', '20% time for side projects']
    },
    {
      company: 'Stripe',
      role: 'Full Stack Developer',
      status: 'Applied' as const,
      appliedDaysAgo: 5,
      location: 'San Francisco, CA',
      salary: '$130k - $170k',
      priority: 'medium' as const,
      interviewNotes: [
        'Just applied through AngelList. Strong product-market fit and engineering culture. Waiting for initial response.'
      ],
      applicationTimeline: [
        { stage: 'Applied', date: '2024-10-07', notes: 'Application submitted via AngelList', nextSteps: 'Waiting for recruiter response' }
      ],
      techStack: ['Ruby', 'React', 'PostgreSQL', 'Redis', 'Docker', 'AWS'],
      benefits: ['$130k-170k salary', 'Equity package', 'Flexible work arrangements', 'Health benefits', 'Career development budget']
    }
  ];
  
  // Generate predefined scenarios first, then random ones
  const applications: DemoJobApplication[] = [];
  
  // Add predefined realistic scenarios
  demoScenarios.forEach((scenario, index) => {
    const baseApplication = {
      id: `demo-${index + 1}`,
      company: scenario.company,
      role: scenario.role,
      status: scenario.status,
      appliedAt: generateDate(scenario.appliedDaysAgo),
      location: scenario.location,
      salary: scenario.salary,
      notes: `${pick(DEMO_NOTES)} (Demo application - realistic interview scenario)`,
      jdLink: `https://careers.${scenario.company.toLowerCase()}.com/${scenario.role.toLowerCase().replace(/\s+/g, '-')}`,
      resumeUsed: `${scenario.role.replace(/\s+/g, '_')}_Resume_${scenario.company}.pdf`,
      stage: STAGE_BY_STATUS[scenario.status],
      priority: scenario.priority,
      // Enhanced fields
      jobDescription: JOB_DESCRIPTIONS[scenario.role as keyof typeof JOB_DESCRIPTIONS],
      companyDescription: `${scenario.company} - Leading technology company focused on innovation and scale. (Demo company - realistic scenario)`,
      interviewNotes: scenario.interviewNotes,
      resumeContent: RESUME_CONTENT[scenario.role as keyof typeof RESUME_CONTENT],
      techStack: scenario.techStack,
      benefits: scenario.benefits,
      applicationTimeline: scenario.applicationTimeline
    };
    applications.push(baseApplication);
  });
  
  // Fill remaining slots with random applications
  const remaining = Math.max(0, count - demoScenarios.length);
  for (let i = 0; i < remaining; i++) {
    const company = pick(COMPANIES);
    const role = pick(ROLES);
    const status = pick(STATUSES);
    const appliedDaysAgo = Math.floor(rng() * 30) + 1;
    
    const randomApplication: DemoJobApplication = {
      id: `demo-${demoScenarios.length + i + 1}`,
      company,
      role,
      status,
      appliedAt: generateDate(appliedDaysAgo),
      location: pick(LOCATIONS),
      salary: rng() > 0.3 ? `$${Math.floor(rng() * 100 + 80)}k - $${Math.floor(rng() * 150 + 120)}k` : undefined,
      notes: `${pick(DEMO_NOTES)} (Demo application - not persistent)`,
      jdLink: `https://demo-jobs.example.com/${company.toLowerCase().replace(/\s+/g, '-')}/${role.toLowerCase().replace(/\s+/g, '-')}`,
      resumeUsed: rng() > 0.5 ? `${role.replace(/\s+/g, '_')}_Resume_${company}.pdf` : undefined,
      stage: STAGE_BY_STATUS[status],
      priority: pick(['high', 'medium', 'low'] as const),
      // Basic enhanced fields for random applications
      jobDescription: JOB_DESCRIPTIONS[role as keyof typeof JOB_DESCRIPTIONS],
      companyDescription: `${company} - Demo company with realistic job posting. (Not a real company)`,
      interviewNotes: status !== 'Applied' ? [pick(INTERVIEW_SCENARIOS.applied), pick(INTERVIEW_SCENARIOS.phone_screen)] : undefined,
      resumeContent: RESUME_CONTENT[role as keyof typeof RESUME_CONTENT],
      techStack: ['JavaScript', 'React', 'Node.js', 'PostgreSQL'],
      benefits: ['Competitive salary', 'Health benefits', 'Flexible schedule']
    };
    applications.push(randomApplication);
  }
  
  return applications;
}

/**
 * Generate demo resume data for bulk import simulation
 */
export interface DemoResumeData {
  filename: string;
  company: string;
  role: string;
  extractedText: string;
  wordCount: number;
  hasContactInfo: boolean;
}

export function generateDemoResumes(count = 5, seed = config.demo.seed): DemoResumeData[] {
  const rng = seedrandom(seed);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  
  return Array.from({ length: count }, (_, index) => {
    const company = pick(COMPANIES);
    const role = pick(ROLES);
    const wordCount = Math.floor(rng() * 300 + 200); // 200-500 words
    
    return {
      filename: `${role.replace(/\s+/g, '_')}_Resume_${company}.pdf`,
      company,
      role,
      extractedText: `[Demo Resume Content]\n\nTargeted resume for ${role} position at ${company}.\n\nThis is a demo resume with approximately ${wordCount} words of content.\nContains typical resume sections: contact info, experience, skills, education.\n\n[Content redacted in demo mode for privacy]`,
      wordCount,
      hasContactInfo: true,
    };
  });
}

/**
 * Generate demo company data
 */
export interface DemoCompany {
  name: string;
  industry: string;
  size: string;
  website: string;
  description: string;
}

export function generateDemoCompanies(seed = config.demo.seed): DemoCompany[] {
  const rng = seedrandom(seed);
  const industries = ['Technology', 'Healthcare', 'Finance', 'E-commerce', 'SaaS'];
  const sizes = ['Startup (1-50)', 'Mid-size (51-500)', 'Large (501-5000)', 'Enterprise (5000+)'];
  
  return COMPANIES.map(company => ({
    name: company,
    industry: industries[Math.floor(rng() * industries.length)],
    size: sizes[Math.floor(rng() * sizes.length)],
    website: `https://${company.toLowerCase().replace(/\s+/g, '')}.com`,
    description: `${company} is a leading company in the ${industries[Math.floor(rng() * industries.length)].toLowerCase()} space. (Demo company - not real)`
  }));
}

/**
 * Reset demo data (session-scoped)
 */
export function createDemoSession(sessionId: string = 'default') {
  return {
    id: sessionId,
    createdAt: new Date().toISOString(),
    applications: generateDemoApplications(8, `${config.demo.seed}-${sessionId}`),
    companies: generateDemoCompanies(`${config.demo.seed}-${sessionId}`),
    resumes: generateDemoResumes(5, `${config.demo.seed}-${sessionId}`),
  };
}

// Export for testing and debugging
export const demoDataPools = {
  COMPANIES,
  ROLES,
  STATUSES,
  LOCATIONS,
  DEMO_NOTES,
} as const;