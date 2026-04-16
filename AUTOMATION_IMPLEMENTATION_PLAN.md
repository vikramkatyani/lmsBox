# Automation Feature Implementation Plan

## 1. Confirmed Product Decisions

- Automation creation and management permission: OrgAdmin
- Reminder third state: NotCompleted
- Scheduling must use business timezone per organization
- Announcement must support admin-selected date and time
- All automation types must support Draft state
- Only Published automation tasks are allowed to execute actions

## 2. Current System Capabilities and Gaps

### 2.1 Available grouping and categorization options now

The current codebase already supports:

- Organization scoping by OrganisationID
- Learning pathway based grouping (AdminLearningPathways)
- User list filtering and selection from admin users endpoint
- Course selection and assignment relationships

### 2.2 Announcement targeting model for Phase 1

Announcement audience options are limited to:

- All users in the organization
- Users in specific learning pathways from the same organization (multi-select)

No location or department targeting is included in Phase 1.

### 2.3 Timezone support gap

Organization timezone is not currently stored as a first-class field. It must be added to support business timezone scheduling.

## 3. Phase 1 Scope

Create an Automation module with three task types:

1. Notification
2. Reminder
3. Announcement

Each task type must support:

- Draft and Published states
- Pause and Resume for published tasks
- OrgAdmin ownership and organization scoping
- Rich email content with minimal formatting tools

## 4. Data Model Changes

## 4.1 New table: AutomationTasks

Purpose: stores automation configuration and lifecycle state.

Suggested fields:

- Id
- OrganisationId
- CreatedByUserId
- UpdatedByUserId
- Type (Notification, Reminder, Announcement)
- Status (Draft, Published, Paused, Archived)
- Title
- Description
- EventKey
- EmailSubject
- EmailBodyHtml
- AudienceType
- AudienceFilterJson
- CourseFilterJson
- ScheduleMode
- DaysAfterAssignment
- IntervalMinutes
- AnnouncementSendAtLocal
- AnnouncementSendAtUtc
- TimeZoneId
- CreatedAtUtc
- UpdatedAtUtc
- PublishedAtUtc

Important rule:

- Tasks in Draft must never enqueue or send emails.

## 4.2 New table: AutomationDispatches

Purpose: stores queued and sent email executions for reliability and auditing.

Suggested fields:

- Id
- AutomationTaskId
- OrganisationId
- UserId
- RecipientEmail
- SubjectSnapshot
- BodySnapshot
- ScheduledForUtc
- Status (Pending, Processing, Sent, Failed, Cancelled)
- Attempts
- LastError
- SentAtUtc
- IdempotencyKey
- CreatedAtUtc
- UpdatedAtUtc

## 4.3 Organization timezone field

Add to organization entity:

- TimeZoneId (for example Europe London, Asia Dubai)

Usage:

- Convert all local admin selected times into UTC at save time
- Display and edit schedules in organization local timezone

## 4.4 Audience model for announcement targeting

Use existing learning pathway relationships for targeted announcements.

Implementation notes:

- Add AudienceType values:
  - AllUsers
  - LearningPathways
- Store selected learning pathway IDs in AudienceFilterJson
- Validate all selected pathway IDs belong to the admin's organization
- Support multiple pathway selection in one announcement

## 5. Permission and Security Rules

- OrgAdmin can create, edit, publish, pause, resume, and archive automation tasks in their own organization
- All task and dispatch queries must be organization scoped
- Publish endpoint must validate required fields for the selected task type
- Draft tasks are editable; published tasks may lock key trigger fields based on policy

## 6. Task Type Behavior

## 6.1 Notification

Fields:

- Event selection: CourseAssignment, CourseCompletion
- Course selector with search and select all
- Title, description, email subject, rich text email body
- Send timing:
  - Immediate when event occurs
  - Delayed by fixed interval after event

Execution:

- Event occurs
- Matching published notification tasks are found
- Eligible users are resolved
- Dispatches are created with scheduled UTC time

## 6.2 Reminder

Fields:

- Event state selection: NotStarted, InProgress, NotCompleted
- Course selector with search and select all
- Title, description, email subject, rich text email body
- Number of days after assignment

Execution:

- Background processor evaluates learner state relative to assignment date
- Sends only for published reminder tasks
- Uses dedupe rules to avoid duplicate reminder on same schedule window

## 6.3 Announcement

Fields:

- Title, description, email subject, rich text email body
- Audience selection:
  - All users
  - Users in one or more selected learning pathways (same organization only)
- Date and time selector in organization business timezone
- Optional send now shortcut

Execution:

- On publish, if send time is now or in past, queue immediately
- If future, queue dispatches for scheduled UTC equivalent

## 7. UI and UX Implementation

## 7.1 Automation list page

- New Admin menu item: Automation
- Table of organization automation tasks
- Filters: type, status, event, text search
- Top-right create dropdown with:
  - Notification
  - Reminder
  - Announcement

Actions per row:

- Edit
- Publish (if Draft)
- Pause or Resume (if Published)
- Archive
- View send history

## 7.2 Modal forms

Common fields:

- Title
- Description
- Email subject
- Email rich text body

Type specific sections:

- Notification rules
- Reminder rules
- Announcement audience and schedule

Validation:

- Publish blocked unless all required fields are valid
- Save as Draft always available

## 7.3 Rich text editor constraints

Minimal formatting tools:

- Bold
- Italic
- Underline
- Bulleted list
- Link

Security:

- Sanitize stored HTML body before persistence

## 8. Backend Services and Processing

## 8.1 New services

- AutomationTaskService
- AutomationAudienceService
- AutomationDispatchService
- AutomationScheduleService
- AutomationTemplateService

## 8.2 Background worker

Add hosted service to process pending dispatches:

- Poll interval example: 1 minute
- Claim pending jobs safely
- Send via existing email service
- Retry with capped backoff
- Mark final state and log errors

## 8.3 Event hooks for notifications

Integrate at existing event points:

- Course assignment flows
- Course completion flows

After successful domain event state change:

- Evaluate published automation tasks
- Queue dispatches only, do not directly send inline

## 9. API Endpoints

## 9.1 Automation task APIs

- List tasks
- Get task by id
- Create task (defaults to Draft)
- Update task
- Publish task
- Pause task
- Resume task
- Archive task

## 9.2 Lookup APIs

- Course search endpoint for selector
- Audience lookup endpoints:
  - List learning pathways for current organization
  - Preview recipient count

## 9.3 Dispatch monitoring APIs

- Task dispatch summary
- Dispatch list with status and error
- Retry failed dispatch item

## 10. Timezone Handling Rules

- All persisted execution times must be UTC
- All admin entered schedule times are organization local time
- Every schedule conversion must use organization TimeZoneId
- UI always displays local organization time for editing and list readability

## 11. State Machine

- Draft:
  - editable
  - no execution
- Published:
  - active and executable
- Paused:
  - published config retained
  - no new dispatch creation while paused
- Archived:
  - read-only historical
  - no execution

## 12. Testing Plan

## 12.1 Unit tests

- Publish validation by task type
- Reminder state evaluation
- Audience resolution for each audience type
- Timezone conversion local to UTC and UTC to local

## 12.2 Integration tests

- OrgAdmin permission enforcement
- Organization data isolation
- Notification event to dispatch queue flow
- Reminder scheduler behavior
- Announcement future scheduling behavior

## 12.3 End-to-end tests

- Create Draft for each task type
- Publish and verify execution starts only after publish
- Pause and verify execution stops
- Resume and verify execution continues
- Scheduled announcement delivered at expected organization-local time

## 13. Implementation Checklist

## 13.1 Database and domain

- Add AutomationTasks and AutomationDispatches
- Add Organisation TimeZoneId
- Add migrations and indexes

## 13.2 Backend

- Add automation services and controllers
- Add event hook integration
- Add background worker
- Add recipient preview endpoint

## 13.3 Frontend

- Add Automation route and menu
- Build automation list page
- Build three create and edit modals
- Add Draft and Publish actions
- Add announcement date and time picker in organization timezone

## 13.4 Operations and observability

- Add structured logs
- Add dashboard style summaries for failures and sends
- Add retry tooling for failed dispatches

## 14. Acceptance Criteria

- OrgAdmin can create all three automation task types as Draft
- No Draft task sends any email
- Publish enables execution for task type logic
- Pause stops new dispatch execution
- Reminder supports NotCompleted state
- Announcement supports scheduling by date and time
- Announcement audience supports all users or users in selected learning pathways (multi-select), scoped to admin organization
- All schedule behavior uses organization business timezone
- All queries and actions are organization scoped and secure

## 15. Suggested Delivery Sequence

1. Foundation: schema, services, state machine, list page shell
2. Notification and Reminder end-to-end with scheduler
3. Announcement with audience targeting and scheduled send
4. Hardening: retries, monitoring, test coverage, documentation
