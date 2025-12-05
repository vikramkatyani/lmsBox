# Learner AI Assistant Feature

## Overview

The Learner AI Assistant is an intelligent chatbot feature that helps learners get answers to questions about their course content and lessons. It uses OpenAI's GPT-4o model to provide context-aware responses in British English.

## Features

- **Course-Specific Responses**: AI only answers questions based on actual course and lesson content
- **Content-Aware**: Receives the current lesson's content to provide accurate, contextual answers
- **Strict Scope Enforcement**: Refuses to answer questions outside the course material
- **Conversational Interface**: Chat-based UI with message history
- **Educational Focus**: Designed to guide learning, not provide direct quiz answers
- **British English**: All responses use British English spelling and terminology
- **Suggested Questions**: Quick-start prompts to help learners get started
- **Mobile Responsive**: Works seamlessly on all device sizes

## User Experience

### Accessing the AI Assistant

1. Navigate to any course from the learner's course list
2. Look for the **"Ask AI"** button in the description section at the bottom of the page
3. Click the button to open the AI Assistant modal

### Using the AI Assistant

The AI Assistant can help with:
- Explaining concepts covered in the current lesson
- Providing additional examples related to lesson content
- Summarising key takeaways from the material
- Clarifying course-specific terminology and topics
- Offering study tips for the specific course material

**IMPORTANT**: The AI is restricted to answering questions **only about the specific course and lesson content**. It will:
- ✅ Answer questions directly related to the course material
- ✅ Explain concepts taught in the lessons
- ✅ Provide examples based on course content
- ❌ Refuse to answer general knowledge questions unrelated to the course
- ❌ Not provide information outside the course scope
- ❌ Redirect learners if questions are off-topic

### What the AI Won't Do

- Provide direct answers to quiz or assessment questions
- Complete assignments on behalf of learners
- Override course policies or requirements

Instead, the AI guides learners to understand concepts so they can answer questions themselves.

## Technical Implementation

### Backend Components

#### 1. Service Layer
- **Interface**: `IAIAssistantService.cs`
  - New method: `LearnerCourseQueryAsync()`
- **Implementation**: `AIAssistantService.cs`
  - Specialized prompt engineering for learner support
  - Context-aware responses based on course and lesson

#### 2. API Endpoint
- **Controller**: `AIAssistantController.cs`
- **Endpoint**: `POST /api/aiassistant/learner-query`
- **Authorization**: `[Authorize(Roles = "Learner,OrgAdmin,SuperAdmin")]`
- **Request Model**:
  ```csharp
  public class LearnerQueryRequest
  {
      public string Question { get; set; }
      public string CourseTitle { get; set; }
      public string? LessonTitle { get; set; }
      public string? AdditionalContext { get; set; }
  }
  ```

### Frontend Components

#### 1. Service
- **File**: `src/services/learnerAI.js`
- **Method**: `askQuestion(question, courseTitle, lessonTitle, additionalContext)`

#### 2. React Component
- **File**: `src/components/LearnerAIAssistant.jsx`
- **Features**:
  - Chat interface with message history
  - Suggested questions for quick start
  - Loading states and error handling
  - Clear conversation option
  - Auto-scroll to latest message

#### 3. Integration
- **File**: `src/pages/CourseContent.jsx`
- **Location**: Description section (bottom panel)
- **Trigger**: "Ask AI" button with light bulb icon

## AI Prompt Engineering

The AI uses a carefully crafted system prompt that ensures:

1. **Educational Approach**: Focus on understanding concepts, not providing answers
2. **British English**: Consistent use of UK spelling (e.g., "organise", "colour", "learnt")
3. **Encouraging Tone**: Patient, supportive, and positive
4. **Clear Communication**: Breaking down complex topics into digestible parts
5. **No Cheating**: Refuses to provide direct quiz/assessment answers

### Context Provided to AI

For each query, the AI receives:
- Course title
- Current lesson title (if applicable)
- Learner's specific question
- Any additional context (optional)

## Configuration

### Prerequisites

1. **OpenAI API Key**: Must be configured in `appsettings.json`
   ```json
   {
     "OpenAI": {
       "ApiKey": "your-api-key-here"
     }
   }
   ```

2. **Model**: Currently uses `gpt-4o` (configurable in `AIAssistantService.cs`)

### Error Handling

- **503 Service Unavailable**: Returned when OpenAI API key is not configured
- **500 Internal Server Error**: Returned for other failures (logged for debugging)
- **Frontend**: User-friendly toast notifications for all error scenarios

## Usage Examples

### Example 1: Concept Clarification
**Learner**: "Can you explain this concept in simpler terms?"
**AI**: Provides a simplified explanation of the current lesson content

### Example 2: Additional Examples
**Learner**: "Can you provide an example to help me understand this better?"
**AI**: Offers practical examples related to the course topic

### Example 3: Study Tips
**Learner**: "What should I focus on to master this topic?"
**AI**: Suggests key areas to study and effective learning strategies

### Example 4: Quiz Guidance (No Direct Answers)
**Learner**: "What's the answer to question 5?"
**AI**: "I can't provide direct answers to quiz questions, but I can help you understand the concepts. What specific part of the topic are you struggling with?"

## Future Enhancements

Potential improvements for future releases:

1. **Lesson Content Integration**: Include actual lesson content in the context for more accurate responses
2. **Conversation History Persistence**: Save chat history across sessions
3. **Feedback System**: Allow learners to rate AI responses
4. **Usage Analytics**: Track which topics learners ask about most
5. **Multi-Language Support**: Extend beyond British English
6. **Voice Input**: Speech-to-text for questions
7. **Suggested Follow-ups**: AI-generated follow-up questions to deepen understanding

## Security & Privacy

- **Authorization**: Only authenticated learners can access the feature
- **Rate Limiting**: Consider implementing to prevent abuse (future enhancement)
- **Data Privacy**: User queries are sent to OpenAI; ensure compliance with data policies
- **Audit Logging**: Consider logging AI interactions for compliance (future enhancement)

## Troubleshooting

### AI Assistant Button Not Visible
- Ensure you're on the CourseContent page (not the course list)
- Check that the course has loaded successfully
- Verify the Description section is visible

### "AI Assistant is currently unavailable" Error
- OpenAI API key is not configured
- Check `appsettings.json` or environment variables
- Verify the API key is valid and has credits

### Slow Responses
- OpenAI API latency (typically 2-5 seconds)
- Network connectivity issues
- Consider showing loading animation (already implemented)

## Cost Considerations

- **Model**: GPT-4o is more expensive than GPT-3.5 but provides better educational responses
- **Token Usage**: Each conversation consumes tokens based on:
  - System prompt (~200 tokens)
  - Conversation history
  - User question
  - AI response
- **Recommendations**:
  - Monitor OpenAI usage dashboard
  - Set spending limits on OpenAI account
  - Consider implementing per-user query limits

## Testing

### Manual Testing Steps

1. Configure OpenAI API key
2. Navigate to a course as a learner
3. Click "Ask AI" button
4. Try suggested questions
5. Type custom questions
6. Verify British English responses
7. Test error handling (invalid API key)
8. Test on mobile devices

### Key Test Scenarios

- ✅ AI provides helpful, educational responses
- ✅ Responses use British English
- ✅ AI refuses to answer quiz questions directly
- ✅ Chat history displays correctly
- ✅ Clear conversation works
- ✅ Error handling for API failures
- ✅ Mobile responsive design
- ✅ Multiple conversations in same session

## Support

For issues or questions about the Learner AI Assistant:

1. Check this documentation
2. Verify OpenAI API configuration
3. Check browser console for errors
4. Review backend logs for API failures
5. Contact development team if issues persist
