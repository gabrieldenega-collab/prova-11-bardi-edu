# Overview

EduConnect is a full-stack educational platform that connects students and teachers through structured study groups, mentorships, and collaborative learning materials. The platform enables users to create and join study groups, schedule mentoring sessions, share educational materials, and communicate through group messaging. It serves as a comprehensive learning management system designed to facilitate peer-to-peer learning and mentor-student relationships in educational environments.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses a hybrid frontend approach with two distinct client implementations:

**React/TypeScript Client**: Modern SPA built with React, TypeScript, and Vite, featuring:
- Component-based architecture using shadcn/ui design system
- TanStack React Query for server state management
- Wouter for lightweight client-side routing
- Context-based authentication management
- Form handling with React Hook Form and Zod validation

**Vanilla JavaScript Client**: Static web application using pure JavaScript modules:
- Module-based architecture with separate files for API, auth, UI, and routing
- Custom SPA router implementation with programmatic navigation
- Client-side templating and DOM manipulation
- Local storage for session management

Both clients share a common API interface and authentication flow, providing flexibility for different deployment scenarios.

## Backend Architecture
**Node.js/Express Server**: RESTful API server with clean separation of concerns:
- Controller-Service-Storage layered architecture
- JWT-based authentication with middleware protection
- Zod schema validation for request/response data
- Express middleware for CORS, security headers, rate limiting, and logging
- Custom error handling with structured JSON responses

**Database Layer**: SQLite database using better-sqlite3 with foreign key constraints enabled:
- User management with role-based access (student/teacher)
- Group-based organization with unique join codes
- Mentorship scheduling with future date validation
- Material sharing and group messaging
- Automated database seeding for development

## Authentication and Authorization
**JWT Authentication**: Token-based authentication system:
- 2-hour token expiration with automatic validation
- Role-based access control (student/teacher roles)
- Protected route middleware for API endpoints
- Client-side token storage and automatic header injection

**Authorization Patterns**:
- Group membership validation for all group-related operations
- Creator/owner permissions for mentorship and group management
- Cross-role functionality with appropriate access controls

## Data Storage Design
**Relational Database Schema**:
- Users table with role differentiation and password hashing
- Groups with unique codes and ownership relationships
- Group membership junction table with role assignments
- Mentorships linked to groups with creator tracking
- Materials and messages associated with groups and users
- Foreign key constraints ensuring data integrity

## API Design Patterns
**RESTful Endpoints**: Consistent API design with /api prefix:
- Resource-based URLs with standard HTTP methods
- Query parameter filtering for list endpoints
- Structured JSON responses with success/error patterns
- Pagination support for message history
- Health check endpoint for monitoring

# External Dependencies

## Database Dependencies
**SQLite with better-sqlite3**: Embedded database solution requiring no external database server setup, using local file storage at `./data/educonnect.db`

## Authentication Dependencies
**bcrypt**: Password hashing for secure user credential storage
**jsonwebtoken**: JWT token generation and verification for stateless authentication

## Frontend UI Dependencies
**shadcn/ui Component Library**: Pre-built React components using Radix UI primitives for accessible UI elements including modals, forms, buttons, and navigation components

**Tailwind CSS**: Utility-first CSS framework for responsive design and consistent styling across both client implementations

## Development and Build Tools
**Vite**: Frontend build tool and development server with hot module replacement
**TypeScript**: Type safety for the React client and shared schemas
**Drizzle ORM**: Database schema management and migrations (configured but not actively used in current implementation)

## Security and Middleware
**helmet**: HTTP security headers middleware
**cors**: Cross-origin resource sharing configuration
**express-rate-limit**: API rate limiting for abuse prevention
**morgan**: HTTP request logging for development and monitoring

## Validation and Data Processing
**Zod**: Runtime type validation for API requests and responses, ensuring data integrity across client-server communication