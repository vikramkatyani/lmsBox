# AI Learning Recommendations - Visual Implementation Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LEARNER INTERFACE LAYER                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Dashboard Widget          Course List Widget       Learning Path Modal    │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │ 🤖 Recommended   │     │ "Personalized    │     │ Your Learning    │   │
│  │    Start Python  │     │  Just for You"   │     │ Journey          │   │
│  │                  │     │ ┌──────────────┐ │     │ ┌──────────────┐ │   │
│  │ Confidence: 87%  │     │ │ Course A     │ │     │ Step 1: Py    │ │   │
│  │                  │     │ │ (AI explains)│ │     │ Step 2: SQL   │ │   │
│  │ [Start] [Other]  │     │ └──────────────┘ │     │ Step 3: Data  │ │   │
│  └──────────────────┘     └──────────────────┘     │ 12 weeks est. │ │   │
│                                                     └──────────────┘ │   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
            ┌────▼───────┐    ┌────▼────────┐   ┌────▼──────┐
            │ Get Next    │    │ Skill Gap    │   │ Pathway   │
            │ Course      │    │ Analysis     │   │ Generate  │
            └────┬───────┘    └────┬────────┘   └────┬──────┘
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    │
         ┌──────────────────────────▼───────────────────────────┐
         │        API LAYER - LearningRecommendationsController  │
         │  /api/learner/recommendations/                        │
         │  ├─ GET  /next-course                                │
         │  ├─ POST /learning-pathway                           │
         │  ├─ GET  /skill-gaps                                 │
         │  └─ POST /{id}/feedback                              │
         └──────────────────────────┬───────────────────────────┘
                                    │
         ┌──────────────────────────▼───────────────────────────┐
         │     SERVICE LAYER - LearningRecommendationService    │
         ├──────────────────────────────────────────────────────┤
         │                                                      │
         │  ┌─ Collaborative Filtering                          │
         │  │  (Similar learners → Similar courses)            │
         │  │  Score: 0-100                                    │
         │  │                                                  │
         │  ├─ Content-Based Filtering                          │
         │  │  (Tags, categories, difficulty match)           │
         │  │  Score: 0-100                                    │
         │  │                                                  │
         │  ├─ Context-Aware Scoring                            │
         │  │  (Career goals, skill gaps, preferences)        │
         │  │  Score: 0-100                                    │
         │  │                                                  │
         │  └─ Hybrid Composite Ranking                         │
         │     40% Collaborative + 40% Content + 20% Context  │
         │     AI Explanation Generation                       │
         │                                                      │
         └──────────────────┬───────────────────┬───────────────┘
                            │                   │
              ┌─────────────▼──┐    ┌──────────▼──────────┐
              │ OpenAI GPT-4o  │    │ Recommendation DB   │
              │ ───────────    │    │ ──────────────────  │
              │ Explain why    │    │ CourseRecommendation│
              │ Pathway gen    │    │ LearnerProfile      │
              │ Skill analysis │    │ LearnerPreferences  │
              │ Natural lang   │    │ Feedback trail      │
              └────────────────┘    └─────────────────────┘
                                            │
              ┌─────────────────────────────▼──────────────────┐
              │        DATA LAYER - SQL Server Database       │
              ├──────────────────────────────────────────────┤
              │                                              │
              │  Core Tables:                               │
              │  ├─ Users (ApplicationUser)                 │
              │  ├─ Courses                                 │
              │  ├─ LearnerProgress                         │
              │  ├─ Feedback                                │
              │  ├─ LearningPathway                         │
              │  │                                          │
              │  New Tables:                                │
              │  ├─ LearnerProfile                          │
              │  ├─ CourseRecommendation                    │
              │  ├─ LearnerPreferenceProfile                │
              │  └─ RecommendationFeedback                  │
              │                                              │
              └──────────────────────────────────────────────┘
```

## Data Flow for Recommendation Generation

```
START: Learner completes course
       │
       ▼
1. COLLECTION
   │
   ├─→ Get learner profile
   │   (preferences, goals, learning style)
   │
   ├─→ Get completed courses
   │   (history, success metrics, time spent)
   │
   ├─→ Get engagement metrics
   │   (login patterns, activity streaks)
   │
   └─→ Get available courses
       (all active, non-completed options)
       │
       ▼
2. SCORING - Three Parallel Algorithms
   │
   ├─ ALGORITHM A: COLLABORATIVE
   │  │
   │  ├─→ Find similar learners
   │  │   (Jaccard similarity on courses)
   │  │
   │  ├─→ Get their completed courses
   │  │
   │  ├─→ Score each course
   │  │   (weighted by learner similarity)
   │  │
   │  └─→ Output: Scores 0-100 per course
   │
   ├─ ALGORITHM B: CONTENT-BASED
   │  │
   │  ├─→ Extract learner interests
   │  │   (from completed course tags)
   │  │
   │  ├─→ Match to course tags/categories
   │  │
   │  ├─→ Calculate similarity scores
   │  │   (tag overlap: 20 points each)
   │  │   (category match: 10 points each)
   │  │
   │  └─→ Output: Scores 0-100 per course
   │
   └─ ALGORITHM C: CONTEXT-AWARE
      │
      ├─→ Get learner goals
      │
      ├─→ Identify skill gaps
      │   (needed skills vs possessed)
      │
      ├─→ Find gap-filling courses
      │
      ├─→ Adjust for difficulty preference
      │
      └─→ Output: Scores 0-100 per course
         │
         ▼
3. MERGING & RANKING
   │
   ├─→ Weighted average of three scores
   │   (40% Collaborative + 40% Content + 20% Context)
   │
   ├─→ Sort by composite score descending
   │
   ├─→ Apply filters
   │   (exclude: already taken, prerequisites not met)
   │
   └─→ Top 5 ranked candidates
       │
       ▼
4. AI ANALYSIS
   │
   ├─→ Prepare candidate list for GPT-4o
   │
   ├─→ Send prompt:
   │   "Analyze these courses for learner X to explain
   │    why top course is best match"
   │
   ├─→ GPT-4o generates natural language explanation
   │   "Based on your completion of Python and
   │    interest in Data Science, we recommend SQL
   │    as the next logical step..."
   │
   └─→ Insight: Why it matters, what learner gains
       │
       ▼
5. STORAGE
   │
   └─→ Save CourseRecommendation record
       ├─ userId
       ├─ courseId
       ├─ scores (collab, content, context)
       ├─ reason (AI-generated)
       ├─ confidence
       └─ timestamp
       │
       ▼
6. PRESENTATION
   │
   └─→ Return to Frontend
       ├─ Course title
       ├─ Course description
       ├─ Confidence score (87%)
       ├─ Reason (AI-generated natural language)
       ├─ Alternative courses (next 2-3)
       └─ Action buttons: [Enroll] [Dismiss] [Info]
       │
       ▼
7. FEEDBACK LOOP
   │
   ├── If learner ENROLLS
   │   → Mark as "ActedUpon"
   │   → Track completion metrics
   │   → Improve algorithm scoring
   │
   ├── If learner DISMISSES
   │   → Record rejection
   │   → Analyze why (collect optional feedback)
   │   → Adjust future recommendations
   │
   └── If learner provides RATING
       → Store satisfaction score
       → Include in relevance metrics
       → Monthly algorithm evaluation

END ──→ Continuous optimization cycle
```

## Algorithm Decision Tree

```
START: Generate Recommendations for User X
       │
       ▼
    New User? (0-2 courses completed)
    │
    ├─ YES → Use CONTENT + DEFAULT PATHWAYS
    │        (Collaborative has no signal)
    │        ├─ Show popular courses
    │        ├─ Show beginner pathways
    │        └─ Personalize by stated preferences
    │
    └─ NO → Continue
            │
            ▼
         Has Career Goal Set?
         │
         ├─ YES → Prioritize GOAL-ALIGNED courses
         │        ├─ Boost context score 2x
         │        ├─ Generate pathway to goal
         │        └─ Show skill progression
         │
         └─ NO → Continue
                 │
                 ▼
              Learning Velocity Analysis
              │
              ├─ FAST (>2 courses/month)
              │  └─ Recommend: Advanced difficulty
              │     │ Faster-paced
              │     └─ Specialized topics
              │
              ├─ MODERATE (1-2 courses/month)
              │  └─ Recommend: Mixed difficulty
              │     │ Balanced progression
              │     └─ Standard progression
              │
              └─ SLOW (<1 course/month)
                 └─ Recommend: Easy difficulty
                    │ Simpler prerequisite-based
                    └─ High success probability
                    │
                    ▼
                 Apply Engagement Recovery?
                 │
                 ├─ YES (stalled for >14 days)
                 │  └─ Recommend shorter, easier course
                 │     │ Quick wins to re-engage
                 │     └─ Related to previous interest
                 │
                 └─ NO → Normal recommendations
```

## Database Schema Additions

```
Existing Tables:
├─ ApplicationUser
│  ├─ Id
│  ├─ FirstName, LastName, Email
│  ├─ OrganisationID
│  └─ FOREIGN KEY to Organisation

├─ Course
│  ├─ Id, Title, Description
│  ├─ Category, Tags (JSON)
│  ├─ Status (Active/Draft)
│  └─ OrganisationId

├─ LearnerProgress
│  ├─ UserId → ApplicationUser
│  ├─ CourseId → Course
│  ├─ Completed, CompletedAt
│  └─ ProgressPercent

└─ Feedback
   ├─ UserId → ApplicationUser
   ├─ CourseId → Course
   ├─ Rating (1-5)
   └─ Comment

NEW TABLES:
├─ LearnerProfile
│  ├─ Id (PK)
│  ├─ UserId (FK) → ApplicationUser
│  ├─ PreferredLearningStyle (visual/auditory/reading/kinesthetic)
│  ├─ CareerGoal (VARCHAR)
│  ├─ InterestTags (JSON)
│  ├─ DifficultyPreference
│  ├─ AverageCourseDurationDays (INT)
│  ├─ AverageCompletionRate (DECIMAL)
│  ├─ LastLearningActivity (DATETIME)
│  ├─ LearnerSegment (VARCHAR)
│  ├─ EnableAIRecommendations (BIT)
│  ├─ RecommendationFrequencyDays (INT)
│  ├─ LastRecommendationGeneratedAt (DATETIME)
│  ├─ CreatedAt, UpdatedAt
│  └─ Index: UserId

├─ CourseRecommendation
│  ├─ Id (PK)
│  ├─ UserId (FK) → ApplicationUser
│  ├─ RecommendedCourseId (FK) → Course
│  ├─ PathwayId (FK, nullable) → LearningPathway
│  ├─ RecommendationType (VARCHAR)
│  ├─ RecommendationReason (VARCHAR)
│  ├─ ConfidenceScore (DECIMAL)
│  ├─ CollaborativeScore (DECIMAL)
│  ├─ ContentScore (DECIMAL)
│  ├─ ContextScore (DECIMAL)
│  ├─ AIRecommendationReason (NVARCHAR(MAX))
│  ├─ SkillGapAnalysis (NVARCHAR(MAX))
│  ├─ IsViewed (BIT)
│  ├─ ViewedAt (DATETIME)
│  ├─ IsActedUpon (BIT)
│  ├─ ActedUponAt (DATETIME)
│  ├─ IsFeedbackProvided (BIT)
│  ├─ UserFeedback (VARCHAR)
│  ├─ RelevanceRating (INT)
│  ├─ CreatedAt, ExpiresAt
│  ├─ Index: UserId, CreatedAt
│  └─ Index: ConfidenceScore DESC

└─ LearnerPreferenceProfile
   ├─ Id (PK)
   ├─ UserId (FK) → ApplicationUser
   ├─ SkillArea (VARCHAR)
   ├─ ProficiencyLevel (INT, 1-5)
   ├─ RelatedCourses (JSON)
   ├─ InterestTag (VARCHAR)
   ├─ InterestStrength (DECIMAL, 0-100)
   ├─ LastUpdatedAt (DATETIME)
   └─ Index: UserId, SkillArea
```

## Frontend Component Structure

```
App
├─ Dashboard
│  └─ RecommendationWidget
│     ├─ Recommended Course Card
│     │  ├─ Course Image
│     │  ├─ Course Title
│     │  ├─ AI Reason (paragraph)
│     │  ├─ Confidence Score (visual meter)
│     │  ├─ [Start] [Show Alternatives] buttons
│     │  └─ Suggested badges
│     │
│     └─ Loading/Empty state
│
├─ Courses List Page
│  │
│  └─ Section: "Personalized for You" (above main list)
│     └─ Grid of 3-4 RecommendedCourseCard components
│
├─ Course Detail Page
│  │
│  └─ After completion section:
│     └─ NextCourseRecommendation
│        ├─ What's Next title
│        ├─ Recommended course card
│        ├─ AI explanation
│        └─ [Enroll Now] button
│
├─ Learning Path Page
│  │
│  └─ If pathway recommended, show modal:
│     └─ LearningPathwayRecommendationModal
│        ├─ Pathway title
│        ├─ Visual course sequence
│        ├─ Duration estimate
│        ├─ Skill progression
│        └─ [Accept] [Customize] [Dismiss] buttons
│
├─ Skill Gap Analysis Page
│  │
│  └─ SkillGapAnalysisDashboard
│     ├─ Current Skills vs Target
│     ├─ Gaps identified (list)
│     ├─ Recommended courses per gap
│     ├─ Progress roadmap
│     └─ Time to mastery estimates
│
└─ Profile/Settings Page
   └─ Learning Preferences Section
      ├─ Career Goal input
      ├─ Learning Style selector
      ├─ Interest tags
      ├─ Difficulty preference
      ├─ Enable/disable recommendations toggle
      └─ [Save Preferences] button
```

## Integration Points with Existing System

```
EXISTING SYSTEMS          │         NEW RECOMMENDATION ENGINE
─────────────────────────┼──────────────────────────────────

ApplicationUser ──────────┼────→ LearnerProfile (extended profile)
                         │
LearnerProgress ─────────┼────→ Uses for:
(completed courses)      │      • Skill assessment
                         │      • Learning velocity
                         │      • Pattern analysis
                         │
Feedback ────────────────┼────→ Uses for:
(course ratings)         │      • Interest signals
                         │      • Content affinity
                         │
Course ──────────────────┼────→ Recommendation input
(catalog)                │      • Tags/categories
                         │      • Difficulty
                         │      • Prerequisites
                         │
LearningPathway ─────────┼────→ Creates/suggests
                         │      pathways via AI
                         │
EngagementTracking ──────┼────→ Segments learners:
                         │      • Quick-learner
                         │      • Steady-learner
                         │      • Struggling-learner
```

## Implementation Gantt Chart

```
WEEK 1 - FOUNDATION
├─ [████] Day 1-2: Create database schema
├─ [████] Day 3-4: Migrations & seeding
└─ [████] Day 5: Service interface design

WEEK 2-3 - ALGORITHMS
├─ [████] Week 2a: Collaborative filtering impl
├─ [████] Week 2b: Content-based filtering impl
├─ [████] Week 2c: Context-aware scoring impl
└─ [████] Week 3a: Composite ranking logic

WEEK 3-4 - INTEGRATION
├─ [████] Week 3b: API controller design
├─ [████] Week 3c: API endpoints implementation
├─ [████] Week 4a: Error handling & validation
└─ [████] Week 4b: API documentation

WEEK 5 - AI INTEGRATION
├─ [████] Week 5a: OpenAI prompt engineering
├─ [████] Week 5b: Explanation generation
└─ [████] Week 5c: Feedback processing

WEEK 6 - FRONTEND
├─ [████] Week 6a: Component development
├─ [████] Week 6b: Dashboard integration
└─ [████] Week 6c: Preference management UI

WEEK 7-8 - TESTING & OPTIMIZATION
├─ [████] Week 7a: Unit tests
├─ [████] Week 7b: Integration tests
├─ [████] Week 7c: Performance tuning
└─ [████] Week 8: UAT & bugfixes

WEEK 9 - DEPLOYMENT
└─ [████] Production rollout & monitoring
```

## Key Metrics Dashboard

```
┌─────────────────────────────────────────────────────┐
│           RECOMMENDATION METRICS DASHBOARD           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Acceptance Rate        │  Confidence Score        │
│  ┌────────────────┐     │  ┌────────────────┐     │
│  │      68%       │     │  │     0.76       │     │
│  │   ↑ 8% today  │     │  │   ↑ 0.02 today│     │
│  └────────────────┘     │  └────────────────┘     │
│                         │                         │
│  Completion Rate        │  Satisfaction Score     │
│  ┌────────────────┐     │  ┌────────────────┐     │
│  │      72%       │     │  │    4.1/5.0     │     │
│  │   vs 45% no rec│     │  │   ↑ 60%        │     │
│  └────────────────┘     │  └────────────────┘     │
│                         │                         │
│  Recommendation Usage   │  Algorithm Performance  │
│  ┌────────────────┐     │  ┌────────────────┐     │
│  │   1,245 total  │     │  │ Collab:  79%   │     │
│  │   ↑ 34 today   │     │  │ Content: 81%   │     │
│  └────────────────┘     │  │ Context: 84%   │     │
│                         │  └────────────────┘     │
└─────────────────────────────────────────────────────┘

TRENDING COURSES          LEARNER SEGMENTS
┌──────────────────────┐ ┌──────────────────────┐
│ 1. Python Adv (54%)  │ │ Quick: 34% (2 days)  │
│ 2. SQL Basics (48%)  │ │ Steady: 49% (8 days) │
│ 3. Data Viz (42%)    │ │ Slow: 17% (14 days)  │
└──────────────────────┘ └──────────────────────┘
```

## Error Handling Flow

```
Recommendation Request
       │
       ▼
   Is user valid?
   ├─ NO → 401 Unauthorized
   │
   └─ YES → Get learner profile
            │
            ├─ Error → 500 + log error
            │  (Fall back to popular courses)
            │
            └─ Continue → Score courses
                         │
                         ├─ Timeout → Use cached scores
                         │
                         ├─ DB Error → 503 Service Unavailable
                         │
                         └─ Continue → Generate AI explanation
                                      │
                                      ├─ AI Service unavailable
                                      │  → Skip explanation
                                      │
                                      └─ Return recommendation
                                         with/without AI insight
```

---

**Legend:**
- `────` = Data flow
- `▼` = Process/decision
- `├─` = Branch
- `[████]` = Completed milestone
- `→` = References/integration

This visual guide complements the comprehensive strategy document for implementation success.
