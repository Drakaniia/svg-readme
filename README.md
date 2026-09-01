# svg-readme

A full-stack web app for generating animated SVG banners for your GitHub profile README. Provides a visual editor to design your banner, with a backend to generate the final SVG — hand-injected CSS animations, gradients, morphing paths, and all.

<p align="center">
  <img src="https://raw.githubusercontent.com/Wenoxxxx/svg-readme/main/output/banner.svg" width="100%" alt="Banner preview" />
</p>

![banner](./banner.svg)

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React, Vite, Tailwind CSS v4, React Router |
| Backend | Express, Mongoose, MongoDB |
| Auth | JWT, bcryptjs |

## Project Structure

```
svg-readme/
├── app/               # React frontend — canvas editor & pages
│   └── src/
├── backend/           # Express API — SVG generation & persistence
│   └── src/
│       ├── controllers/
│       ├── models/
│       └── routes/
└── package.json       # Root scripts (runs both frontend + backend)
```

## Getting Started

### Prerequisites

- Node.js
- MongoDB (local `mongod` or MongoDB Atlas)

### Setup

```bash
git clone https://github.com/Wenoxxxxxx/svg-readme.git
cd svg-readme
```

Create a `.env` file in `backend/` with your MongoDB URI:

```bash
cp backend/.env.example backend/.env
```

### Development

Run both frontend and backend in one command:

```bash
npm run dev
```

Or run them individually:

```bash
npm run dev:app      # Frontend (Vite on localhost:5173)
npm run dev:backend  # Backend (Express on localhost:3001)
```

## Usage

1. Open the **Editor** in the web app to visually design your banner
2. The app generates a real animated SVG
3. Reference it in your profile README:

```md
<img src="https://raw.githubusercontent.com/yourname/yourname/main/output/banner.svg" width="100%" />
```

## Roadmap

- [ ] Property functions per tool
- [ ] More templates, fonts, and themes
- [ ] Export to PNG/JPEG
- [ ] User authentication and saved banners

## License

MIT

## Author

**Owen Jerusalem** — [portfolio](https://owen-jerusalem.vercel.app) · [GitHub](https://github.com/Wenoxxxx)
