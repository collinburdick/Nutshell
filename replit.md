# Nutshell

## Overview

Nutshell is a real-time conference intelligence platform built as a React Native mobile app with an Express backend. It captures breakout sessions and roundtables at conferences, transcribes discussions, de-identifies speakers for privacy, and delivers instant thematic summaries to organizers and attendees.

The core workflow is:
1. **Admins** create events and sessions with multiple tables
2. **Facilitators** join tables via a 6-character code on their mobile device
3. **Audio** is recorded and transcribed in real-time using OpenAI
4. **AI** generates rolling summaries, themes, and action items
5. **Admins** monitor all tables live and can send nudges to facilitators

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native / Expo)

- **Framework**: Expo SDK 54 with React Native 0.81, targeting iOS, Android, and web
- **Navigation**: React Navigation with native stack navigator
- **State Management**: TanStack Query for server state with custom query client
- **Styling**: Custom theming system with light/dark mode support using a warm amber color palette
- **Audio**: expo-av (Audio.Recording) for native recording, MediaRecorder API for web, with 10-second transcription intervals for near real-time feedback
- **Key Screens**:
  - `JoinScreen`: 6-character code entry for facilitators
  - `SessionScreen`: Live recording with mic levels, timer, nudge banners
  - `WrapUpScreen`: Review and approve AI-generated insights
  - `SessionSummaryScreen`: Comprehensive session insights with Present/Explore modes
  - `EventSummaryScreen`: Aggregated event insights across all sessions
  - Admin screens: Dashboard, Event/Session management, Live Monitoring

### Summary Screens Feature Set
The summary screens (Session and Event) provide comprehensive AI-generated insights:
- **Themes with Frequency**: Discussion themes ordered by prevalence (High/Medium/Low badges)
- **Key Questions**: Important unanswered questions from discussions
- **Key Insights**: Major takeaways and learnings
- **AI Summary**: Executive summary of session/event outcomes
- **Detailed Themes**: In-depth theme analysis with descriptions and key points
- **Notable Quotes**: Interesting or impactful statements (privacy-protected)
- **AI Analysis**: Deeper insights with analysis and recommendations

**Display Modes:**
- **Present Mode**: Large text optimized for projectors with dark/light toggle
- **Explore Mode**: Interactive drill-down with collapsible sections, search, and copy functionality

### Backend (Express + Node.js)

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI via Replit AI Integrations for transcription, summarization, and text-to-speech
- **Authentication**: Simple token-based auth for facilitators (auto-generated), password-based for admins
- **API Design**: RESTful endpoints under `/api/` prefix

### Data Model

The schema follows a hierarchical structure:
- **Events** → contain multiple **Sessions** → contain multiple **Tables**
- **Tables** have **Facilitators** (temporary session-based identities with tokens)
- **Transcripts** store raw audio transcriptions per table
- **Summaries** store AI-generated insights (themes, action items, takeaways)
- **Nudges** are admin-to-facilitator messages

### Key Design Decisions

1. **De-identified speakers**: No speaker identity is stored; participants are anonymized by design
2. **Session-based tokens**: Facilitators get temporary tokens valid only for their session
3. **Real-time polling**: Live monitoring uses 5-second refresh intervals for table status
4. **Offline-first audio**: Recording continues even if network degrades; transcripts queue for upload
5. **Join codes**: 6-character uppercase hex codes for easy table joining

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations): Powers transcription (speech-to-text), summarization, and optional voice responses
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Primary data store, configured via `DATABASE_URL`
- **Drizzle ORM**: Type-safe database queries with schema in `shared/schema.ts`

### Audio Processing
- **ffmpeg**: Server-side WebM to WAV conversion for transcription API compatibility

### Mobile/Web Platform
- **Expo**: Build and development toolchain
- **expo-audio/expo-av**: Native audio recording
- **expo-haptics**: Tactile feedback for interactions

### Storage & State
- **AsyncStorage**: Local storage for admin tokens on mobile
- **TanStack Query**: Caching and synchronization of server state