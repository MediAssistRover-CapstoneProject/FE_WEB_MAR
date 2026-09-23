# MediAssistRover — Workflows

React + Vite + Tailwind implementation based on the supplied Figma node:

- File: `kTMJ509ankJyMsDdoW90iS`
- Node: `542:51310`
- Screen: MediAssistRover / Workflows
- Target design size: approximately 1440 × 1009

## Run

```bash
npm install
npm run dev
```

Then open the Vite URL shown in your terminal.

## Structure

```text
src/
├─ components/
│  ├─ AdminSidebar.jsx
│  └─ MarButton.jsx
├─ pages/
│  └─ WorkflowsPage.jsx
├─ App.jsx
├─ index.css
└─ main.jsx
```

## Notes

The original Figma-generated source relies heavily on absolute positioning.
This version keeps the visual measurements, colors, typography, border radii,
sidebar width, panel sizes, and workflow content while restructuring the page
into reusable React components and maintainable Tailwind layouts.
