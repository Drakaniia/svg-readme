# svg-readme

A full-stack web application for generating animated SVG banners for your GitHub profile README. This project provides a visual editor to design your banner, along with a backend to generate the final SVG — complete with hand-injected CSS animations for effects like drifting grid backgrounds, morphing wave paths, and staggered fade-ins.

<p align="center">
  <img src="https://raw.githubusercontent.com/Wenoxxxx/svg-readme/main/output/banner.svg" width="100%" alt="Banner preview" />
</p>

![banner](./banner.svg)

## Overview

GitHub strips `<script>` tags from anything rendered inline in a README, but an SVG referenced as an external image (`<img src="...">`) is served as a static asset and renders fully in the browser — CSS `@keyframes`, gradients, and all.

`svg-readme` has evolved from a CLI script into a comprehensive web-based platform:
- **`app/`**: A React + Vite frontend (using Tailwind CSS v4) providing a rich, interactive canvas to visually design your banner.
- **`backend/`**: An Express server designed to handle the generation of the customized SVGs.

## Tech Stack

| Layer | Tool |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS v4, React Router |
| **Backend** | Express, Mongoose |
| **Database** | MongoDB (MongoDB Atlas) |
| **Language** | TypeScript / JavaScript |

### Backend & Database Architecture

**Backend Framework:**
- **Express.js** (v5.2.1) — Fast, minimalist web framework for Node.js
- **Node.js** — JavaScript runtime environment

**Database:**
- **MongoDB** — NoSQL document database for flexible, schema-less data storage
- **Mongoose** (v9.9.2) — Object Data Modeling (ODM) library providing schema validation, middleware, and query building

**Authentication & Security:**
- **JWT (jsonwebtoken)** (v9.0.3) — Stateless authentication via JSON Web Tokens
- **bcryptjs** (v3.0.3) — Password hashing with salt rounds for secure credential storage
- **CORS** (v2.8.6) — Cross-Origin Resource Sharing middleware for secure API access

**Environment & Config:**
- **dotenv** (v17.4.2) — Environment variable management from `.env` files

**Development & Testing:**
- **nodemon** (v3.1.14) — Auto-restart development server on file changes
- **supertest** (v7.2.2) — HTTP assertion library for API endpoint testing

**API Routes & Models:**
- `authRoutes.js` — User login, signup, token refresh
- `projectRoutes.js` — CRUD operations for banner projects
- `layerRoutes.js` — Layer hierarchy and ordering
- `elementRoutes.js` — SVG element (shapes, text, images) management
- Data models: **User**, **Project**, **Layer**, **Element**

## Project Structure

```text
svg-readme/
├── .github/             # GitHub Actions & Templates
├── app/                 # React frontend (Editor & Landing pages)
│   ├── public/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── layouts/     # Page layouts
│   │   ├── pages/       # Route pages (Home, Editor, etc.)
│   │   └── App.tsx      # Main application routing
│   └── package.json     # Frontend dependencies
├── backend/             # Express + Mongoose backend (SVG/page persistence engine)
│   └── package.json     # Backend dependencies
└── README.md
```

## Roadmap

- [x] Initial CLI for SVG generation
- [x] React + Vite frontend editor UI
- [ ] Property functions per tool
- [ ] Backend Express API for dynamic SVG rendering
- [ ] More templates, fonts, and customizable themes
- [ ] Export to PNG/JPEG format
- [ ] User authentication and saved banners

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Wenoxxxxxx/svg-readme.git
cd svg-readme
```

### 2. Run the Frontend

Navigate to the `app` directory to launch the web editor:

```bash
cd app
npm install
npm run dev
```

### 3. Run the Backend

First, create a MongoDB database and get its connection URI:
- Local: run `mongod`, then use `mongodb://localhost:27017/svg_readme`.
- Recommend MongoDB Atlas (free tier) for development/deployment: create a cluster and copy the driver URI.

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`.

Then, start the development server:

```bash
cd backend
npm install
npm run dev         # Starts the nodemon development server on http://localhost:3001
```

## Customization & Usage

1. Open the **Editor** in the web app to visually adjust the dimensions, content, and styling of your profile banner.
2. The UI communicates with the backend to generate a real, animated SVG file.
3. Reference the raw SVG file from your `<username>/<username>` profile repository:

```md
<img src="https://raw.githubusercontent.com/Wenoxxxx/svg-readme/main/output/banner.svg" width="100%" alt="Owen Jerusalem banner" />
```

## License

MIT

## Author

**Owen Jerusalem** — [portfolio](https://owen-jerusalem.vercel.app) · [GitHub](https://github.com/Wenoxxxx)
