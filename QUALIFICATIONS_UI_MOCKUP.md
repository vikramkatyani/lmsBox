# Qualification Management Module - UI/UX Mockup Guide

## Page 1: Cohorts List Page (`/qualifications`)

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  LMS Box Header/Navigation                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Qualifications                                    │
│  View and submit qualifications for available     │
│  cohorts                                           │
│                                                     │
│  [All] [Active] [Upcoming] [Completed]            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Cohort Card 1                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Advanced Python Programming Q1 2026  [ACTIVE ✓] │ │
│ │ Master advanced Python concepts including...    │ │
│ │                                                 │ │
│ │ Start Date: Jan 20, 2026 | End Date: Mar 20... │ │
│ │ Submissions: 0/24                              │ │
│ │                                                 │ │
│ │ [Submit Qualification]                          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Cohort Card 2                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Data Science Fundamentals           [UPCOMING ⏱] │ │
│ │ Learn the fundamentals of data science...      │ │
│ │                                                 │ │
│ │ Start Date: Feb 1, 2026 | End Date: Apr 1, ... │ │
│ │ Submissions: 0/18                              │ │
│ │                                                 │ │
│ │ [View Details]                                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Cohort Card 3                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Web Development Essentials         [COMPLETED ✓] │ │
│ │ Build modern web applications using...         │ │
│ │                                                 │ │
│ │ Start Date: Sep 15, 2025 | End Date: Dec 15... │ │
│ │ Submissions: 28/32                             │ │
│ │                                                 │ │
│ │ [View Details]                                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Cohort Card 4                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Cloud Architecture with AWS           [ACTIVE ✓] │ │
│ │ Design and deploy scalable cloud solutions...  │ │
│ │                                                 │ │
│ │ Start Date: Jan 27, 2026 | End Date: Apr 27... │ │
│ │ Submissions: 3/15                              │ │
│ │                                                 │ │
│ │ [Submit Qualification]                          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Color Scheme for Status Badges

```
Active:     ✓ (Green background #dcfce7, Green text #166534)
Upcoming:   ⏱ (Blue background #dbeafe, Blue text #1e40af)
Completed:  ✓ (Gray background #f3f4f6, Gray text #374151)
```

### Filter Button States

```
Inactive:   [Filter] - White bg, gray text, gray border
Active:     [Filter] - Indigo bg #4f46e5, white text, no border
```

---

## Page 2: Cohort Submission - Stage 1 (Upload)

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  ← Back to Qualifications                           │
│                                                     │
│  Submit Qualification                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cohort Information Card                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Advanced Python Programming Q1 2026             │ │
│  │ Master advanced Python concepts including...   │ │
│  │                                                 │ │
│  │ Start Date: Jan 20, 2026                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  Upload Document Section                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Select Word Document (.doc, .docx)              │ │
│  │                                                 │ │
│  │ ╔═══════════════════════════════════════════╗   │ │
│  │ ║                                           ║   │ │
│  │ ║          📄 Click or drag file             ║   │ │
│  │ ║                                           ║   │ │
│  │ ║      Word documents up to 10MB             ║   │ │
│  │ ║                                           ║   │ │
│  │ ╚═══════════════════════════════════════════╝   │ │
│  │                                                 │ │
│  │ (File Preview - after selection)                │ │
│  │ ┌────────────────────────────────────────────┐  │ │
│  │ │ 📄 submission.docx (256.45 KB)              │  │ │
│  │ │ [Remove file]                               │  │ │
│  │ └────────────────────────────────────────────┘  │ │
│  │                                                 │ │
│  │ [Check for Plagiarism]                         │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  * "Check for Plagiarism" button disabled until   │ │
│    a valid file is selected                       │ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Button States

```
Enabled:    [Check for Plagiarism] - Indigo bg, white text
Disabled:   [Check for Plagiarism] - Gray bg, gray text (cursor not-allowed)
```

---

## Page 3: Cohort Submission - Stage 2 (Checking)

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  (Same header and cohort info as Stage 1)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Checking Progress Section                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │                                                 │ │
│  │             ⏳ (spinning animation)              │ │
│  │                                                 │ │
│  │    Checking for Plagiarism                     │ │
│  │    Please wait while we analyze your document  │ │
│  │                                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  * Takes ~3 seconds (mocked)                       │ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Page 4: Cohort Submission - Stage 3 (Results)

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  (Same header and cohort info as Stage 1)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Results Section - Overall Score                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Plagiarism Check Results                    23%│ │
│  │ Analysis of: submission.docx                   │ │
│  │                                                 │ │
│  │ Severity: Good                                  │ │
│  │                                                 │ │
│  │ (Background color changes by severity:         │ │
│  │  0-10% → Green, 11-25% → Yellow,              │ │
│  │  26-50% → Orange, 51%+ → Red)                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  Matched Sources Section                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Matched Sources                                 │ │
│  │                                                 │ │
│  │ ┌─ Source 1 ───────────────────────────────┐   │ │
│  │ │ https://example-article.com/python-guide │ 8%│ │
│  │ │ Matched: "Python is a high-level..."    │   │ │
│  │ └───────────────────────────────────────────┘   │ │
│  │                                                 │ │
│  │ ┌─ Source 2 ───────────────────────────────┐   │ │
│  │ │ https://github.com/sample-repo/code      │10%│ │
│  │ │ Matched: "def process_data(dataset):..." │   │ │
│  │ └───────────────────────────────────────────┘   │ │
│  │                                                 │ │
│  │ ┌─ Source 3 ───────────────────────────────┐   │ │
│  │ │ https://documentation.readthedocs.io     │ 5%│ │
│  │ │ Matched: "The following methods are..."  │   │ │
│  │ └───────────────────────────────────────────┘   │ │
│  │                                                 │ │
│  │ [View Full Report →]                            │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  Information Banner                                │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ⚠  Important                                    │ │
│  │ Review the plagiarism results carefully. A high│ │
│  │ similarity score may indicate significant      │ │
│  │ plagiarism. You can choose to discard this    │ │
│  │ submission and upload a revised document.     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  Action Buttons                                    │
│  [Discard & Upload New]  [Confirm & Submit]       │
│   (Gray button)          (Green button)            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Color Coding for Scores

```
Excellent:  0-10%  → Green (#dcfce7 bg, #166534 text)
Good:      11-25%  → Yellow (#fef3c7 bg, #92400e text)
Moderate:  26-50%  → Orange (#fed7aa bg, #b45309 text)
High:       51%+   → Red (#fee2e2 bg, #991b1b text)
```

---

## Page 5: Cohort Submission - Stage 4 (Submitted)

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  (Same header and cohort info)                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Success Message                                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ✓ Submission Successful                         │ │
│  │ Your qualification has been submitted          │ │
│  │ successfully. You'll be redirected to the      │ │
│  │ qualifications page.                           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  (Auto-redirects to /qualifications after 3s)     │ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Responsive Design Breakpoints

### Desktop (1024px+)
- Grid layout for cohort cards
- Full-width content area
- Standard button sizes

### Tablet (768px - 1023px)
- 2-column grid for cohort cards
- Adjusted padding and margins
- Touch-friendly button sizes

### Mobile (< 768px)
- Single column layout
- Full-width cards with minimal margins
- Large touch targets for buttons
- Stacked button layouts
- Responsive font sizes

---

## Interactive Elements

### Hover States
```
Buttons:
  - Slight shadow increase
  - Color brightening
  - Cursor change to pointer
  
Cards:
  - Shadow elevation
  - Subtle color change
  - Cursor change to pointer
  
Links:
  - Color change
  - Underline decoration
  - Cursor change to pointer
```

### Focus States (Keyboard Navigation)
```
Buttons:      Outline ring, color highlight
Input fields: Blue outline, focus-visible ring
Links:        Underline, outline ring
```

### Disabled States
```
Buttons:      Gray background, gray text, cursor not-allowed
Input fields: Gray background, lighter text, cursor default
Cards:        Opacity reduced
```

### Loading States
```
Spinner:      Rotating animation (12px indigo spinner)
Text:         "Checking for Plagiarism..."
Buttons:      Disabled with loading text
```

---

## Typography

### Headings
- H1: 30px, bold (page title)
- H2: 20px, bold (section titles)
- H3: 18px, semibold (card titles)

### Body Text
- Regular: 14px, normal weight
- Small: 12px, normal weight
- Emphasized: 14px, semibold

### Colors
- Primary text: #111827 (gray-900)
- Secondary text: #6b7280 (gray-600)
- Tertiary text: #9ca3af (gray-400)

---

## Spacing Conventions

### Padding
- Small: 4px, 8px
- Medium: 12px, 16px
- Large: 24px, 32px

### Gaps
- Cards: 6px gap (grid)
- Sections: 24px gap
- Elements within card: 12px gap

---

## Icon Usage

### Heroicons (24 outline)
- CalendarIcon: Date displays
- CheckCircleIcon: Active/completed status
- ClockIcon: Upcoming status
- DocumentIcon: File upload areas
- ExclamationIcon: Warning banners
- ArrowLeftIcon: Back navigation

---

## Toast Notifications

### Success Toast
```
✓ Plagiarism check completed
✓ Submission discarded
✓ Qualification submitted successfully
```

### Error Toast
```
✗ Please select a file first
✗ Please select a valid Word document (.doc or .docx)
✗ File size must be less than 10MB
✗ Failed to check plagiarism
✗ Failed to submit qualification
✗ You can only submit to active cohorts
```

### Position
- Top-right corner
- 4-second duration

---

## Accessibility Features

### Color
- Not only color, but also text and icons convey meaning
- High contrast ratios (WCAG AA compliance)
- Color-blind friendly palette

### Text
- Clear, descriptive button labels
- Helpful error messages
- Semantic HTML structure

### Navigation
- Keyboard-accessible buttons and links
- Logical tab order
- Skip links for quick navigation

### Images & Icons
- Alt text for decorative elements
- ARIA labels where needed
- Semantic meaning through context

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│ Cohorts List Page                                   │
│ - Filter cohorts                                    │
│ - View cohort details                              │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Click "Submit Qualification"
                 │ (Active cohorts only)
                 ▼
┌─────────────────────────────────────────────────────┐
│ Stage 1: Upload Document                            │
│ - Select Word document                             │
│ - Validate file                                    │
│ - Show file preview                                │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Click "Check for Plagiarism"
                 ▼
┌─────────────────────────────────────────────────────┐
│ Stage 2: Checking Progress                          │
│ - Show loading spinner                             │
│ - ~3 second delay                                  │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Check complete
                 ▼
┌─────────────────────────────────────────────────────┐
│ Stage 3: Display Results                            │
│ - Show overall plagiarism score                    │
│ - Show color-coded severity                        │
│ - List matched sources                             │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           │ "Discard & Upload New"  │ "Confirm & Submit"
           ▼                          ▼
      Back to Stage 1            Stage 4: Success
                                │
                                │ Auto-redirect (3s)
                                ▼
                            Back to Cohorts List
```

---

## Animation Specifications

### Loading Spinner
- Size: 48px
- Color: Indigo-600 (#4f46e5)
- Animation: Linear rotation, 1s duration, infinite

### Transitions
- Button hover: 150ms ease-in-out
- Modal open/close: 300ms ease-in-out
- Color changes: 200ms ease

### Fade In/Out
- Page load: 300ms fade in
- Success message: 500ms fade in

---

## Notes

1. All colors follow Tailwind CSS 4 color palette
2. All spacing follows 4px grid system
3. All typography uses system fonts (consistent with Tailwind defaults)
4. All interactions provide visual feedback
5. All pages are mobile-responsive
6. All content is accessible per WCAG 2.1 AA standards

