# Halorai

Halorai is a flyer design app built with React, TypeScript, Vite, and Tailwind CSS. Its Flask API is in the [`backend`](./backend) directory.

## Run the frontend locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

The development server runs at `http://localhost:8080`. To run the API locally, follow the instructions in [`backend/README.md`](./backend/README.md).

## Checks

```sh
npm run build
npm test
npm run lint
```

## Deployment

The Flask API has a Render Blueprint in [`render.yaml`](./render.yaml). Configure the API keys and frontend origin in Render, then set `VITE_BACKEND_ORIGIN` for the frontend deployment to the API service URL.
