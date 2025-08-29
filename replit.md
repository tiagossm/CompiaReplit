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

# Diagnóstico de rotas — instruções

1) Inicie o servidor e cole o output do terminal:
   - Comando: `npm run dev` (ou `npm start`)
   - Cole o log completo até aparecer que o servidor está a ouvir na porta.

2) Reproduza a rota defeituosa e cole:
   - Método (GET/POST/PUT/DELETE)
   - URL completa (ex.: http://localhost:5000/api/exemplo)
   - Headers relevantes (Content-Type, Authorization)
   - Body (JSON) se houver
   - Resposta do servidor (status code + body) e stack trace se existir

3) Execute chamadas verbosas (exemplos curl):
   - GET: `curl -v http://localhost:5000/api/exemplo`
   - POST: `curl -v -H "Content-Type: application/json" -d '{"foo":"bar"}' http://localhost:5000/api/exemplo`

4) Entregue estes ficheiros/trechos:
   - server/app entry (ex.: app.ts, index.ts, server.js)
   - Rotas (ex.: routes/*.ts ou controllers)
   - Middleware (bodyParser, cors, auth)
   - package.json (scripts) e .env / variáveis importantes (PORT, DATABASE_URL)

5) O que eu vou verificar:
   - Ordem do middleware (parsers antes de routes)
   - Uso correto de req.params / req.query / req.body
   - Handlers async sem try/catch (adicionar next(err) / tratamento)
   - Paths duplicados / trailing slash
   - Retornos consistentes: res.status(...).json(...)
   - Logs adicionais para reproduzir falha

Cole aqui os logs e os ficheiros mencionados e eu refaço a análise e envio patches agrupados por ficheiro.