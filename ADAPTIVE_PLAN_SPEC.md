# Adaptive Plan - Feature Spec (Draft)

## Goal
Create a guided plan that helps users ramp from an easy fasting + calorie regime to a stricter one over time, with AI recommendations and user-controlled adjustments.

## User outcomes
- Build a personalized fasting + calorie plan that feels achievable.
- See a week-by-week ramp with clear next steps.
- Get AI suggestions, but keep the user in control.

## Core flow
1) Create plan
   - Goal: lose / maintain / gain.
   - Target pace: gentle / moderate / aggressive.
   - Start protocol: recommended (AI) or manual pick.
   - Constraints: minimum eating window, training days, social days, bedtime, wake time.
2) Plan overview
   - 2–4 week ramp view with weekly targets.
   - Each week shows fasting protocol + daily calorie target.
3) Weekly check-in
   - Quick review: adherence, energy, hunger, schedule conflicts.
   - AI suggests: step up, hold, or step down.
   - User approves the change.

## MVP feature set
- Plan builder: goal + start protocol + ramp length + constraints.
- Weekly plan cards (current + next 3 weeks).
- AI suggestion text (no auto-apply).
- Progress indicator: adherence + plan confidence.
- Manual override: “Keep current week” or “Lower intensity.”

## AI support (MVP)
- Recommend starting protocol based on:
  - Recent logs (avg fasting hours, adherence).
  - Goal and target pace.
  - Constraints (min eating window, schedule).
- Weekly adjustment suggestion with rationale text.

## Smart rules (fallback if AI unavailable)
- If adherence < 70%: hold or step down.
- If adherence 70–85%: hold and adjust timing.
- If adherence > 85% for 2 weeks: step up 1 hour fasting.
- Never reduce eating window below user minimum.

## Data model (proposed)
- Plan
  - id
  - goalMode (lose/maintain/gain)
  - targetPace (gentle/moderate/aggressive)
  - minEatingHours
  - trainingDays[] (0-6)
  - socialDays[] (0-6)
  - startDate
  - activeWeekIndex
  - status (active/paused/completed)
- PlanWeek
  - planId
  - weekIndex
  - protocolKey (e.g., 16:8)
  - dailyCalorieTarget
  - notes
- PlanCheckIn
  - planId
  - weekIndex
  - adherencePct
  - energy (1-5)
  - hunger (1-5)
  - conflicts (free text)
  - aiSuggestion (json)

## UI surface areas
- New tab or card entry: "Adaptive Plan"
- Plan builder modal (single-screen form)
- Plan overview cards (timeline)
- Weekly check-in card + CTA

## Acceptance criteria
- User can create a plan without AI (manual start protocol).
- Plan shows current week target protocol + calorie target.
- Weekly check-in produces a suggestion and requires user approval.
- All plan data stored locally.

## Future enhancements
- HealthKit weight trend integration.
- Calendar sync for social days.
- Multi-stage macros (protein focus on stricter weeks).
- Subscription gating for AI personalization.
