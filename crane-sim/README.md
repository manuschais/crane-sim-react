# Crane Simulation App

Interactive crane behavior simulator built with React + Vite.

This app visualizes long-travel skew behavior with configurable:
- Load (ton)
- Trolley position
- Tie-back status
- Soft/Hard acceleration mode

## Tech Stack
- React 19
- Vite 7
- ESLint 9

## Project Structure
- `src/CraneLongTravelSimGEM.jsx`: Main simulation screen used by `App`
- `src/CraneLongTravelSim.jsx`: Alternate simulation variant
- `src/App.jsx`: App entry component
- `src/main.jsx`: React bootstrap
- `index.html`: SEO/meta shell page

## Local Development
Prerequisites:
- Node.js `20.19+` or `22.12+` (required by Vite 7)

Install and run:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

Lint:

```bash
npm run lint
```

## Deploy to GitHub Pages
This repository includes a GitHub Actions workflow at:
- `.github/workflows/deploy-pages.yml`

After pushing to `main`, deployment is automatic.

Repository settings required:
1. Go to `Settings > Pages`.
2. Under **Build and deployment**, set **Source** to `GitHub Actions`.

Vite is configured with `base: "./"` in `vite.config.js`, which works for static hosting and project-page deployments.

## Create a New GitHub Repo and Push
Run in `crane-sim/`:

```bash
git init
git add .
git commit -m "Initial crane simulation app"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Notes
- The simulation is intended as a visual/educational model, not a certified engineering calculation tool.
- Some source text currently shows encoding artifacts and can be cleaned up in a follow-up pass.