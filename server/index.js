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

const extractCount = (text) => {
  if (!text) return null;
  const normalized = String(text).toLowerCase().trim();
  if (!normalized) return null;

  const hasMeasurementUnit = /(\\b\\d+\\s*(g|gram|grams|kg|ml|l|oz|lb|pounds?)\\b)/i.test(normalized);
  if (hasMeasurementUnit) return null;

  const match =
    normalized.match(
      /(?:x\\s*)?(\\d+)\\s*(?:x|pcs?|pieces?|cookies?|slices?|bars?|sticks?|eggs?|cups?|servings?)\\b/i
    ) ||
    normalized.match(/\\b(\\d+)\\s*x\\b/i) ||
    normalized.match(/\\bx\\s*(\\d+)\\b/i) ||
    normalized.match(/^\\s*(\\d+)\\s*$/);
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  return count <= 20 ? count : null;
};

const parseGramsFromText = (text) => {
  if (!text) return null;
  const normalized = String(text).toLowerCase();
  const match = normalized.match(/(\\d+(?:\\.\\d+)?)\\s*(kg|g|oz|lb|lbs|pound|pounds)\\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2];
  let grams = value;
  if (unit === 'kg') grams = value * 1000;
  if (unit === 'oz') grams = value * 28.3495;
  if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') {
    grams = value * 453.592;
  }
  return Math.round(grams);
};

const normalizeUnitSystem = (value) => (value === 'imperial' ? 'imperial' : 'metric');

const PROTOCOL_ORDER = ['15:9', '16:8', '17:7', '18:6'];
const PROTOCOL_EATING_HOURS = {
  '15:9': 9,
  '16:8': 8,
  '17:7': 7,
  '18:6': 6,
};

const unitSystemHint = (unitSystem) =>
  unitSystem === 'imperial'
    ? 'Use imperial units (oz, lb, fl oz) for portion descriptions, but keep grams as a numeric gram estimate.'
    : 'Use metric units (g, ml) for portion descriptions.';

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

const analyzeFoodsFromText = async (text, unitSystem) => {
  const unitHint = unitSystemHint(unitSystem);
  const content = await callOpenAI({
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          `You are a nutrition assistant. Identify foods and estimate portion size in grams. ${unitHint} Return only JSON with an array named items. Each item: {"name": string, "portion": string, "grams": number, "confidence": number}.`,
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
          'You estimate calories for foods. Return only JSON with array items: [{"index": number, "calories": number|null}]. Use grams or count if provided, otherwise portion text.',
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
  const fallbackCandidates = [];
  const needsFallback = new Set();
  for (const item of items) {
    const name = item.name || 'Unknown item';
    let calories = null;
    let usdaName = null;
    const portionText = item.portion ?? '';
    const gramsRaw = Number(item.grams);
    const grams =
      Number.isFinite(gramsRaw) && gramsRaw > 0
        ? gramsRaw
        : parseGramsFromText(portionText);
    const countRaw = Number(item.count);
    const countText =
      extractCount(portionText) ?? extractCount(`${portionText} ${item.name ?? ''}`);
    const count =
      Number.isFinite(countRaw) && countRaw > 0 ? Math.round(countRaw) : countText;
    let usda = null;
    try {
      usda = await fetchUSDA(name);
    } catch (error) {
      usda = null;
    }
    if (usda && usda.kcalPer100g) {
      usdaName = usda.name;
      if (grams) {
        const multiplier = count && count > 0 ? count : 1;
        calories = Math.round(((usda.kcalPer100g * grams) / 100) * multiplier);
      } else if (!count) {
        calories = Math.round(usda.kcalPer100g);
      }
    }
    enriched.push({
      name,
      portion: item.portion || null,
      grams: grams ?? null,
      confidence: item.confidence ?? null,
      calories,
      sourceName: usdaName,
      count,
    });

    if (calories === null || (count && count > 1 && !grams)) {
      needsFallback.add(enriched.length - 1);
      fallbackCandidates.push({
        index: enriched.length - 1,
        name,
        portion: item.portion || null,
        grams,
        count,
      });
    }
  }

  if (fallbackCandidates.length > 0) {
    try {
      const fallback = await estimateCaloriesFallback(fallbackCandidates);
      enriched.forEach((item, index) => {
        if (needsFallback.has(index) && Number.isFinite(fallback[index])) {
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

const getKcalPer100g = (food) => {
  const nutrient = (food.foodNutrients || []).find(
    (item) => item.nutrientId === 1008
  );
  const kcal = Number(nutrient?.value);
  return Number.isFinite(kcal) ? kcal : null;
};

const selectBestFood = (foods, options) => {
  let best = null;
  foods.forEach((food) => {
    const description = String(food.description ?? '').toLowerCase();
    const category = String(food.foodCategory ?? '').toLowerCase();
    const kcal = getKcalPer100g(food);
    let score = 0;
    if (description.includes('powder') || description.includes('dry') || description.includes('mix')) {
      score += 4;
    }
    if (description.includes('instant')) {
      score += 2;
    }
    if (description.includes('brewed') || description.includes('prepared') || description.includes('beverage') || description.includes('drink')) {
      score -= 2;
    }
    if (category.includes('beverage')) {
      score -= 1;
    }
    if (options.isBlackCoffee && kcal !== null && kcal > 20) {
      score += 4;
    }
    if (options.isBlackCoffee && description.includes('black')) {
      score -= 1;
    }
    if (options.isCoffee && options.hasDairy) {
      if (description.includes('latte') || description.includes('cappuccino') || description.includes('mocha') || description.includes('macchiato')) {
        score -= 1;
      }
    }
    if (kcal === null) {
      score += 2;
    }
    if (!best || score < best.score || (score === best.score && options.isBlackCoffee && kcal !== null && kcal < best.kcal)) {
      best = {
        score,
        kcal,
        name: food.description,
      };
    }
  });
  return best;
};

const fetchUSDA = async (query) => {
  const key = process.env.USDAFOOD_KEY;
  if (!key) throw new Error('Missing USDAFOOD_KEY');

  const normalized = String(query).toLowerCase();
  const isCoffee = /(coffee|americano|espresso)/i.test(normalized);
  const hasDairy = /(latte|cappuccino|mocha|macchiato|milk|cream|creamer|frappe|sweet|sugar|syrup)/i.test(
    normalized
  );
  const isBlackCoffee = isCoffee && !hasDairy;

  const attempts = isBlackCoffee ? ['coffee brewed', query] : [query];
  let bestCandidate = null;

  for (const attempt of attempts) {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      key
    )}&query=${encodeURIComponent(attempt)}&pageSize=5`;
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }
    const data = await response.json();
    const foods = Array.isArray(data?.foods) ? data.foods : [];
    if (!foods.length) continue;

    const selected = selectBestFood(foods, { isCoffee, hasDairy, isBlackCoffee });
    if (selected && (!isBlackCoffee || (selected.kcal !== null && selected.kcal <= 20))) {
      return {
        name: selected.name,
        kcalPer100g: selected.kcal,
      };
    }
    if (selected && (!bestCandidate || selected.score < bestCandidate.score)) {
      bestCandidate = selected;
    }
  }

  if (!bestCandidate) return null;
  return {
    name: bestCandidate.name,
    kcalPer100g: bestCandidate.kcal,
  };
};

const clampProtocolForMinEating = (protocolKey, minEatingHours) => {
  const allowed = PROTOCOL_ORDER.filter(
    (key) => (PROTOCOL_EATING_HOURS[key] ?? 0) >= minEatingHours
  );
  if (!allowed.length) return protocolKey;
  if (allowed.includes(protocolKey)) return protocolKey;
  return allowed[allowed.length - 1];
};

const resolveTargetProtocol = (goalMode, pace, minEatingHours) => {
  const mapping = {
    lose: { gentle: '16:8', moderate: '17:7', aggressive: '18:6' },
    maintain: { gentle: '15:9', moderate: '16:8', aggressive: '17:7' },
    gain: { gentle: '15:9', moderate: '15:9', aggressive: '16:8' },
  };
  const target = mapping?.[goalMode]?.[pace] ?? '16:8';
  return clampProtocolForMinEating(target, minEatingHours);
};

const getProtocolIndex = (protocolKey) => {
  const index = PROTOCOL_ORDER.indexOf(protocolKey);
  return index === -1 ? 1 : index;
};

const getCalorieAdjustment = (goalMode, pace) => {
  if (goalMode === 'maintain') return 0;
  const magnitude = pace === 'aggressive' ? 300 : pace === 'moderate' ? 200 : 100;
  return goalMode === 'lose' ? -magnitude : magnitude;
};

const buildPlanWeeks = ({
  startProtocol,
  goalMode,
  pace,
  rampWeeks,
  minEatingHours,
  baseCalories,
}) => {
  const safeWeeks = Math.max(2, Math.min(8, rampWeeks));
  const targetProtocol = resolveTargetProtocol(goalMode, pace, minEatingHours);
  const startClamped = clampProtocolForMinEating(startProtocol, minEatingHours);
  const startIndex = getProtocolIndex(startClamped);
  const targetIndex = getProtocolIndex(targetProtocol);
  const steps = Math.max(0, targetIndex - startIndex);
  const adjustment = getCalorieAdjustment(goalMode, pace);
  const weeks = Array.from({ length: safeWeeks }, (_, weekIndex) => {
    const progress = safeWeeks === 1 ? 0 : weekIndex / (safeWeeks - 1);
    const step = steps === 0 ? 0 : Math.round(steps * progress);
    const protocolKey = PROTOCOL_ORDER[Math.min(startIndex + step, targetIndex)];
    const dailyCalories =
      baseCalories > 0
        ? Math.max(0, Math.round(baseCalories + adjustment * progress))
        : null;
    return {
      weekIndex,
      protocolKey,
      dailyCalories,
      notes: weekIndex === 0 ? 'Start steady and focus on consistency.' : null,
    };
  });
  return { targetProtocol, weeks };
};

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.post('/v1/food/analyze', requireApiKey, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image' });
    }
    const unitSystem = normalizeUnitSystem(req.body?.unitSystem);
    const unitHint = unitSystemHint(unitSystem);

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
              `You are a nutrition assistant. Identify foods and estimate portion size in grams. ${unitHint} Return only JSON with an array named items. Each item: {"name": string, "portion": string, "grams": number, "confidence": number}.`,
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
    const unitSystem = normalizeUnitSystem(req.body?.unitSystem);
    const items = await analyzeFoodsFromText(text, unitSystem);
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

app.post('/v1/food/recalculate', requireApiKey, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) {
      return res.status(400).json({ error: 'Missing items' });
    }
    const sanitized = items.map((item) => ({
      name: String(item?.name ?? 'Unknown item'),
      portion: item?.portion ?? null,
      grams: Number(item?.grams) || null,
      confidence: item?.confidence ?? null,
      count: item?.count ?? null,
    }));

    const { items: enriched, totalCalories } = await enrichItemsWithCalories(sanitized);
    return res.json({
      items: enriched,
      totalCalories,
      disclaimer: 'Estimates only. Please review portions before saving.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', detail: String(error) });
  }
});

app.post('/v1/fridge/ideas', requireApiKey, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image' });
    }
    const limitRaw = req.body?.calorieLimit;
    const parsedLimit = Number(limitRaw);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 400;

    const sourceBuffer = req.file.buffer;
    const analysisBuffer = await sharp(sourceBuffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const imageBase64 = analysisBuffer.toString('base64');

    let content;
    try {
      content = await callOpenAI({
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a meal planner. Identify visible ingredients in the fridge and propose 3-5 meal ideas that use them. Each meal must be at or under the calorie limit. Return only JSON: {"items": string[], "meals": [{"title": string, "calories": number, "ingredients": string[], "notes": string}]}.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Calorie limit: ${limit}. Provide meal ideas.` },
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

    const parsed = extractJson(content) || { items: [], meals: [] };
    const items = Array.isArray(parsed.items) ? parsed.items.filter((item) => typeof item === 'string') : [];
    const meals = Array.isArray(parsed.meals)
      ? parsed.meals
          .map((meal) => ({
            title: String(meal.title ?? 'Meal idea'),
            calories: Number(meal.calories) || 0,
            ingredients: Array.isArray(meal.ingredients)
              ? meal.ingredients.map((ing) => String(ing))
              : [],
            notes: meal.notes ? String(meal.notes) : undefined,
          }))
          .filter((meal) => Number.isFinite(meal.calories) && meal.calories > 0 && meal.calories <= limit)
      : [];

    return res.json({
      items,
      meals,
      calorieLimit: limit,
      disclaimer: 'Estimates only. Please verify ingredients and portions.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', detail: String(error) });
  }
});

app.post('/v1/autopilot', requireApiKey, async (req, res) => {
  try {
    const windowMinutes = Number(req.body?.windowMinutes ?? 0);
    if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
      return res.status(400).json({ error: 'Missing windowMinutes' });
    }
    const remainingCaloriesRaw = Number(req.body?.remainingCalories);
    const remainingCalories = Number.isFinite(remainingCaloriesRaw)
      ? remainingCaloriesRaw
      : null;
    const unitSystem = normalizeUnitSystem(req.body?.unitSystem);
    const unitHint = unitSystemHint(unitSystem);

    const content = await callOpenAI({
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            `You are a nutrition planner. Create a timed eating-window plan. ${unitHint} Return only JSON: {"items":[{"time":"HH:MM","title":string,"calories":number,"notes":string}],"totalCalories":number}. Keep 3-4 items and keep total calories near remaining calories if provided.`,
        },
        {
          role: 'user',
          content: `Window minutes: ${windowMinutes}. Remaining calories: ${
            remainingCalories ?? 'not set'
          }.`,
        },
      ],
    });

    const parsed = extractJson(content) || { items: [] };
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => ({
            time: String(item.time ?? ''),
            title: String(item.title ?? 'Meal'),
            calories: Number(item.calories) || 0,
            notes: item.notes ? String(item.notes) : undefined,
          }))
          .filter((item) => item.time && Number.isFinite(item.calories) && item.calories > 0)
      : [];

    const totalCalories = items.reduce((sum, item) => sum + (item.calories ?? 0), 0);

    return res.json({
      items,
      totalCalories,
      disclaimer: 'Estimates only. Adjust to your appetite and schedule.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', detail: String(error) });
  }
});

app.post('/v1/craving/rescue', requireApiKey, async (req, res) => {
  try {
    const isFasting = Boolean(req.body?.isFasting);
    const minutesLeft = Number(req.body?.minutesLeft);
    const fastingDurationMinutes = Number(req.body?.fastingDurationMinutes);
    const streakDays = Number(req.body?.streakDays);
    const remainingCaloriesRaw = Number(req.body?.remainingCalories);
    const remainingCalories = Number.isFinite(remainingCaloriesRaw)
      ? remainingCaloriesRaw
      : null;
    const unitSystem = normalizeUnitSystem(req.body?.unitSystem);

    const content = await callOpenAI({
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You are a calm, supportive coach. Provide a quick tip and 3 short steps to handle cravings. Reference motivation if context is provided (time left or streak). If fasting, avoid food suggestions. If not fasting, include 2 snack ideas under the remaining calories if provided. Return only JSON: {"quickTip": string, "steps": string[], "snackIdeas": string[]}.',
        },
        {
          role: 'user',
          content: `Status: ${isFasting ? 'fasting' : 'eating'}. Minutes left: ${
            Number.isFinite(minutesLeft) ? minutesLeft : 'n/a'
          }. Fasting duration: ${
            Number.isFinite(fastingDurationMinutes) ? fastingDurationMinutes : 'n/a'
          } minutes. Streak days: ${Number.isFinite(streakDays) ? streakDays : 'n/a'}. Remaining calories: ${
            remainingCalories ?? 'n/a'
          }. Unit system: ${unitSystem}.`,
        },
      ],
    });

    const parsed = extractJson(content) || {};
    const quickTip =
      typeof parsed.quickTip === 'string' && parsed.quickTip.trim()
        ? parsed.quickTip.trim()
        : 'Take three slow breaths and reset.';
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter((step) => typeof step === 'string' && step.trim()).slice(0, 4)
      : [];
    const snackIdeas = Array.isArray(parsed.snackIdeas)
      ? parsed.snackIdeas.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
      : [];

    return res.json({
      quickTip,
      steps,
      snackIdeas,
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
    const unitSystem = normalizeUnitSystem(req.body?.unitSystem);

    const targetRaw = req.body?.targetCalories;
    let targetNumber = null;
    if (targetRaw !== null && targetRaw !== undefined && targetRaw !== '') {
      const num = typeof targetRaw === 'number' ? targetRaw : Number(targetRaw);
      if (Number.isFinite(num)) {
        targetNumber = num;
      }
    }

    const items = await analyzeFoodsFromText(text, unitSystem);
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

app.post('/v1/plan/recommend', requireApiKey, async (req, res) => {
  try {
    const goalMode = String(req.body?.goalMode ?? 'maintain').trim();
    const pace = String(req.body?.targetPace ?? 'gentle').trim();
    const startProtocol = String(req.body?.startProtocol ?? '16:8').trim();
    const minEatingHoursRaw = Number(req.body?.minEatingHours ?? 8);
    const rampWeeksRaw = Number(req.body?.rampWeeks ?? 4);
    const baseCaloriesRaw = Number(req.body?.dailyCalorieGoal ?? 0);

    const minEatingHours = Number.isFinite(minEatingHoursRaw)
      ? Math.max(6, Math.min(12, minEatingHoursRaw))
      : 8;
    const rampWeeks = Number.isFinite(rampWeeksRaw)
      ? Math.max(2, Math.min(8, rampWeeksRaw))
      : 4;
    const baseCalories = Number.isFinite(baseCaloriesRaw) ? baseCaloriesRaw : 0;

    const fallback = buildPlanWeeks({
      startProtocol,
      goalMode,
      pace,
      rampWeeks,
      minEatingHours,
      baseCalories,
    });

    let content = null;
    try {
      content = await callOpenAI({
        temperature: 0.25,
        messages: [
          {
            role: 'system',
            content:
              'You are a fasting coach. Build a week-by-week ramp plan. Return only JSON: {"targetProtocol": string, "weeks": [{"weekIndex": number, "protocolKey": string, "dailyCalories": number|null, "notes": string|null}], "rationale": string}. Allowed protocols: 15:9, 16:8, 17:7, 18:6. Respect minimum eating hours and ramp length.',
          },
          {
            role: 'user',
            content: `Goal: ${goalMode}. Pace: ${pace}. Start protocol: ${startProtocol}. Min eating hours: ${minEatingHours}. Ramp weeks: ${rampWeeks}. Base calories: ${baseCalories}.`,
          },
        ],
      });
    } catch (error) {
      content = null;
    }

    const parsed = extractJson(content) || {};
    const targetProtocol = PROTOCOL_ORDER.includes(parsed.targetProtocol)
      ? parsed.targetProtocol
      : fallback.targetProtocol;
    const weeks = Array.isArray(parsed.weeks)
      ? parsed.weeks
          .map((week, index) => ({
            weekIndex:
              Number.isFinite(Number(week.weekIndex)) ? Number(week.weekIndex) : index,
            protocolKey: PROTOCOL_ORDER.includes(week.protocolKey)
              ? week.protocolKey
              : fallback.weeks[index]?.protocolKey ?? fallback.targetProtocol,
            dailyCalories: Number.isFinite(Number(week.dailyCalories))
              ? Number(week.dailyCalories)
              : null,
            notes: typeof week.notes === 'string' ? week.notes : null,
          }))
          .slice(0, rampWeeks)
      : fallback.weeks;
    const rationale =
      typeof parsed.rationale === 'string' && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : 'Generated using your goal, pace, and recent adherence.';

    return res.json({
      targetProtocol: clampProtocolForMinEating(targetProtocol, minEatingHours),
      weeks,
      rationale,
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
