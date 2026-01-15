# Qualification Management Module - Learner Views Mockup

## Overview

This document describes the learner-facing UI mockup for the Qualification Management Module in LMS Box. The module allows learners to view, select, and submit qualifications for available cohorts with plagiarism checking capabilities.

## Features Implemented (Mockup)

### 1. **Cohorts List Page** (`/qualifications`)

Displays all available cohorts that a learner can submit qualifications for.

#### Key Features:
- **Cohort Cards**: Show comprehensive cohort information including:
  - Cohort name and description
  - Start and end dates
  - Current status (Active, Upcoming, Completed)
  - Number of submissions vs. total learners
  
- **Status Badges**: Visual indicators for cohort status
  - ✅ **Active** (Green) - Can submit qualifications
  - ⏱️ **Upcoming** (Blue) - Not yet available
  - ✓ **Completed** (Gray) - Past deadline

- **Filter Buttons**: Filter cohorts by status
  - All
  - Active
  - Upcoming
  - Completed

- **Action Buttons**: 
  - "Submit Qualification" (enabled only for active cohorts)
  - "View Details" (disabled state for non-active cohorts)

#### UI Components Used:
- Heroicons (CalendarIcon, CheckCircleIcon, ClockIcon)
- Tailwind CSS grid layout
- React Router navigation

---

### 2. **Cohort Submission Page** (`/qualifications/cohorts/:cohortId`)

Multi-stage submission workflow with plagiarism checking.

#### Submission Stages:

##### **Stage 1: Upload Document**
- Cohort information header with:
  - Cohort name, description, and start date
  - Back navigation button
  
- File upload section with:
  - Drag-and-drop support
  - File type validation (.doc, .docx only)
  - File size validation (max 10MB)
  - File preview with option to remove
  - "Check for Plagiarism" button

##### **Stage 2: Plagiarism Checking (In Progress)**
- Loading state with spinner
- Message: "Checking for plagiarism - Please wait while we analyze your document..."

##### **Stage 3: Results Display**
Shows detailed plagiarism analysis:

- **Overall Score Card** (color-coded by severity):
  - Large percentage display (0-100%)
  - Severity label:
    - **Excellent** (0-10%) - Green
    - **Good** (11-25%) - Yellow
    - **Moderate** (26-50%) - Orange
    - **High** (51%+) - Red

- **Matched Sources List**:
  - Source URL
  - Matched text snippet
  - Individual match percentage
  - Hover effects for interactivity

- **Information Banner**:
  - Warning about high similarity scores
  - Instructions to review results carefully
  - Option to discard and upload new document

- **Action Buttons**:
  - "Discard & Upload New" (Gray) - Restart the process
  - "Confirm & Submit" (Green) - Final submission

##### **Stage 4: Success Message**
- Green success notification
- Confirmation message
- Auto-redirect to qualifications list after 3 seconds

---

## Component Structure

```
src/pages/Qualifications/
├── CohortsList.jsx          # Main cohorts listing page
├── CohortSubmission.jsx     # Multi-stage submission workflow
└── index.js                 # Exports
```

### CohortsList Component

**Props**: None (uses Router location)

**State**:
- `cohorts`: Array of cohort objects
- `loading`: Boolean for loading state
- `filter`: Current filter (all|active|upcoming|completed)

**Key Functions**:
- `getFilteredCohorts()`: Returns cohorts matching current filter
- `getStatusBadge()`: Returns styled status badge
- `handleViewCohort()`: Navigate to submission page or show error
- `formatDate()`: Format dates consistently

### CohortSubmission Component

**Props**: None (uses Router params and location state)

**State**:
- `file`: Selected file object
- `filePreview`: File preview text
- `isChecking`: Boolean for plagiarism check loading
- `plagiarismResult`: Plagiarism check results object
- `submitted`: Boolean for successful submission
- `stage`: Current submission stage (upload|reviewing|results|submitted)

**Key Functions**:
- `handleFileChange()`: Validate and store file selection
- `handleCheckPlagiarism()`: Initiate plagiarism check (mocked)
- `handleDiscard()`: Reset form and return to upload stage
- `handleFinalSubmit()`: Submit after plagiarism check
- `getSeverityColor()`: Return color based on plagiarism score
- `getSeverityBg()`: Return background color based on score
- `getSeverityLabel()`: Return severity label based on score
- `formatDate()`: Format dates consistently

---

## Mock Data Structure

### Cohort Object
```javascript
{
  id: 'cohort-001',
  name: 'Advanced Python Programming Q1 2026',
  description: 'Master advanced Python concepts...',
  startDate: Date,           // JavaScript Date object
  endDate: Date,
  status: 'active',          // active | upcoming | completed
  enrolledLearners: 24,      // Total learners in cohort
  submitted: 0,              // Number who have submitted
}
```

### Plagiarism Result Object
```javascript
{
  documentId: 'doc-1234567890',
  fileName: 'document.docx',
  submissionTime: Date,
  overallScore: 23,          // 0-100 percentage
  status: 'completed',
  sources: [
    {
      url: 'https://example.com/article',
      matchPercentage: 8,
      matchedText: 'Text snippet from match...'
    },
    // ... more sources
  ],
  reportUrl: '/api/qualifications/reports/doc-123...'
}
```

---

## Routes Added to App.jsx

```jsx
// Qualifications routes - learner submission
<Route
  path="/qualifications"
  element={
    <ProtectedRoute>
      <CohortsList />
    </ProtectedRoute>
  }
/>
<Route
  path="/qualifications/cohorts/:cohortId"
  element={
    <ProtectedRoute>
      <CohortSubmission />
    </ProtectedRoute>
  }
/>
```

---

## Validation Rules

### File Upload
- **Accepted Types**: `.doc`, `.docx`
- **Max Size**: 10 MB
- **Required**: Yes, before plagiarism check

### Plagiarism Check
- **Trigger**: Manual click on "Check for Plagiarism" button
- **Processing**: Simulated 3-second delay (mock)
- **Result**: Severity-based color coding

---

## Integration Points (TODO)

The following are placeholder implementations that need backend integration:

### 1. **Fetch Cohorts** (CohortsList.jsx)
```javascript
// Replace mock data with:
const response = await api.get('/api/learner/cohorts');
setCohorts(response.data);
```

### 2. **Check Plagiarism** (CohortSubmission.jsx)
```javascript
// Replace mock delay with:
const formData = new FormData();
formData.append('file', file);
const response = await api.post(
  `/api/qualifications/cohorts/${cohortId}/check-plagiarism`,
  formData
);
setPlagiarismResult(response.data);
```

### 3. **Submit Qualification** (CohortSubmission.jsx)
```javascript
// Replace mock delay with:
const response = await api.post(
  `/api/qualifications/cohorts/${cohortId}/submit`,
  {
    documentId: plagiarismResult.documentId,
    fileName: file.name,
    plagiarismScore: plagiarismResult.overallScore,
  }
);
setSubmitted(true);
```

---

## UI/UX Features

### Color Scheme
- **Primary**: Indigo-600 (actions, active states)
- **Success**: Green (positive actions, results)
- **Warning**: Yellow/Orange (moderate concerns)
- **Error**: Red (high concerns)
- **Neutral**: Gray (backgrounds, disabled states)

### Interactions
- **Hover Effects**: Shadow elevation on cards, color changes on buttons
- **Loading States**: Spinner animation, disabled buttons
- **Feedback**: Toast notifications for errors and success
- **Navigation**: Breadcrumb-style back button with icon

### Accessibility
- Semantic HTML elements
- ARIA labels for icons
- Keyboard navigation support
- Color-blind friendly palette
- Clear visual hierarchy

---

## Mock Data Included

### Sample Cohorts (4 cohorts)
1. **Active**: Advanced Python Programming Q1 2026
2. **Upcoming**: Data Science Fundamentals
3. **Completed**: Web Development Essentials
4. **Active**: Cloud Architecture with AWS

### Sample Plagiarism Results
- Overall score: 23% (Good severity)
- 3 matched sources with varying percentages
- Realistic source URLs and matched text snippets

---

## Navigation Flow

```
CohortsList
    ↓
    ├─ Click "Submit Qualification" (Active Cohort)
    │       ↓
    │   CohortSubmission (Upload Stage)
    │       ↓
    │   [File Upload & Validation]
    │       ↓
    │   "Check for Plagiarism" Button
    │       ↓
    │   CohortSubmission (Reviewing Stage)
    │       ↓
    │   [Plagiarism Analysis In Progress]
    │       ↓
    │   CohortSubmission (Results Stage)
    │       ↓
    │   [Display Plagiarism Results]
    │       ├─ "Discard & Upload New" → Upload Stage
    │       └─ "Confirm & Submit" → Submitted Stage
    │               ↓
    │           [Success Message]
    │               ↓
    │           Auto-redirect to CohortsList
    │
    └─ View Details (Non-Active Cohort) → Toast Error
```

---

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- React 19+
- React Router v6+
- Tailwind CSS 4
- Heroicons (24 outline)
- React Hot Toast

---

## Future Enhancements

1. **Submission History**: View all previous submissions for a cohort
2. **Resubmission**: Allow editing and resubmitting after feedback
3. **Plagiarism Report Export**: Download detailed plagiarism reports
4. **Real-time Notifications**: Notify learners of plagiarism check completion
5. **Submission Deadlines**: Show countdown timer for approaching deadlines
6. **Admin Dashboard**: View submission statistics and plagiarism trends
7. **Bulk Cohort Assignment**: Admins assign cohorts to multiple users
8. **Email Notifications**: Notify learners when new cohorts are available
9. **Search and Filter**: Advanced filtering by tags, dates, subject matter
10. **Plagiarism Threshold**: Automatic rejection if score exceeds threshold

---

## Testing Recommendations

### Manual Testing
1. Test cohort list filtering on all statuses
2. Test file upload with various file types
3. Verify file size validation (test with >10MB)
4. Test plagiarism check workflow
5. Verify color coding changes with different scores
6. Test discard and resubmit flow
7. Test back navigation and state preservation
8. Test on mobile devices for responsive design

### Automated Testing (Future)
- Unit tests for utility functions
- Component snapshot tests
- Integration tests for API calls
- E2E tests for complete workflows

---

## File Locations

- Components: `/src/pages/Qualifications/`
- Routes: `/src/App.jsx`
- Utils: Uses existing `/src/utils/api.js` for API calls

---

## Notes for Development

1. **Mock Data**: Currently uses hardcoded mock data for development. Replace with API calls before production.

2. **Toast Notifications**: Uses react-hot-toast (already configured in project).

3. **Date Handling**: Uses JavaScript Date objects. Consider using date-fns library for consistency if not already used.

4. **File Extraction**: The actual text extraction from Word documents will need a library like:
   - `mammoth` (for .docx files)
   - `python-docx` wrapper (if server-side)

5. **Plagiarism API Integration**: Will need API keys for:
   - Copyleaks API
   - ChatGPT API
   - Or similar plagiarism detection service

6. **Error Handling**: Add specific error messages for:
   - Network failures
   - Invalid file formats
   - File upload interruptions
   - API timeout errors

7. **Progress Persistence**: Implement session storage to preserve form state if user navigates away and returns.

---

## References

- [Heroicons Documentation](https://heroicons.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com/)
- [React Hot Toast Documentation](https://react-hot-toast.com/)
