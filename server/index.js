const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const requireApiKey = (req, res, next) => {
  const expected = process.env.APP_API_KEY;
  if (!expected) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

const extractJson = (text) => {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
};

const fetchUSDA = async (query) => {
  const key = process.env.USDAFOOD_KEY;
  if (!key) throw new Error('Missing USDAFOOD_KEY');
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
    key
  )}&query=${encodeURIComponent(query)}&pageSize=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USDA lookup failed (${response.status})`);
  }
  const data = await response.json();
  const food = data?.foods?.[0];
  if (!food) return null;
  const nutrient = (food.foodNutrients || []).find(
    (item) => item.nutrientId === 1008
  );
  const kcal = nutrient?.value ?? null;
  return {
    name: food.description,
    kcalPer100g: kcal,
  };
};

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.post('/v1/food/analyze', requireApiKey, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const sourceBuffer = req.file.buffer;
    const analysisBuffer = await sharp(sourceBuffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbBuffer = await sharp(sourceBuffer)
      .resize({ width: 256, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const imageBase64 = analysisBuffer.toString('base64');
    const thumbBase64 = thumbBuffer.toString('base64');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a nutrition assistant. Identify foods and estimate portion size in grams. Return only JSON with an array named items. Each item: {"name": string, "portion": string, "grams": number, "confidence": number}.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this meal photo.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      return res.status(502).json({ error: 'OpenAI error', detail });
    }

    const completion = await openaiResponse.json();
    const content = completion?.choices?.[0]?.message?.content;
    const parsed = extractJson(content) || { items: [] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    const enriched = [];
    for (const item of items) {
      const name = item.name || 'Unknown item';
      const grams = Number(item.grams) || null;
      let calories = null;
      let usdaName = null;
      const usda = await fetchUSDA(name);
      if (usda && usda.kcalPer100g) {
        usdaName = usda.name;
        calories = grams ? Math.round((usda.kcalPer100g * grams) / 100) : Math.round(usda.kcalPer100g);
      }
      enriched.push({
        name,
        portion: item.portion || null,
        grams,
        confidence: item.confidence ?? null,
        calories,
        sourceName: usdaName,
      });
    }

    const totalCalories = enriched.reduce(
      (sum, item) => sum + (item.calories ?? 0),
      0
    );

    return res.json({
      thumbnailBase64: thumbBase64,
      items: enriched,
      totalCalories,
      disclaimer: 'Estimates only. Please review portions before saving.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', detail: String(error) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Fasting Lane API listening on ${port}`);
});
