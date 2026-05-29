# University CMS Project

This is a University Content Management System (CMS) designed for managing institutional websites, organizational structures, content publishing, media assets, SEO metadata, workflows, and more. 

The application is structured into two main parts:
- **Backend**: Fastify server with a PostgreSQL database (using Knex).
- **Frontend**: Angular application.

## Prerequisites

Make sure you have the following installed on your machine:
- Node.js (>= 22.0.0)
- npm (v11+)
- PostgreSQL
- Angular CLI (optional, but recommended)

---

## 1. Backend Setup

The backend handles the REST API, database connections, and authentication.

### Installation
Navigate to the `backend` directory and install the dependencies:
```bash
cd backend
npm install
```

### Environment Configuration
1. Copy the `.env.local.example` to `.env`:
   ```bash
   cp .env.local.example .env
   ```
2. Update the `.env` file with your actual Google OAuth credentials and a valid PostgreSQL connection string:
   ```env
   NODE_ENV=local
   HOST=127.0.0.1
   PORT=4000
   LOG_LEVEL=debug
   DATABASE_URL=postgresql://cms_user:cms_password@localhost:5432/university_cms_local
   GOOGLE_CLIENT_ID=replace-with-google-client-id
   GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/admin/auth/google/callback
   SESSION_SECRET=replace-with-a-strong-local-secret
   SUPER_ADMIN_EMAIL=your-email@example.com
   SUPER_ADMIN_NAME=Super Admin
   ```

### Database Setup
1. Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` is created.
2. Run the database migrations to set up the schema:
   ```bash
   npm run db:migrate
   ```
3. To seed the database with a super-admin user, run:
   ```bash
   npm run seed:super-admin
   ```

### Running the Backend
Start the development server (runs with hot-reloading using `tsx`):
```bash
npm run dev
```
The server will start at `http://127.0.0.1:4000`.

---

## 2. Frontend Setup

The frontend is an Angular application that proxies API requests to the backend server.

### Installation
Navigate to the `frontend` directory and install the dependencies:
```bash
cd frontend
npm install
```

### Running the Frontend
Start the Angular development server:
```bash
npm start
```
By default, this runs `ng serve --proxy-config proxy.conf.json`, ensuring API calls are routed correctly to the Fastify backend. The app will be available at `http://localhost:4200` (or whatever port Angular assigns).

---

## Architecture Overview

- **Backend Architecture**: REST API utilizing Fastify, integrated with Knex for database queries and migrations. It leverages Google OAuth-only login for authentication. RBAC (Role-Based Access Control) is implemented centrally with an organization scope.
- **Frontend Architecture**: Angular v21 with robust service structure to communicate with backend APIs.

For a detailed technical architecture, roadmap, and database models, please refer to the `project_plan.md` in the root directory.

## Testing

**Backend Tests:**
```bash
cd backend
npm test
```

**Frontend Tests:**
```bash
cd frontend
npm test
```
