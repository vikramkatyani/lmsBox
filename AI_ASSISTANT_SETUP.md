# AI Assistant Configuration Guide

## Overview
The AI Assistant feature provides AI-powered content generation for organization admins to help create courses, lessons, and quizzes using OpenAI's GPT-4o model.

## Prerequisites
- OpenAI API account
- OpenAI API key

## Setup Instructions

### 1. Get OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (you won't be able to see it again)

### 2. Configure Application

Add your OpenAI API key to the configuration file:

**File:** `lmsBox.Server/appsettings.json`

```json
{
  "OpenAI": {
    "ApiKey": "your-openai-api-key-here"
  }
}
```

**For production/Azure deployment:**

Add the API key as an environment variable or App Setting:
- Key: `OpenAI__ApiKey`
- Value: Your OpenAI API key

### 3. Verify Installation

The AI Assistant requires the following NuGet package (already added):
- `OpenAI` version 2.1.0

## Features

The AI Assistant provides 5 main capabilities:

### 1. Course Outline Generation
- Generates comprehensive course structure
- Includes lessons with titles, descriptions, and durations
- Customizable by level (Beginner/Intermediate/Advanced) and duration

### 2. Lesson Content Generation
- Creates detailed lesson content in HTML format
- Includes introduction, main concepts, key takeaways, and activities
- Context-aware based on course information

### 3. Quiz Question Generation
- Generates multiple-choice questions with explanations
- Configurable number of questions (1-20)
- Difficulty levels: Easy, Medium, Hard
- Returns JSON format ready for import

### 4. Content Improvement
- Grammar and spelling correction
- Clarity and readability enhancement
- Engagement improvement
- Content simplification

### 5. AI Chat Assistant
- Interactive chat for course creation guidance
- Provides pedagogical advice
- Answers questions about course design

## Usage

### For Organization Admins

The AI Assistant appears as a floating purple button in the bottom-right corner when:
- Creating or editing a course (`/admin/courses/add` or `/admin/courses/:id/edit`)
- Creating or editing a quiz (`/admin/quizzes/add` or `/admin/quizzes/:id/edit`)

### UI Overview

The AI Assistant modal has 4 tabs:

1. **Chat** - Ask questions and get instant help
2. **Course Outline** - Generate course structure
3. **Lesson Content** - Create lesson materials
4. **Quiz Questions** - Generate quiz questions

### Applying AI-Generated Content

- **Course Outline**: Copy JSON and manually structure your course
- **Lesson Content**: Click "Apply" to insert HTML content
- **Quiz Questions**: Click "Apply" to automatically import questions
- **Chat**: Use responses to guide your content creation

## API Endpoints

All endpoints require authentication with `OrgAdmin` or `SuperAdmin` role:

```
POST /api/aiassistant/generate-course-outline
POST /api/aiassistant/generate-lesson-content
POST /api/aiassistant/generate-quiz-questions
POST /api/aiassistant/improve-content
POST /api/aiassistant/chat
```

## Cost Considerations

- OpenAI API usage is **not free** - you'll be charged based on token usage
- GPT-4o pricing (as of Nov 2024):
  - Input: $2.50 per 1M tokens
  - Output: $10.00 per 1M tokens
- Typical costs per generation:
  - Course outline: ~$0.01-0.05
  - Lesson content: ~$0.02-0.10
  - Quiz questions (5): ~$0.02-0.08
  - Chat message: ~$0.01-0.03

**Recommendation:** Set up usage limits in your OpenAI account to prevent unexpected charges.

## Troubleshooting

### AI Assistant button doesn't appear
- Check that you're logged in as OrgAdmin or SuperAdmin
- Ensure you're on the course editor or quiz creator page
- Clear browser cache

### "Failed to generate" errors
- Verify OpenAI API key is configured correctly
- Check API key has sufficient credits
- Review server logs for detailed error messages
- Ensure internet connectivity for API calls

### Generated content not applying
- Check browser console for errors
- Ensure content format matches expected structure
- For quiz questions, verify JSON format is valid

## Security Notes

- API key is stored server-side only (never exposed to frontend)
- All AI requests are logged for audit purposes
- Only authenticated OrgAdmin/SuperAdmin users can access AI features
- Generated content should be reviewed before publishing

## Backend Implementation

### Files Created/Modified

**Backend:**
- `lmsBox.Server/Services/IAIAssistantService.cs` - Service interface
- `lmsBox.Server/Services/AIAssistantService.cs` - OpenAI integration
- `lmsBox.Server/Controllers/AIAssistantController.cs` - API endpoints
- `lmsBox.Server/Program.cs` - Service registration
- `lmsBox.Server/appsettings.json` - Configuration
- `lmsBox.Server.csproj` - OpenAI package reference

**Frontend:**
- `lmsbox.client/src/services/aiAssistant.js` - API client
- `lmsbox.client/src/components/AIAssistant.jsx` - UI component
- `lmsbox.client/src/pages/AdminCourseEditor.jsx` - Integration
- `lmsbox.client/src/pages/QuizCreator.jsx` - Integration

## Support

For issues or questions:
1. Check OpenAI API status: https://status.openai.com/
2. Review server logs in Application Insights or console
3. Verify configuration settings
4. Contact system administrator

---

**Note:** This feature requires an active OpenAI API key. Without it, the AI Assistant will not function.
