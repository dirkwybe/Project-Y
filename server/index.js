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

const getOpenAIKey = () => {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  return openaiKey;
};

const callOpenAI = async ({ messages, temperature = 0.2 }) => {
  const openaiKey = getOpenAIKey();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error: ${detail}`);
  }

  const completion = await response.json();
  return completion?.choices?.[0]?.message?.content ?? '';
};

const analyzeFoodsFromText = async (text) => {
  const content = await callOpenAI({
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are a nutrition assistant. Identify foods and estimate portion size in grams. Return only JSON with an array named items. Each item: {"name": string, "portion": string, "grams": number, "confidence": number}.',
      },
      {
        role: 'user',
        content: `Analyze this meal description: "${text}"`,
      },
    ],
  });

  const parsed = extractJson(content) || { items: [] };
  return Array.isArray(parsed.items) ? parsed.items : [];
};

const estimateCaloriesFallback = async (items) => {
  if (!items.length) return {};
  const content = await callOpenAI({
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You estimate calories for foods. Return only JSON with array items: [{"index": number, "calories": number|null}]. Use grams if provided, otherwise portion text.',
      },
      {
        role: 'user',
        content: `Estimate calories for: ${JSON.stringify(items)}`,
      },
    ],
  });

  const parsed = extractJson(content) || { items: [] };
  const results = Array.isArray(parsed.items) ? parsed.items : [];
  const mapped = {};
  results.forEach((item) => {
    const index = Number(item.index);
    const calories = Number(item.calories);
    if (Number.isFinite(index) && Number.isFinite(calories) && calories > 0) {
      mapped[index] = Math.round(calories);
    }
  });
  return mapped;
};

const enrichItemsWithCalories = async (items) => {
  const enriched = [];
  for (const item of items) {
    const name = item.name || 'Unknown item';
    const grams = Number(item.grams) || null;
    let calories = null;
    let usdaName = null;
    let usda = null;
    try {
      usda = await fetchUSDA(name);
    } catch (error) {
      usda = null;
    }
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

  const missing = enriched
    .map((item, index) =>
      item.calories === null
        ? {
            index,
            name: item.name,
            portion: item.portion,
            grams: item.grams,
          }
        : null
    )
    .filter(Boolean);

  if (missing.length > 0) {
    try {
      const fallback = await estimateCaloriesFallback(missing);
      enriched.forEach((item, index) => {
        if (item.calories === null && Number.isFinite(fallback[index])) {
          item.calories = fallback[index];
        }
      });
    } catch (error) {
      // ignore fallback errors
    }
  }

  const totalCalories = enriched.reduce(
    (sum, item) => sum + (item.calories ?? 0),
    0
  );

  return { items: enriched, totalCalories };
};

const fetchUSDA = async (query) => {
  const key = process.env.USDAFOOD_KEY;
  if (!key) throw new Error('Missing USDAFOOD_KEY');
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
    key
  )}&query=${encodeURIComponent(query)}&pageSize=1`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
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

    let content;
    try {
      content = await callOpenAI({
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
      });
    } catch (error) {
      return res.status(502).json({ error: 'OpenAI error', detail: String(error) });
    }

    const parsed = extractJson(content) || { items: [] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    const { items: enriched, totalCalories } = await enrichItemsWithCalories(items);

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

app.post('/v1/food/estimate', requireApiKey, async (req, res) => {
  try {
    const text = String(req.body?.text ?? '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const items = await analyzeFoodsFromText(text);
    const { items: enriched, totalCalories } = await enrichItemsWithCalories(items);

    return res.json({
      items: enriched,
      totalCalories,
      disclaimer: 'Estimates only. Please review portions before saving.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', detail: String(error) });
  }
});

app.post('/v1/portion/coach', requireApiKey, async (req, res) => {
  try {
    const text = String(req.body?.text ?? '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const targetRaw = req.body?.targetCalories;
    let targetNumber = null;
    if (targetRaw !== null && targetRaw !== undefined && targetRaw !== '') {
      const num = typeof targetRaw === 'number' ? targetRaw : Number(targetRaw);
      if (Number.isFinite(num)) {
        targetNumber = num;
      }
    }

    const items = await analyzeFoodsFromText(text);
    const { items: enriched, totalCalories } = await enrichItemsWithCalories(items);

    let summary = 'Review the estimate and adjust portions as needed.';
    let adjustments = [];
    try {
      const content = await callOpenAI({
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a nutrition coach. Provide practical portion adjustments. Return only JSON with: {"summary": string, "adjustments": string[]}. Use 1-3 short adjustments.',
          },
          {
            role: 'user',
            content: `Meal: "${text}". Estimated calories: ${totalCalories}. Target calories: ${
              targetNumber ?? 'none'
            }. Provide adjustments.`,
          },
        ],
      });
      const parsed = extractJson(content) || {};
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
        summary = parsed.summary.trim();
      }
      if (Array.isArray(parsed.adjustments)) {
        adjustments = parsed.adjustments.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3);
      }
    } catch (error) {
      // fall back to default summary
    }

    return res.json({
      estimatedCalories: totalCalories,
      targetCalories: targetNumber ?? null,
      summary,
      adjustments,
      items: enriched,
      disclaimer: 'Estimates only. Please review portions before saving.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', detail: String(error) });
  }
});

app.post('/v1/goal/tuning', requireApiKey, async (req, res) => {
  try {
    const allowed = ['15:9', '16:8', '17:7', '18:6'];
    const protocolHours = {
      '15:9': 15,
      '16:8': 16,
      '17:7': 17,
      '18:6': 18,
    };

    const currentProtocol = String(req.body?.currentProtocol ?? '').trim();
    const safeCurrent = allowed.includes(currentProtocol) ? currentProtocol : '16:8';
    const adherencePct = Number(req.body?.adherencePct);
    const avgFastingHours = Number(req.body?.avgFastingHours);
    const safeAvgHours = Number.isFinite(avgFastingHours) ? avgFastingHours : 0;
    const sessionsCount = Number(req.body?.sessionsCount ?? 0);

    if (!Number.isFinite(adherencePct) || sessionsCount <= 0) {
      return res.status(400).json({ error: 'Not enough data' });
    }

    const content = await callOpenAI({
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a supportive fasting coach. Recommend one protocol from [15:9, 16:8, 17:7, 18:6] based on adherence and average fasting hours. Return only JSON: {"recommendedProtocol": string, "rationale": string}. If adherence < 70, do not recommend a longer fast.',
        },
        {
          role: 'user',
          content: `Current protocol: ${safeCurrent}. Adherence: ${adherencePct}%. Avg fasting hours: ${safeAvgHours}. Longest weekly avg hours: ${Number(req.body?.longestWeekHours) || 0}. Sessions: ${sessionsCount}.`,
        },
      ],
    });

    const parsed = extractJson(content) || {};
    let recommended = allowed.includes(parsed.recommendedProtocol) ? parsed.recommendedProtocol : safeCurrent;
    const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : 'Keep your current protocol steady.';
    let note;

    if (
      Number.isFinite(adherencePct) &&
      adherencePct < 70 &&
      protocolHours[recommended] > protocolHours[safeCurrent]
    ) {
      recommended = safeCurrent;
      note = 'Recommendation capped to match your recent adherence.';
    }

    return res.json({
      recommendedProtocol: recommended,
      rationale,
      note,
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
