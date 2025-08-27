# Overview

COMPIA is a multi-tenant workplace safety inspection platform (Sistema Multi-Empresa IA SST) built with a full-stack TypeScript architecture. The system provides intelligent safety inspections, compliance management, and action plan tracking for organizations. It features a hierarchical organization structure supporting master organizations, enterprises, and subsidiaries, with role-based access control for different user types including system admins, org admins, managers, inspectors, and clients.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 19 with TypeScript and Vite for build tooling
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom COMPIA brand colors and design tokens
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation schemas

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Custom middleware-based authentication system
- **API Design**: RESTful API with role-based authorization middleware
- **File Structure**: Monorepo structure with shared schema definitions

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect for type-safe database queries
- **Schema**: Shared schema definitions in TypeScript with enum types for roles, statuses, and organization types
- **Multi-tenancy**: Hierarchical organization structure with parent-child relationships
- **Migrations**: Drizzle-kit for database schema migrations

## Authentication & Authorization
- **Multi-tier Permissions**: Role-based access control with system admin, org admin, manager, inspector, and client roles
- **Organization Hierarchy**: Access control based on organization membership and hierarchy
- **Session Management**: Custom authentication middleware with user context injection

## External Dependencies

- **UI Components**: Radix UI for accessible component primitives
- **Database**: Neon Database (PostgreSQL serverless) via @neondatabase/serverless
- **AI Integration**: OpenAI API for inspection analysis and compliance insights
- **Development Tools**: ESLint, TypeScript compiler, Vite dev server
- **Styling**: Tailwind CSS with PostCSS for processing
- **Validation**: Zod for runtime type validation and schema definition
- **Charts**: Recharts for data visualization and reporting
- **Document Generation**: QR code generation, PDF exports, and compliance reporting
- **Date Handling**: date-fns for date manipulation and formatting