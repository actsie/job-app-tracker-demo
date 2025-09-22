# Job Application Tracker

> A comprehensive web application for managing job applications, resumes, and interview preparation with intelligent features and browser integration.

## 🚀 Live Demo

**[Try the Demo](https://job-app-tracker-demo.onrender.com)** *(Coming Soon)*

Test all features with sample data - no signup required!

## ✨ Features

### 📄 **Smart Resume Management**
- **Version Control**: Track resume versions for different applications
- **Bulk Import**: Import existing resumes from local folders
- **Format Support**: Upload PDF, DOCX, and text documents
- **Auto-naming**: Intelligent file naming based on job details
- **Preview & Download**: View resume content before sending

### 🎯 **Application Tracking**
- **Status Management**: Track applications from "Applied" to "Rejected" or "Offer"
- **Job Details**: Store company info, role descriptions, and application dates
- **Notes & Reminders**: Add personal notes and follow-up reminders
- **Duplicate Detection**: Automatically detect and merge duplicate applications
- **CSV Export**: Export your data for analysis and backup

### 🌐 **Browser Integration**
- **Chrome Extension**: One-click job posting capture from any website
- **Auto-fill**: Extract job details automatically from job boards
- **Quick Save**: Save job descriptions with a single click
- **Cross-platform**: Works on LinkedIn, Indeed, Glassdoor, and more

### 📊 **Analytics & Export**
- **Progress Tracking**: Visual dashboard of application status
- **Export Options**: CSV export with filtering and date ranges
- **Interview Prep**: Dedicated mode for interview preparation
- **Email Templates**: Pre-built follow-up email drafts

### 🔧 **Advanced Features**
- **Deduplication Engine**: Smart detection of duplicate job applications
- **File Management**: Organize job descriptions and attachments
- **Undo System**: Reversible operations with detailed change log
- **Bulk Operations**: Perform actions on multiple applications at once

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS + shadcn/ui components
- **PDF Processing**: PDF parsing and text extraction
- **File Handling**: Support for PDF, DOCX, and text formats
- **Browser Extension**: Chrome extension for job capture
- **State Management**: React hooks and context
- **Build Tool**: Next.js with optimized production builds

## 🚦 Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/actsie/job-app-tracker-demo.git
cd job-app-tracker-demo

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

### Build for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

## 🎮 How to Use (Demo Instructions)

### 1. **Adding Your First Application**
- Click "Add New Application" 
- Fill in company name, role, and application date
- Upload a tailored resume for this application
- Add job description (manual entry or paste from job board)

### 2. **Resume Management** 
- Go to "Resume Manager" tab
- Upload your base resume
- Create customized versions for specific applications
- View version history and rollback if needed

### 3. **Browser Extension** (Development)
- Install the Chrome extension from `/browser-extension/`
- Navigate to any job board (LinkedIn, Indeed, etc.)
- Click the extension icon to capture job details automatically

### 4. **Tracking Progress**
- Update application status as you progress
- Add notes for interview feedback or follow-ups
- Use the dashboard to see your application pipeline

### 5. **Export & Analysis**
- Export your data as CSV for external analysis
- Filter by date range, company, or status
- Use exported data for personal analytics

## 📁 Project Structure

```
job-app-tracker/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   ├── globals.css         # Global styles
│   └── page.tsx            # Main page
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   └── *.tsx              # Feature components
├── lib/                    # Utility functions
├── browser-extension/      # Chrome extension
├── public/                # Static assets
└── README.md              # This file
```

## 🔒 Privacy & Data Security

### Local-First Approach
- **No Cloud Storage**: All data stored locally on your device
- **Privacy Protected**: Personal information never leaves your computer
- **Offline Capable**: Full functionality without internet connection

### Demo Environment
- **Temporary Storage**: Demo data resets periodically
- **No Persistence**: Perfect for testing without privacy concerns  
- **Clean Slate**: Each demo session starts fresh

### For Production Use
- All personal data (resumes, job applications) stays on your local machine
- No tracking, analytics, or data collection
- Complete control over your sensitive job search information

## 🚀 Deployment Options

### Quick Deploy

#### **Render.com** (Recommended for demos)
1. Connect your GitHub repository to Render
2. Set the following environment variables:
   ```
   DEMO_MODE=true
   NEXT_PUBLIC_DEMO_MODE=true
   MAX_UPLOAD_FILES=10
   MAX_FILE_SIZE_MB=5
   ```
3. Deploy automatically on every push

#### **Demo Banner Configuration**
The demo banner will automatically show on:
- Domains containing "demo" (e.g., `myapp-demo.onrender.com`)
- Render deployments (`.onrender.com`, `.render.app`)
- When `NEXT_PUBLIC_DEMO_MODE=true` is set

If the banner isn't showing on your deployment:
1. Ensure `NEXT_PUBLIC_DEMO_MODE=true` is set in environment variables
2. Check browser console for config loading messages
3. Clear localStorage if banner was previously dismissed

#### **Other Platforms**
- **Vercel**: Serverless deployment (requires storage modifications)
- **Railway**: Container-based deployment

### Self-Hosted
- **VPS**: Full control with persistent file storage
- **Docker**: Containerized deployment with volumes
- **Local**: Run on your own machine for maximum privacy

## 🤝 Contributing

This project is open for contributions! Areas where you can help:

- 🐛 **Bug Fixes**: Report and fix issues
- ✨ **Features**: Suggest and implement new functionality  
- 📚 **Documentation**: Improve guides and examples
- 🎨 **UI/UX**: Enhance the user interface
- 🔧 **Performance**: Optimize loading and processing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs via [GitHub Issues](https://github.com/actsie/job-app-tracker-demo/issues)
- **Discussions**: Feature requests and questions welcome
- **Documentation**: Check the [Privacy Guide](REPOSITORY-PRIVACY-GUIDE.md) for setup help

---

**Built with ❤️ using Pawgrammer.com for job seekers who want to stay organized and land their dream job.**

*Make your job search systematic, not chaotic.*
