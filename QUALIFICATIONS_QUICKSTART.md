# Qualification Management Module - Quick Start Guide

## Overview

This guide will help you test the learner-facing qualification management mockup that has been created.

## File Structure

```
lmsbox.client/src/pages/Qualifications/
├── CohortsList.jsx           # Main listing page (mockup)
├── CohortSubmission.jsx      # Submission workflow (mockup)
└── index.js                  # Module exports
```

## How to Access

### 1. Start the Frontend Development Server

```powershell
cd lmsbox.client
npm ci
npm run dev
```

The app will be available at `http://localhost:5173`

### 2. Navigate to Qualifications

After logging in as a learner:
1. Look for a "Qualifications" link in the navigation (or navigate directly to)
2. Open: `http://localhost:5173/qualifications`

Alternatively:
- **Qualifications List**: `http://localhost:5173/qualifications`
- **Submission Page**: `http://localhost:5173/qualifications/cohorts/cohort-001`

## Features to Test

### Cohorts List Page (`/qualifications`)

#### Test 1: Filter Functionality
1. Navigate to `/qualifications`
2. Click on different filter buttons (All, Active, Upcoming, Completed)
3. Verify only matching cohorts are displayed

#### Test 2: Cohort Cards Display
1. Verify all cohort information displays correctly:
   - Cohort name and description
   - Start and end dates
   - Learner enrollment stats
   - Status badges with correct colors

#### Test 3: Status Badges
- **Active** - Green background with checkmark
- **Upcoming** - Blue background with clock
- **Completed** - Gray background with checkmark

#### Test 4: Navigation
1. Click "Submit Qualification" on an active cohort
2. Verify you're navigated to the submission page
3. Click "View Details" on a non-active cohort
4. Verify error toast appears: "You can only submit to active cohorts"

#### Test 5: Responsive Design
1. Test on desktop (full width)
2. Test on tablet (medium width)
3. Test on mobile (small width)
4. Verify cards and layout adjust properly

### Cohort Submission Page (`/qualifications/cohorts/:cohortId`)

#### Test 1: Upload Stage
1. Click "Submit Qualification" from list
2. Verify page shows:
   - Cohort title and description
   - Cohort start date
   - Back button with navigation
   - File upload area with drag-drop icon
   
#### Test 2: File Upload Validation
1. Try uploading a non-Word file (.pdf, .txt, .jpg)
2. Verify error: "Please select a valid Word document (.doc or .docx)"
3. Try uploading a file > 10MB
4. Verify error: "File size must be less than 10MB"
5. Upload a valid Word file
6. Verify file preview appears showing filename and size

#### Test 3: Plagiarism Check Trigger
1. Click "Check for Plagiarism" button with file selected
2. Verify loading state with spinner
3. Wait for ~3 seconds (mock delay)
4. Verify results page displays

#### Test 4: Results Display
1. Verify plagiarism results show:
   - **Overall Score**: Large percentage with severity color
   - **Severity Label**: Excellent/Good/Moderate/High
   - **Matched Sources**: List of sources with URLs and match percentages
   - **Information Banner**: Warning about high scores
   
#### Test 5: Score Color Coding
Test different score severities:
- 0-10% → Green (Excellent)
- 11-25% → Yellow (Good)
- 26-50% → Orange (Moderate)
- 51%+ → Red (High)

#### Test 6: Action Buttons on Results
1. Click "Discard & Upload New"
2. Verify you return to upload stage
3. Verify form is cleared
4. Upload new file and check again

#### Test 7: Final Submission
1. On results page, click "Confirm & Submit"
2. Verify success message appears
3. Verify auto-redirect to `/qualifications` after 3 seconds

#### Test 8: Error Handling
1. Click "Check for Plagiarism" with file too large
2. Verify error toast with appropriate message
3. Verify you stay on same stage

### Mock Data Samples

Four sample cohorts are pre-configured:

1. **Advanced Python Programming Q1 2026** (Status: Active)
   - Start: Jan 20, 2026
   - End: Mar 20, 2026
   - Enrolled: 24 learners

2. **Data Science Fundamentals** (Status: Upcoming)
   - Start: Feb 1, 2026
   - End: Apr 1, 2026
   - Enrolled: 18 learners

3. **Web Development Essentials** (Status: Completed)
   - Start: Sep 15, 2025
   - End: Dec 15, 2025
   - Enrolled: 32 learners (28 submitted)

4. **Cloud Architecture with AWS** (Status: Active)
   - Start: Jan 27, 2026
   - End: Apr 27, 2026
   - Enrolled: 15 learners

### Mock Plagiarism Results

Sample results include:
- **Overall Score**: 23% (Good severity)
- **Matched Sources**: 3 sources with 5-10% individual matches
- **Sample URLs**: Wikipedia, GitHub, ReadTheDocs

## Browser Developer Tools

### Console Output
- File validation messages logged to console
- API call placeholders logged (when implemented)
- Error messages printed

### Network Tab
- No real API calls made (all mocked)
- Use Network tab to verify structure when APIs are added

### Responsive Design Mode
- Toggle device toolbar: `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (Mac)
- Test different screen sizes

## Keyboard Navigation

- **Tab**: Navigate between buttons and form elements
- **Enter**: Click focused button
- **Escape**: (Can be implemented to close modals)

## Accessibility Testing

- Test with screen reader (NVDA, JAWS, or VoiceOver)
- Verify color contrast meets WCAG standards
- Test without colors (rely on text and icons)
- Use browser accessibility inspector

## Troubleshooting

### Components Not Showing
1. Verify React Router is set up correctly in App.jsx
2. Check browser console for errors
3. Verify ProtectedRoute wrapper is working
4. Check that you're logged in as a learner

### File Upload Not Working
1. Check browser console for errors
2. Verify file size is under 10MB
3. Verify file is .doc or .docx format
4. Check browser file input limitations

### Toast Messages Not Appearing
1. Verify react-hot-toast is installed: `npm list react-hot-toast`
2. Check that <Toaster> component is in App.jsx
3. Review browser console for errors

### Date Formatting Issues
1. Check browser locale settings
2. Verify Date objects are created correctly
3. Check formatDate function in components

## Performance Testing

1. **Large File Upload**: Test with 9.9MB .docx file
2. **Many Cohorts**: Filter with 100+ cohorts (mock by modifying mockCohorts)
3. **Slow Network**: Use DevTools throttling to simulate slow 3G
4. **Memory Usage**: Monitor DevTools Memory tab during file uploads

## Integration Checklist (For Backend)

When ready to integrate with real backend:

- [ ] Create Cohort entity with id, name, description, startDate, endDate, status
- [ ] Create LearnerProgress entity to track submissions
- [ ] Create endpoint: `GET /api/learner/cohorts` - List cohorts for learner
- [ ] Create endpoint: `GET /api/qualifications/cohorts/{cohortId}` - Get cohort details
- [ ] Create endpoint: `POST /api/qualifications/cohorts/{cohortId}/check-plagiarism` - Check for plagiarism
- [ ] Create endpoint: `POST /api/qualifications/cohorts/{cohortId}/submit` - Submit qualification
- [ ] Implement text extraction from Word documents
- [ ] Integrate plagiarism API (Copyleaks or ChatGPT)
- [ ] Add authentication and authorization checks
- [ ] Add database logging for submissions

## API Integration Template

Replace mock API calls in components:

```javascript
// In CohortsList.jsx - Fetch cohorts
const response = await api.get('/api/learner/cohorts');
setCohorts(response.data);

// In CohortSubmission.jsx - Check plagiarism
const formData = new FormData();
formData.append('file', file);
const response = await api.post(
  `/api/qualifications/cohorts/${cohortId}/check-plagiarism`,
  formData
);
setPlagiarismResult(response.data);

// In CohortSubmission.jsx - Submit qualification
const response = await api.post(
  `/api/qualifications/cohorts/${cohortId}/submit`,
  {
    documentId: plagiarismResult.documentId,
    fileName: file.name,
    plagiarismScore: plagiarismResult.overallScore,
  }
);
```

## Next Steps

1. **Test the mockup** with the flows above
2. **Gather feedback** on UI/UX from stakeholders
3. **Make adjustments** as needed to components
4. **Create backend** API endpoints and database schema
5. **Integrate** frontend with backend APIs
6. **Implement** plagiarism detection API
7. **Add admin** dashboard for cohort management
8. **Add user** management for cohort assignments

## Support

For issues or questions:
1. Check component documentation in `QUALIFICATIONS_MOCKUP.md`
2. Review React Router documentation for routing issues
3. Check Tailwind CSS documentation for styling
4. Review console errors for debugging

---

**Last Updated**: January 15, 2026
**Component Status**: Mockup with mock data
**Ready for Backend Integration**: Yes
