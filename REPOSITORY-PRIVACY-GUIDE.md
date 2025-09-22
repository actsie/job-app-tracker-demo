# Repository Privacy Guide

## ⚠️ CRITICAL: Personal Data Protection

This job application tracker handles sensitive personal information. **NEVER commit personal data to git repositories.**

## 🛡️ Protected Directories & Files

The following are automatically excluded via `.gitignore`:

### Personal Resume Data
- `temp-uploads/` - Temporary resume upload files
- `managed-resumes/` - Customized resumes for specific applications  
- `Resumes/` - Your base resume files
- `resume-manifest.json` - Resume version tracking
- `operations-log.json` - Personal activity log
- `file-management-config.json` - File paths configuration
- `bulk-import-temp.json` - Temporary import data

### Job Application Data  
- `job-descriptions/` - Saved job descriptions

### Development & Test Files
- `test-*.js`, `*-test-*.js` - Test scripts with personal data
- `*-screenshot*.png` - Screenshots that may contain personal info
- `*_EVIDENCE.md` - Test evidence files

## 🚨 If You Already Uploaded Personal Data

If you accidentally committed personal files to a repository:

1. **Private Repository**: Remove from git history and re-commit
```bash
git rm --cached -r temp-uploads/ managed-resumes/ Resumes/
git rm --cached resume-manifest.json operations-log.json
git commit -m "Remove personal data from tracking"
git push --force
```

2. **Public Repository**: **DELETE THE ENTIRE REPOSITORY** and re-upload clean version
   - Your personal resume data is now PUBLIC
   - Git history preserves deleted files
   - Force push won't help on public repos

## ✅ Safe Repository Checklist

Before uploading to any git repository:

- [ ] Check `.gitignore` includes all personal data paths
- [ ] Run `git status` and verify no personal files are staged
- [ ] Test that `npm run build` works without personal data
- [ ] Verify application functions with clean slate

## 🔒 Safe Development Workflow

1. **Clone/Download**: Start with clean repository
2. **Personal Setup**: Add your resumes to protected directories
3. **Development**: Make code changes only
4. **Before Commit**: Verify no personal data in staging
5. **Commit**: Only commit code changes
6. **Build**: Test production build excludes personal data

## 📁 Application Directory Structure

```
job-app-tracker/
├── app/                    ✅ Safe to commit
├── components/             ✅ Safe to commit  
├── lib/                    ✅ Safe to commit
├── public/                 ✅ Safe to commit
├── Resumes/               ❌ PERSONAL DATA
├── managed-resumes/       ❌ PERSONAL DATA
├── temp-uploads/          ❌ PERSONAL DATA
├── job-descriptions/      ❌ PERSONAL DATA
└── *.json configs         ❌ PERSONAL DATA
```

## 🎯 Production Deployment

- `npm run build` creates clean production build in `.next/`
- Personal data is excluded from build output
- Application starts fresh on new environments
- Users add their own data after deployment

## 💡 Remember

- **Personal data belongs on your local machine only**
- **Code changes belong in the repository** 
- **Always verify before committing/pushing**
- **When in doubt, check git status twice**

---

*This guide was created after a privacy protection implementation. Always follow these practices to keep your personal information secure.*