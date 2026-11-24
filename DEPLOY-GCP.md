# Deploy the client to Google Cloud Run

Deploy the server first and note its URL. Do the one-time setup from `server/DEPLOY-GCP.md` (APIs + Artifact Registry repo).

From this folder:

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_API_URL=https://api-tester-server-386235460295.asia-south1.run.app
```

The command prints the client URL. Then redeploy the server with that URL as `_CLIENT_URL` so CORS allows it.
`_API_URL` is baked in at build time, so changing it means running the command again.
