# Paywall Copy + App Store IAP Text

## Paywall (In-App) Copy
Title: Unlock Fasting Lane Pro
Subtitle: AI-powered tools for smarter eating windows.

Primary benefits:
- Scan meals for instant calorie estimates
- “If I eat this” quick estimates
- Portion coach adjustments
- Fridge photo meal ideas
- Goal tuning for your fasting protocol

CTA (Monthly): Start 7-day free trial
CTA (Yearly): Save 20% with annual
Secondary: Not now
Footer: Cancel anytime. Trial auto-renews unless canceled 24 hours before the end of the trial.

Trial upsell line (optional):
“Try Pro free for 7 days. Keep your streaks, not the guesses.”

## App Store Connect - Subscription Product Descriptions
Use these for each product’s “Description” field.

### Fasting Lane Pro - Monthly
Short name: Fasting Lane Pro (Monthly)
Product ID: pro_monthly
Description:
Unlock AI tools that help you eat smarter during your eating windows. Includes meal photo scans, “If I eat this” calorie estimates, portion coaching, fridge-based meal ideas, and goal tuning recommendations. Cancel anytime.

### Fasting Lane Pro - Yearly
Short name: Fasting Lane Pro (Yearly)
Product ID: pro_yearly
Description:
Get a full year of Fasting Lane Pro with all AI tools included: photo meal scans, quick calorie estimates, portion coaching, fridge meal ideas, and fasting goal tuning. Save vs monthly. Cancel anytime.

## Feature Gating Map (Exact)

Free access:
- Home: fasting timer, ring progress, start/stop/adjust
- Eating: manual notes, manual calories, history preview
- Insights: weekly fasting + daily calories charts
- History: eating windows + note details
- Settings: reminders, hydration schedule, appearance

Pro-only (AI):
- Eating: “Scan photo” button opens paywall if not subscribed
- Smart tab:
  - If I eat this
  - Portion coach
  - Fridge ideas
  - Goal tuning
- Any AI-powered calorie refresh

Behavior rules:
- If user is not subscribed, show paywall before running any AI call.
- If user cancels, keep previous AI results visible (read-only), but block new AI calls.
- Restore purchases always available in Settings.

## Suggested Settings Entries (Copy)
- Manage subscription (opens Apple subscription management)
- Restore purchases
- Pro status badge: “Pro active” or “Free plan”

## App Store Review Notes (Optional)
Explain that AI features require a subscription due to ongoing inference costs and that core fasting tracking remains fully usable without payment.
