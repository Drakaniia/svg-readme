# Documentation

Welcome to the svg-readme documentation hub.

## Table of Contents

- [Getting Started](../README.md) — Project setup and installation
- [App Documentation](./app/) — Feature documentation for the editor application
  - [Feature Index](./app/index.md) — Overview of all implemented features
  - [Text Tool](./app/text-tool.md) — Text creation and editing
  - [Move Tool](./app/move-tool.md) — Layer selection and manipulation
  - [Multi-Select](./app/multi-select.md) — Shift+click multi-selection
  - [Testing](./app/testing.md) — Test infrastructure and coverage
- [Backend & Database](#backend--database) — Backend architecture and technologies

## Backend & Database

### Technologies

**Backend Framework:**
- **Express.js** (v5.2.1) — Fast, minimalist web application framework for Node.js
- **Node.js** — JavaScript runtime environment

**Database:**
- **MongoDB** — NoSQL document database
- **Mongoose** (v9.9.2) — Object modeling for MongoDB, providing schema validation and middleware support

**Authentication & Security:**
- **JWT (jsonwebtoken)** (v9.0.3) — JSON Web Token authentication for secure API endpoints
- **bcryptjs** (v3.0.3) — Password hashing and salting for secure credential storage
- **CORS** (v2.8.6) — Cross-Origin Resource Sharing middleware for secure cross-domain requests

**Environment Configuration:**
- **dotenv** (v17.4.2) — Environment variable management for configuration

**Development Tools:**
- **nodemon** (v3.1.14) — Automatic server restart during development
- **supertest** (v7.2.2) — HTTP assertion library for API testing

### Project Structure

**Backend API Routes:**
- Authentication endpoints (`authRoutes.js`)
- Project management (`projectRoutes.js`)
- Layer management (`layerRoutes.js`)
- Element manipulation (`elementRoutes.js`)

**Data Models:**
- User — User account and profile information
- Project — SVG project metadata and structure
- Layer — Layer organization within projects
- Element — Individual SVG elements (shapes, text, images, etc.)

## Project Structure

```
docs/
├── README.md          # This file
└── app/
    ├── README.md       # App-specific setup (Vite, React, Tailwind)
    ├── index.md        # Feature documentation index
    ├── move-tool.md    # Move Tool documentation
    ├── multi-select.md # Multi-select feature documentation
    ├── testing.md      # Testing guide
    └── text-tool.md    # Text Tool documentation
```
