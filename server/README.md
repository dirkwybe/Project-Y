Fasting Lane API (Photo Calories)

Overview
- Accepts a food photo upload.
- Uses OpenAI vision to identify foods and estimate grams.
- Looks up calories via USDA FoodData Central.
- Returns a base64 thumbnail for local storage on device.

Endpoints
- GET /health
- POST /v1/food/analyze
- POST /v1/plan/recommend

Request (POST /v1/food/analyze)
- Multipart form data
  - image: file
- Header (optional): X-API-KEY

Response
- thumbnailBase64
- items[]: name, portion, grams, confidence, calories, sourceName
- totalCalories
- disclaimer

Request (POST /v1/plan/recommend)
- JSON
  - goalMode
  - targetPace
  - startProtocol
  - minEatingHours
  - rampWeeks
  - dailyCalorieGoal

Response
- targetProtocol
- weeks[]: weekIndex, protocolKey, dailyCalories, notes
- rationale

Environment variables
- OPENAI_API_KEY
- USDAFOOD_KEY
- USDAFOOD_USER (optional)
- APP_API_KEY (optional, for X-API-KEY auth)

Run locally
1) Install deps:
   npm install
2) Start:
   npm start

Deploy to Railway
- Create a new Railway project from this folder.
- Set the environment variables above.
- Ensure PORT is set automatically by Railway.

Notes
- Full images are not stored on the server.
- Thumbnails are returned as base64 for local device storage.
