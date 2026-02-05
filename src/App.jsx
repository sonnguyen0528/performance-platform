import { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

// ─── DATA ────────────────────────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  name: "Sonny Nguyen",
  age: "29M",
  dob: "09/21/1996",
  height: '5\'11"',
  weight: "210",
  bmi: "29.3",
  service: "USMC — CPL, Honorable",
  vaPcp: "Dr. Nayyar Masood",
  psychiatrist: "Dr. Daolong Zhang",
  goalWeight: "185–190",
  goalWaist: '~32"',
  dailyCal: "~2,450",
  protein: "~172g",
  training: "3x/wk + 1 bonus",
  steps: "10,000/day",
  program: "Kinobody Movie Star Body",
};

const DEFAULT_MEDS = [
  { name: "Sertraline 100mg", timing: "Every morning", purpose: "Depression", notes: "Take with breakfast." },
  { name: "Allopurinol 300mg", timing: "Once daily", purpose: "Gout prevention", notes: "Take with food. Stay hydrated." },
  { name: "Colchicine 0.6mg", timing: "Once daily", purpose: "Gout prevention", notes: "Take with food. Avoid grapefruit." },
  { name: "Melatonin 10mg", timing: "Bedtime", purpose: "Sleep", notes: "Take 30–60 min before sleep." },
];

const DEFAULT_SUPPS = [
  { name: "Vitamin D3", dose: "5,000 IU", when: "Breakfast (with fat)", why: "Clinically deficient at 16.7. Target 40+." },
  { name: "Methylfolate", dose: "800 mcg", when: "Morning w/ Sertraline", why: "Folate at 5.1 deficient. Enhances SSRI." },
  { name: "Omega-3 Fish Oil", dose: "2–3g EPA/DHA", when: "With dinner", why: "HDL borderline. Anti-inflammatory." },
  { name: "Magnesium Glycinate", dose: "400mg", when: "Bedtime", why: "Sleep quality + muscle recovery." },
  { name: "Tart Cherry Extract", dose: "500mg", when: "Evening", why: "Gout prevention + anti-inflammatory." },
];

const DEFAULT_CONDITIONS = [
  { condition: "Depression NOS, Moderate", date: "Oct 2023", impact: "On Sertraline 100mg. Sleep + exercise are top tools." },
  { condition: "Polycythemia", date: "Oct 2024", impact: "Elevated RBC/HCT. Stay hydrated 100oz+/day." },
  { condition: "Gout", date: "Aug 2023", impact: "On Allopurinol + Colchicine. Limit red meat, alcohol." },
  { condition: "Low Back Pain", date: "Jun 2023", impact: "Avoid loaded spinal flexion. Front squats > back squats." },
  { condition: "Left Shoulder Pain", date: "Jun 2023", impact: "Full warmup before pressing. Landmine if overhead flares." },
  { condition: "Migraine with Aura", date: "Apr 2023", impact: "Sleep consistency #1 prevention. Don't skip meals." },
];

const DEFAULT_LABS = [
  { test: "Glucose (fasting)", result: "103", unit: "mg/dL", ref: "74–100", status: "Borderline", action: "Cut simple sugars, protein-first meals." },
  { test: "ALT (liver)", result: "74", unit: "U/L", ref: "0–44", status: "HIGH", action: "Zero alcohol 30 days. Minimize acetaminophen." },
  { test: "AST (liver)", result: "40", unit: "U/L", ref: "11–34", status: "High", action: "Monitor alongside ALT." },
  { test: "HDL", result: "41", unit: "mg/dL", ref: ">40", status: "Borderline", action: "Omega-3s + cardio/walking 10k steps." },
  { test: "Testosterone", result: "321", unit: "ng/dL", ref: "250–1100", status: "Low-Normal", action: "Fix Vitamin D, sleep 8-9 hrs, heavy compounds." },
  { test: "Free Testosterone", result: "69.7", unit: "pg/mL", ref: "46–224", status: "Low-Normal", action: "Will improve with T optimization." },
  { test: "Vitamin D", result: "16.7", unit: "ng/mL", ref: "30–40", status: "DEFICIENT", action: "5,000 IU D3 daily. Non-negotiable." },
  { test: "Folate", result: "5.1", unit: "ng/mL", ref: "7.0–31.4", status: "DEFICIENT", action: "Methylfolate 800mcg + dark leafy greens." },
  { test: "Hemoglobin", result: "16.8", unit: "g/dL", ref: "14–17", status: "Normal", action: "Upper normal. Consistent with polycythemia." },
  { test: "Hematocrit", result: "50.9", unit: "%", ref: "39–51%", status: "Watch", action: "Upper edge. Hydration critical." },
  { test: "Ferritin", result: "358.6", unit: "ng/mL", ref: "22–350", status: "High", action: "Slightly high. Could be inflammatory." },
  { test: "HbA1c", result: "5.1", unit: "%", ref: "<5.6%", status: "Normal", action: "Good long-term glucose control." },
  { test: "Uric Acid", result: "5.5", unit: "mg/dL", ref: "3.7–7.7", status: "Normal", action: "Allopurinol working. Hydration up." },
  { test: "TSH", result: "2.62", unit: "uIU/mL", ref: "0.4–5.0", status: "Normal", action: "Thyroid function normal." },
];

const DEFAULT_TARGETS = [
  { metric: "Weight", current: "210 lbs", target: "200 lbs", how: "~1 lb/week with strength training + calorie control." },
  { metric: "Waist", current: "TBD", target: '~34"', how: "Track weekly. Goal is 32\" long-term." },
  { metric: "Vitamin D", current: "16.7 ng/mL", target: "40+ ng/mL", how: "5,000 IU D3 daily. Retest at 3-month labs." },
  { metric: "Folate", current: "5.1 ng/mL", target: "10+ ng/mL", how: "Methylfolate + leafy greens daily." },
  { metric: "ALT (liver)", current: "74 U/L", target: "<44 U/L", how: "Zero alcohol, monitor." },
  { metric: "Fasting Glucose", current: "103 mg/dL", target: "<100 mg/dL", how: "Carb timing + weight loss." },
  { metric: "HDL", current: "41 mg/dL", target: "50+ mg/dL", how: "Walking 10k steps + omega-3s." },
  { metric: "PHQ-9", current: "12", target: "<10", how: "Training + sleep + D + folate." },
  { metric: "Testosterone", current: "321 ng/dL", target: "400+ ng/dL", how: "Fix D, sleep, train heavy. Retest 6 mo." },
  { metric: "Training", current: "Inconsistent", target: "3x/wk + bonus", how: "Mon/Wed/Fri + Sat. Log every session." },
  { metric: "Steps", current: "TBD", target: "10,000/day", how: "Fasting morning walks + throughout day." },
  { metric: "Sleep", current: "Variable", target: "8–9 hrs/night", how: "10:30 PM → 8:00 AM minimum." },
];

const DEFAULT_GROCERIES = {
  proteins: [
    { item: "Chicken breast/thighs", qty: "4 lbs", notes: "~8oz/day cooked", have: false },
    { item: "Ground turkey", qty: "1.5 lbs", notes: "Burgers, bowls", have: false },
    { item: "Salmon fillets", qty: "1.5 lbs", notes: "2-3 dinners", have: false },
    { item: "Smoked salmon", qty: "8 oz", notes: "Breakfast 1-2x", have: false },
    { item: "White fish (cod/tilapia)", qty: "1 lb", notes: "Fish tacos", have: false },
    { item: "Eggs", qty: "2 dozen", notes: "2-3/day", have: false },
    { item: "Greek yogurt", qty: "32 oz tub", notes: "Meal 1 option", have: false },
    { item: "Cottage cheese", qty: "16 oz", notes: "Late night", have: false },
    { item: "Protein powder", qty: "—", notes: "Post-workout", have: false },
  ],
  carbs: [
    { item: "Brown rice", qty: "2 lbs dry", notes: "~1 cup cooked/day", have: false },
    { item: "Sweet potatoes", qty: "4-5 medium", notes: "Dinners", have: false },
    { item: "Russet potatoes", qty: "2 lbs", notes: "Roasting", have: false },
    { item: "Quinoa", qty: "1 lb dry", notes: "2-3 dinners", have: false },
    { item: "Oats", qty: "1 lb", notes: "Overnight oats", have: false },
    { item: "Whole grain bread", qty: "1 loaf", notes: "Toast/breakfast", have: false },
    { item: "Black beans", qty: "2 cans", notes: "Bowls, tacos", have: false },
    { item: "Lentils", qty: "1 lb dry", notes: "Folate boost", have: false },
    { item: "Granola", qty: "12 oz", notes: "With yogurt", have: false },
  ],
  vegetables: [
    { item: "Spinach", qty: "2 containers", notes: "Daily greens (folate)", have: false },
    { item: "Broccoli", qty: "2 lbs", notes: "Cruciferous daily (liver)", have: false },
    { item: "Brussels sprouts", qty: "1.5 lbs", notes: "2-3 dinners", have: false },
    { item: "Asparagus", qty: "1 bunch", notes: "Folate source", have: false },
    { item: "Bok choy", qty: "1 bunch", notes: "Stir-fry", have: false },
    { item: "Mixed salad greens", qty: "1 container", notes: "Salads", have: false },
    { item: "Cauliflower", qty: "1 head", notes: "Liver support", have: false },
  ],
  fats: [
    { item: "Avocados", qty: "5-6", notes: "~1/day", have: false },
    { item: "Walnuts", qty: "8 oz bag", notes: "Snacks, yogurt", have: false },
    { item: "Olive oil", qty: "—", notes: "Cooking (have on hand)", have: false },
    { item: "Cream cheese", qty: "8 oz", notes: "Smoked salmon", have: false },
  ],
  fruits: [
    { item: "Berries (mixed)", qty: "2 pints", notes: "Oats, snacks", have: false },
    { item: "Bananas", qty: "1 bunch", notes: "Pre-workout", have: false },
  ],
  other: [
    { item: "Dark chocolate (70%+)", qty: "1 bar", notes: "Late night treat", have: false },
    { item: "Corn tortillas", qty: "1 pack", notes: "Fish tacos", have: false },
    { item: "Coffee", qty: "—", notes: "Black only", have: false },
  ],
};

const TARGET_START_DATE = new Date("2026-02-04");
const TARGET_WEEKS = 12;

function parseNum(str) {
  if (!str) return null;
  const m = String(str).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function weeksRemaining() {
  const now = new Date();
  const end = new Date(TARGET_START_DATE);
  end.setDate(end.getDate() + TARGET_WEEKS * 7);
  const diff = (end - now) / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(diff * 10) / 10);
}

function generateHow(metric, current, target) {
  const cur = parseNum(current);
  const tgt = parseNum(target);
  const m = (metric || "").toLowerCase();
  const wks = weeksRemaining();

  if (cur === null || tgt === null) return null;

  const delta = Math.abs(cur - tgt);
  const direction = cur > tgt ? "lose" : "gain";
  const perWeek = Math.round((delta / wks) * 100) / 100;

  if (m.includes("weight")) {
    if (delta === 0) return "✅ At target. Maintain with current training + diet.";
    return `${direction === "lose" ? "Lose" : "Gain"} ${delta} lbs in ${wks} wks → ~${perWeek} lbs/wk. ${direction === "lose" ? "500 cal deficit/day = ~1 lb/wk. Strength train to preserve muscle." : "300–500 cal surplus + progressive overload."}`;
  }
  if (m.includes("waist")) {
    if (delta === 0) return "✅ At target. Maintain current routine.";
    return `Lose ${delta}" in ${wks} wks → ~${Math.round((delta / wks) * 100) / 100}"/wk. Core work + calorie deficit. Measure weekly same time.`;
  }
  if (m.includes("vitamin d") || m.includes("vit d")) {
    const gap = tgt - cur;
    if (gap <= 0) return "✅ At or above target. Maintain 2,000 IU D3 daily.";
    return `Raise ${gap.toFixed(1)} ng/mL in ${wks} wks. 5,000 IU D3 daily. Expect ~10 ng/mL rise per month at this dose. Retest at 3 months.`;
  }
  if (m.includes("folate")) {
    const gap = tgt - cur;
    if (gap <= 0) return "✅ At target. Maintain methylfolate + greens.";
    return `Raise ${gap.toFixed(1)} ng/mL. Methylfolate 800mcg daily + dark leafy greens. Enhances Sertraline response. Retest at 3 months.`;
  }
  if (m.includes("alt") || m.includes("liver")) {
    if (cur <= tgt) return "✅ At or below target. Keep monitoring.";
    return `Drop ${delta} U/L in ${wks} wks. Zero alcohol, reduce processed food, add NAC 600mg. Weight loss helps significantly. Retest at 3 months.`;
  }
  if (m.includes("glucose") || m.includes("fasting")) {
    if (cur <= tgt) return "✅ At or below target. Maintain current approach.";
    return `Drop ${delta} mg/dL. Limit carbs at dinner, walk after meals, target weight loss. Each 5 lbs lost ≈ 2–3 mg/dL drop.`;
  }
  if (m.includes("hdl")) {
    const gap = tgt - cur;
    if (gap <= 0) return "✅ At or above target. Maintain activity + omega-3s.";
    return `Raise ${gap} mg/dL in ${wks} wks. 10k steps daily + omega-3 fish oil 2g/day. Heavy training helps. Each 10 lbs lost ≈ 1–2 mg/dL HDL gain.`;
  }
  if (m.includes("phq") || m.includes("depression")) {
    if (cur <= tgt) return "✅ Below target score. Keep up current approach.";
    return `Reduce score by ${delta} pts. 3x/wk training = proven antidepressant effect. Fix Vitamin D + folate deficiency. Target: 10:30 PM sleep.`;
  }
  if (m.includes("testosterone") || m.includes("test")) {
    const gap = tgt - cur;
    if (gap <= 0) return "✅ At or above target. Maintain lifestyle factors.";
    return `Raise ${gap} ng/dL. Fix Vitamin D (direct link), sleep 8-9 hrs, heavy compound lifts, reduce body fat. Retest at 6 months.`;
  }
  if (m.includes("step")) {
    if (cur >= tgt) return "✅ Hitting step target. Stay consistent.";
    return `Build to ${target} with fasting AM walks + post-meal walks. Add 1,000 steps/wk until target.`;
  }
  if (m.includes("sleep")) {
    return `Target ${target}. Bedtime stack: melatonin + magnesium + tart cherry at 10 PM. No screens after 9:30. Protect 9+ hrs before early days.`;
  }
  if (m.includes("training") || m.includes("workout")) {
    return `Target ${target}. Mon/Wed/Fri lifting + Sat bonus. Log every session in Training tab. No skipping — consistency > perfection.`;
  }

  // Generic fallback for custom metrics
  if (delta === 0) return "✅ At target. Maintain current approach.";
  if (cur > tgt) return `Decrease by ${delta} over ${wks} wks → ~${perWeek}/wk.`;
  return `Increase by ${delta} over ${wks} wks → ~${perWeek}/wk.`;
}

const DEFAULT_SCHEDULE = {
  Monday: {
    title: "SJSU + Motus + Workout #1 (Chest & Arms)",
    blocks: [
      { time: "8:30 AM", activity: "Wake → Sertraline + Vitamin D + Methylfolate. Black coffee.", tag: "routine" },
      { time: "9:00–10:00 AM", activity: "SJSU Class", tag: "school" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1 (~500–600 cal). Eggs + fruit + light carb.", tag: "meal" },
      { time: "12:00–4:00 PM", activity: "Motus — client calls, credit reviews, funding pipeline.", tag: "work" },
      { time: "4:00–4:30 PM", activity: "Transition: light snack, prep for class.", tag: "routine" },
      { time: "4:30–5:45 PM", activity: "SJSU Zoom Class (online).", tag: "school" },
      { time: "6:00–7:00 PM", activity: "WORKOUT #1: Chest & Arms", tag: "gym" },
      { time: "7:15 PM", activity: "Dinner Feast: Meal 2 (~1,300–1,500 cal). Salmon/chicken + rice + broccoli.", tag: "meal" },
      { time: "8:00–10:00 PM", activity: "Peak energy block: Motus tasks, client follow-ups. Meal 3 at 9:30.", tag: "work" },
      { time: "10:00 PM", activity: "Wind down — Melatonin + Magnesium + Tart Cherry.", tag: "routine" },
      { time: "10:30 PM", activity: "Lights out.", tag: "sleep" },
    ],
  },
  Tuesday: {
    title: "SJSU + Motus + Team Meeting (12 PM)",
    blocks: [
      { time: "8:30 AM", activity: "Wake → Meds + Supplements. Black coffee.", tag: "routine" },
      { time: "9:00–10:00 AM", activity: "Fasting morning: 10k steps walk, light admin.", tag: "cardio" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1. Greek yogurt + granola + walnuts.", tag: "meal" },
      { time: "12:00 PM", activity: "MOTUS TEAM MEETING", tag: "work" },
      { time: "12:30–4:30 PM", activity: "Motus — action items, pipeline, credit reports.", tag: "work" },
      { time: "4:30–5:30 PM", activity: "REST DAY. Walk for steps. Eat dinner early before class.", tag: "rest" },
      { time: "5:30 PM", activity: "Dinner Feast: Meal 2. Chicken thighs + sweet potato + spinach.", tag: "meal" },
      { time: "6:00–7:45 PM", activity: "SJSU Zoom Class (online).", tag: "school" },
      { time: "8:00–10:00 PM", activity: "Peak energy: Motus strategy. Meal 3 at 9:30.", tag: "work" },
      { time: "10:00 PM", activity: "Wind down.", tag: "routine" },
      { time: "10:30 PM", activity: "Sleep.", tag: "sleep" },
    ],
  },
  Wednesday: {
    title: "SJSU + Motus + Workout #2 (Legs & Traps)",
    blocks: [
      { time: "8:30 AM", activity: "Wake → Meds + Supplements. Black coffee.", tag: "routine" },
      { time: "9:00–10:00 AM", activity: "Fasting morning: walk, light study, school assignments.", tag: "cardio" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1. Turkey + black bean bowl.", tag: "meal" },
      { time: "12:00–4:00 PM", activity: "Motus — deep work block, client calls.", tag: "work" },
      { time: "4:00–4:30 PM", activity: "Transition: light snack, hydrate extra, prep for class.", tag: "routine" },
      { time: "4:30–5:45 PM", activity: "SJSU Zoom Class (online).", tag: "school" },
      { time: "6:00–7:00 PM", activity: "WORKOUT #2: Legs & Traps. Hydrate extra (polycythemia).", tag: "gym" },
      { time: "7:15 PM", activity: "Dinner Feast: Meal 2. Stir-fry chicken + brown rice + bok choy.", tag: "meal" },
      { time: "8:00–10:00 PM", activity: "Peak energy block. Meal 3 at 9:30.", tag: "work" },
      { time: "10:00 PM", activity: "Wind down.", tag: "routine" },
      { time: "10:30 PM", activity: "Sleep.", tag: "sleep" },
    ],
  },
  Thursday: {
    title: "Motus + Rest Day",
    blocks: [
      { time: "8:30 AM", activity: "Wake → Meds + Supplements. Black coffee.", tag: "routine" },
      { time: "9:00–10:00 AM", activity: "Fasting morning: walk, admin, school prep.", tag: "cardio" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1. Eggs + avocado toast + mixed greens.", tag: "meal" },
      { time: "12:00–4:30 PM", activity: "Motus — client calls, pipeline, credit work.", tag: "work" },
      { time: "4:30–5:30 PM", activity: "REST DAY. Walk for steps. Foam roll if sore.", tag: "rest" },
      { time: "6:00 PM", activity: "Dinner Feast: Meal 2. Beef (1/2x wk) + roasted potatoes + asparagus.", tag: "meal" },
      { time: "7:00–10:00 PM", activity: "Peak energy: Motus strategy, school assignments. Meal 3 at 9:30.", tag: "work" },
      { time: "10:00 PM", activity: "Wind down.", tag: "routine" },
      { time: "10:30 PM", activity: "Sleep.", tag: "sleep" },
    ],
  },
  Friday: {
    title: "Motus + Weekly Sync (3 PM) + Workout #3 (Shoulders & Back)",
    blocks: [
      { time: "8:30 AM", activity: "Wake → Meds + Supplements. Black coffee.", tag: "routine" },
      { time: "9:00–10:00 AM", activity: "Fasting morning: walk, prep for sync.", tag: "cardio" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1. Smoked salmon + cream cheese + toast.", tag: "meal" },
      { time: "12:00–2:45 PM", activity: "Motus — wrap-up tasks, prep sync agenda.", tag: "work" },
      { time: "3:00 PM", activity: "MOTUS WEEKLY SYNC MEETING", tag: "work" },
      { time: "3:30–5:00 PM", activity: "Post-sync wrap-up, planning next week.", tag: "work" },
      { time: "5:30–6:30 PM", activity: "WORKOUT #3: Shoulders & Back", tag: "gym" },
      { time: "6:45 PM", activity: "Dinner Feast: Meal 2. Fish tacos + avocado + black beans.", tag: "meal" },
      { time: "7:30–10:00 PM", activity: "Flex: lighter work or social time. Meal 3 at 9:30.", tag: "work" },
      { time: "10:00 PM", activity: "Wind down.", tag: "routine" },
      { time: "10:30 PM", activity: "Sleep.", tag: "sleep" },
    ],
  },
  Saturday: {
    title: "Workout #4 (Bonus) + Recovery + Life",
    blocks: [
      { time: "9:00 AM", activity: "Wake (sleep in — 9+ hrs). Meds + Supplements.", tag: "routine" },
      { time: "9:30 AM", activity: "Black coffee. Fasting holds if comfortable.", tag: "routine" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1. Loaded breakfast — eggs, veggies, avocado.", tag: "meal" },
      { time: "12:00–1:00 PM", activity: "WORKOUT #4: Bonus (core + neck + posterior chain)", tag: "gym" },
      { time: "1:30 PM", activity: "Post-workout shake or Meal 2.", tag: "meal" },
      { time: "2:00–5:00 PM", activity: "Meal prep, errands, pho restaurant, personal time.", tag: "personal" },
      { time: "6:00 PM", activity: "Dinner Feast. Grilled chicken + quinoa + Brussels sprouts.", tag: "meal" },
      { time: "7:00–10:00 PM", activity: "Social time, relaxation, no heavy work.", tag: "personal" },
      { time: "10:00 PM", activity: "Wind down.", tag: "routine" },
      { time: "10:30 PM", activity: "Sleep.", tag: "sleep" },
    ],
  },
  Sunday: {
    title: "Full Rest + Prep + Reset",
    blocks: [
      { time: "9:00 AM", activity: "Wake → Meds + Supplements.", tag: "routine" },
      { time: "9:30 AM", activity: "Black coffee. Fasting morning.", tag: "routine" },
      { time: "10:00–11:30 AM", activity: "Take mom to work", tag: "personal" },
      { time: "11:30 AM", activity: "Break fast: Meal 1. Overnight oats + protein + berries.", tag: "meal" },
      { time: "12:00–1:00 PM", activity: "Active recovery: walk, light stretching, foam roll.", tag: "rest" },
      { time: "1:00–3:00 PM", activity: "Meal prep for the week + grocery run.", tag: "personal" },
      { time: "3:00–5:00 PM", activity: "Week planning: calendar, Motus priorities, school prep.", tag: "work" },
      { time: "5:30 PM", activity: "Dinner Feast. Turkey burger + sweet potato fries + salad.", tag: "meal" },
      { time: "7:00–9:00 PM", activity: "Personal time, wind down mode. Meal 3 at 9:00.", tag: "personal" },
      { time: "10:00 PM", activity: "Melatonin + Magnesium + Tart Cherry.", tag: "routine" },
      { time: "10:30 PM", activity: "Sleep — protect 9+ hrs before Monday class.", tag: "sleep" },
    ],
  },
};

const DEFAULT_WORKOUTS = {
  "Workout #1 — Chest & Arms": {
    day: "Monday",
    note: "Shoulder-specific warmup: Band pull-aparts, face pulls, external rotations BEFORE pressing.",
    phases: {
      "Version A (Strength — 12 Weeks)": [
        { exercise: "Incline Bench Press", sets: "3 RPT (4-6, 6-8, 8-10)", method: "RPT", rest: "3 min", notes: "WARMUP: 60%×6, 75%×4, 90%×1-2" },
        { exercise: "Flat Bench / Weighted Dips", sets: "2 RPT (6-8, 8-10)", method: "RPT", rest: "3 min", notes: "Skip dips if shoulder flares." },
        { exercise: "Bicep Curls", sets: "3 RPT (4-6, 6-8, 6-8)", method: "RPT", rest: "2 min", notes: "Heaviest set first, drop 10%." },
        { exercise: "Triceps (Skull Crushers)", sets: "3 RPT (6-8, 8-10, 8-10)", method: "RPT", rest: "2 min", notes: "" },
        { exercise: "Face Pulls / Bent Over Flyes", sets: "12-15 + 3×(4-6)", method: "Rest Pause", rest: "10-15s", notes: "Rear delt health." },
      ],
      "Version B (Shrink Wrap — 4 Weeks)": [
        { exercise: "Incline DB Bench", sets: "3 RPT (6-8, 8-10, 8-10)", method: "RPT", rest: "3 min", notes: "Same warmup." },
        { exercise: "Machine Bench / Pushups", sets: "4 × 8-12", method: "Straight", rest: "45 sec", notes: "Pump focus." },
        { exercise: "Machine / Concentration Curls", sets: "5 × 6-8", method: "Straight", rest: "45 sec", notes: "High volume." },
        { exercise: "Tricep Pushdowns", sets: "5 × 8-10", method: "Straight", rest: "1 min", notes: "" },
        { exercise: "Bent Over Flyes", sets: "12-15 + 3×(4-6)", method: "Rest Pause", rest: "10-15s", notes: "" },
      ],
    },
  },
  "Workout #2 — Legs & Traps": {
    day: "Wednesday",
    note: "Front Squats & Bulgarian Splits safer for low back. RDLs fine — don't round. Skip if gout flares.",
    phases: {
      "Version A (Strength — 12 Weeks)": [
        { exercise: "Front Squats / BSS", sets: "4 × 6-8", method: "Kino Rep", rest: "2 min (3 last)", notes: "Start light, add each set." },
        { exercise: "RDLs / Nordic Curls", sets: "3 × 10-12", method: "Straight", rest: "2 min", notes: "Hinge > pull from floor." },
        { exercise: "Leg Extensions / Sissy Squats", sets: "3 × 8-12", method: "Straight", rest: "2 min", notes: "Same weight." },
        { exercise: "Calf Raises", sets: "3 × 12-15", method: "Straight", rest: "2 min", notes: "Full ROM, pause at bottom." },
        { exercise: "Trap Bar Shrugs", sets: "3 × 10-12", method: "Kino Rep", rest: "2 min", notes: "Start light, increase." },
      ],
      "Version B (Shrink Wrap — 4 Weeks)": [
        { exercise: "Step Ups", sets: "4 × 8-12", method: "Kino Rep", rest: "2 min", notes: "" },
        { exercise: "RDLs", sets: "4 × 8-12", method: "Kino Rep", rest: "2 min", notes: "" },
        { exercise: "ATG Split Squats", sets: "4 × 8-12", method: "Kino Rep", rest: "2 min", notes: "" },
        { exercise: "Seated Calf Raises", sets: "4 × 12-15", method: "Straight", rest: "2 min", notes: "" },
        { exercise: "Cable Shrugs", sets: "4 × 10-12", method: "Kino Rep", rest: "2 min", notes: "" },
      ],
    },
  },
  "Workout #3 — Shoulders & Back": {
    day: "Friday",
    note: "If overhead pressing causes shoulder pain, sub landmine press or high incline DB press.",
    phases: {
      "Version A (Strength — 12 Weeks)": [
        { exercise: "Standing Press / DB Press", sets: "3 RPT (4-6, 6-8, 8-10)", method: "RPT", rest: "3 min", notes: "WARMUP: 60%×6, 75%×4, 90%×1-2" },
        { exercise: "Weighted Pull-ups / Rows", sets: "2 RPT (5, 6) or 4×8-10", method: "RPT/Kino", rest: "3 min", notes: "Rows if pull-ups not tolerated." },
        { exercise: "Side-to-Side Push Ups / Flyes", sets: "3 × 6-8/side", method: "Straight", rest: "2 min", notes: "" },
        { exercise: "Hammer / Rope Curls", sets: "3 × 8-12", method: "Straight", rest: "2 min", notes: "" },
        { exercise: "Lateral Raises", sets: "12-15 + 3×(4-6)", method: "Rest Pause", rest: "10-15s", notes: "Key for shoulder width." },
      ],
      "Version B (Shrink Wrap — 4 Weeks)": [
        { exercise: "DB Shoulder Press", sets: "2 RPT (6-8, 8-10)", method: "RPT", rest: "3 min", notes: "Superset w/ Arnold Press." },
        { exercise: "Weighted Pull-ups", sets: "2 RPT (6, 8)", method: "RPT", rest: "3 min", notes: "Superset w/ Sternum Pull-ups." },
        { exercise: "Incline Press Flye", sets: "4 × 8-10", method: "Straight", rest: "45 sec", notes: "" },
        { exercise: "Hammer Rope Curls", sets: "4 × 8-12", method: "Straight", rest: "45 sec", notes: "" },
        { exercise: "Lateral Raises", sets: "12-15 + 3×(4-6)", method: "Rest Pause", rest: "10-15s", notes: "" },
      ],
    },
  },
  "Workout #4 — Bonus (Saturday)": {
    day: "Saturday",
    note: "Core, neck, posterior chain. 1-Leg Back Extension critical for low back health.",
    phases: {
      "All Phases": [
        { exercise: "Hanging Knee Raises", sets: "3 × 8-12", method: "Straight", rest: "2 min", notes: "Add weight when easy." },
        { exercise: "Ab Wheel Rollout", sets: "3 × 10-15", method: "Straight", rest: "2 min", notes: "Core stability." },
        { exercise: "1-Leg Back Ext / Hip Thrust", sets: "3 × 10-15", method: "Straight", rest: "2 min", notes: "Key for low back." },
        { exercise: "Neck Curls", sets: "3 × 15-20", method: "Straight", rest: "1 min", notes: "Add weight slowly." },
        { exercise: "Reverse Neck Curls", sets: "3 × 15-20", method: "Straight", rest: "1 min", notes: "" },
      ],
    },
  },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TAG_COLORS = {
  routine: { bg: "#1a1a2e", border: "#334155", text: "#94a3b8" },
  school: { bg: "#172554", border: "#1d4ed8", text: "#60a5fa" },
  personal: { bg: "#1c1917", border: "#78716c", text: "#a8a29e" },
  meal: { bg: "#052e16", border: "#15803d", text: "#4ade80" },
  work: { bg: "#2a1800", border: "#c2410c", text: "#fb923c" },
  gym: { bg: "#3b0764", border: "#9333ea", text: "#c084fc" },
  cardio: { bg: "#042f2e", border: "#0d9488", text: "#2dd4bf" },
  rest: { bg: "#1e1b4b", border: "#6366f1", text: "#a5b4fc" },
  sleep: { bg: "#0c0a09", border: "#44403c", text: "#78716c" },
};

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const STORAGE_KEY = "sonny_plan_v3";

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

async function loadCloudData(userId) {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (e) {
    console.error("Error loading cloud data:", e);
  }
  return null;
}

async function saveCloudData(userId, data) {
  try {
    const docRef = doc(db, "users", userId);
    await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("Error saving cloud data:", e);
  }
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function EditableCell({ value, onChange, multiline, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const ref = useRef(null);

  useEffect(() => { setTemp(value); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  if (editing) {
    const Tag = multiline ? "textarea" : "input";
    return (
      <Tag
        ref={ref}
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={() => { setEditing(false); if (temp !== value) onChange(temp); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !multiline) { setEditing(false); if (temp !== value) onChange(temp); } if (e.key === "Escape") { setEditing(false); setTemp(value); } }}
        className={className}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 4,
          color: "#e2e8f0",
          padding: "4px 8px",
          fontSize: "inherit",
          fontFamily: "inherit",
          width: "100%",
          resize: multiline ? "vertical" : "none",
          minHeight: multiline ? 60 : "auto",
          outline: "none",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        cursor: "pointer",
        borderBottom: "1px dashed rgba(255,255,255,0.1)",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.target.style.borderBottomColor = "rgba(255,255,255,0.3)")}
      onMouseLeave={(e) => (e.target.style.borderBottomColor = "rgba(255,255,255,0.1)")}
      title="Click to edit"
    >
      {value || "—"}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = (status || "").toUpperCase();
  let color = "#4ade80";
  if (s.includes("HIGH") || s.includes("DEFICIENT")) color = "#ef4444";
  else if (s.includes("BORDERLINE") || s.includes("WATCH") || s.includes("LOW")) color = "#f59e0b";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.5px",
        background: color + "18",
        color: color,
        border: `1px solid ${color}44`,
      }}
    >
      {status}
    </span>
  );
}

function TagBadge({ tag }) {
  const c = TAG_COLORS[tag] || TAG_COLORS.routine;
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {tag}
    </span>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [tab, setTab] = useState("schedule");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [meds, setMeds] = useState(DEFAULT_MEDS);
  const [supps, setSupps] = useState(DEFAULT_SUPPS);
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [labs, setLabs] = useState(DEFAULT_LABS);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [workouts, setWorkouts] = useState(DEFAULT_WORKOUTS);
  const [selectedDay, setSelectedDay] = useState(() => DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [selectedWorkout, setSelectedWorkout] = useState(Object.keys(DEFAULT_WORKOUTS)[0]);
  const [selectedPhase, setSelectedPhase] = useState("Version A (Strength — 12 Weeks)");
  const [workoutLogs, setWorkoutLogs] = useState({});
  const [groceries, setGroceries] = useState(DEFAULT_GROCERIES);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [undoStack, setUndoStack] = useState([]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load from cloud first, fallback to local
        setSyncing(true);
        const cloudData = await loadCloudData(currentUser.uid);
        if (cloudData) {
          setProfile(cloudData.profile || DEFAULT_PROFILE);
          setMeds(cloudData.meds || DEFAULT_MEDS);
          setSupps(cloudData.supps || DEFAULT_SUPPS);
          setConditions(cloudData.conditions || DEFAULT_CONDITIONS);
          setLabs(cloudData.labs || DEFAULT_LABS);
          setTargets(cloudData.targets || DEFAULT_TARGETS);
          setSchedule(cloudData.schedule || DEFAULT_SCHEDULE);
          setWorkouts(cloudData.workouts || DEFAULT_WORKOUTS);
          setWorkoutLogs(cloudData.workoutLogs || {});
          setGroceries(cloudData.groceries || DEFAULT_GROCERIES);
          setNotes(cloudData.notes || "");
        } else {
          // First time: load local data and sync to cloud
          const localData = loadLocalData();
          if (localData) {
            setProfile(localData.profile || DEFAULT_PROFILE);
            setMeds(localData.meds || DEFAULT_MEDS);
            setSupps(localData.supps || DEFAULT_SUPPS);
            setConditions(localData.conditions || DEFAULT_CONDITIONS);
            setLabs(localData.labs || DEFAULT_LABS);
            setTargets(localData.targets || DEFAULT_TARGETS);
            setSchedule(localData.schedule || DEFAULT_SCHEDULE);
            setWorkouts(localData.workouts || DEFAULT_WORKOUTS);
            setWorkoutLogs(localData.workoutLogs || {});
            setGroceries(localData.groceries || DEFAULT_GROCERIES);
            setNotes(localData.notes || "");
          }
        }
        setSyncing(false);
      } else {
        // Not logged in: load from local storage
        const localData = loadLocalData();
        if (localData) {
          setProfile(localData.profile || DEFAULT_PROFILE);
          setMeds(localData.meds || DEFAULT_MEDS);
          setSupps(localData.supps || DEFAULT_SUPPS);
          setConditions(localData.conditions || DEFAULT_CONDITIONS);
          setLabs(localData.labs || DEFAULT_LABS);
          setTargets(localData.targets || DEFAULT_TARGETS);
          setSchedule(localData.schedule || DEFAULT_SCHEDULE);
          setWorkouts(localData.workouts || DEFAULT_WORKOUTS);
          setWorkoutLogs(localData.workoutLogs || {});
          setNotes(localData.notes || "");
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auto-save (local + cloud if logged in)
  useEffect(() => {
    if (loading) return;
    const data = { profile, meds, supps, conditions, labs, targets, schedule, workouts, workoutLogs, groceries, notes };
    const timer = setTimeout(() => {
      saveLocalData(data);
      if (user) {
        saveCloudData(user.uid, data);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [profile, meds, supps, conditions, labs, targets, schedule, workouts, workoutLogs, groceries, notes, user, loading]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const updateProfile = (key, val) => setProfile((p) => ({ ...p, [key]: val }));
  const updateMed = (i, key, val) => setMeds((m) => m.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const updateSupp = (i, key, val) => setSupps((s) => s.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const updateCondition = (i, key, val) => setConditions((c) => c.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const updateLab = (i, key, val) => setLabs((l) => l.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const updateTarget = (i, key, val) => {
    setTargets((t) => t.map((x, j) => {
      if (j !== i) return x;
      const updated = { ...x, [key]: val };
      // Auto-generate "how" when current or target changes, unless user manually edited "how"
      if (key === "current" || key === "target" || key === "metric") {
        const autoHow = generateHow(updated.metric, updated.current, updated.target);
        if (autoHow) {
          updated.how = autoHow;
          updated._autoHow = true;
        }
      }
      if (key === "how") {
        updated._autoHow = false; // User manually edited, stop auto-generating
      }
      return updated;
    }));
  };
  const updateBlock = (day, i, key, val) => {
    setSchedule((s) => ({
      ...s,
      [day]: { ...s[day], blocks: s[day].blocks.map((b, j) => (j === i ? { ...b, [key]: val } : b)) },
    }));
  };

  const addRow = (setter, template) => setter((arr) => [...arr, template]);
  const removeRow = (setter, i) => setter((arr) => arr.filter((_, j) => j !== i));
  const removeTarget = (i) => {
    setUndoStack((stack) => [...stack, { type: "remove", index: i, item: targets[i] }]);
    setTargets((arr) => arr.filter((_, j) => j !== i));
  };
  const undoTarget = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    if (last.type === "remove") {
      setTargets((arr) => {
        const copy = [...arr];
        copy.splice(last.index, 0, last.item);
        return copy;
      });
    } else if (last.type === "reset") {
      setTargets(last.previous);
    }
  };
  const resetTargets = () => {
    setUndoStack((stack) => [...stack, { type: "reset", previous: [...targets] }]);
    setTargets(DEFAULT_TARGETS);
  };

  const tabs = [
    { id: "schedule", label: "Schedule", icon: "📅" },
    { id: "workouts", label: "Training", icon: "🏋️" },
    { id: "health", label: "Health", icon: "🩺" },
    { id: "nutrition", label: "Nutrition", icon: "🥩" },
    { id: "groceries", label: "Groceries", icon: "🛒" },
    { id: "targets", label: "90-Day", icon: "🎯" },
  ];

  const currentDayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Performance Platform</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#09090b",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(180deg, #0f0f13 0%, #09090b 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 24px 0",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#4ade80", boxShadow: "0 0 8px #4ade8066",
                }}/>
                <h1 style={{
                  margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {profile.name}
                </h1>
              </div>
              <p style={{ margin: "4px 0 0 18px", fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                Weekly Performance Plan v3.0 — {profile.program}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {syncing && (
                <span style={{ fontSize: 11, color: "#60a5fa" }}>Syncing...</span>
              )}
              {user ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)",
                    borderRadius: 8, padding: "4px 10px",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                    <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 500 }}>Synced</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "#94a3b8", borderRadius: 8, padding: "6px 12px", fontSize: 12,
                      cursor: "pointer", fontWeight: 500,
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  style={{
                    background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)",
                    color: "#60a5fa", borderRadius: 8, padding: "6px 12px", fontSize: 12,
                    cursor: "pointer", fontWeight: 600,
                  }}
                >
                  Sign In to Sync
                </button>
              )}
              <button
                onClick={() => setShowNotes(!showNotes)}
                style={{
                  background: showNotes ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${showNotes ? "#fbbf2444" : "rgba(255,255,255,0.08)"}`,
                  color: showNotes ? "#fbbf24" : "#94a3b8",
                  borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer",
                  fontWeight: 600, transition: "all 0.2s",
                }}
              >
                📝 Notes
              </button>
              <button
                onClick={() => {
                  if (confirm("Reset all data to defaults?")) {
                    localStorage.removeItem(STORAGE_KEY);
                    location.reload();
                  }
                }}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#64748b", borderRadius: 8, padding: "6px 12px", fontSize: 12,
                  cursor: "pointer", fontWeight: 500,
                }}
              >
                ↺ Reset
              </button>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "10px 18px",
                  background: tab === t.id ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none",
                  borderBottom: tab === t.id ? "2px solid #e2e8f0" : "2px solid transparent",
                  color: tab === t.id ? "#e2e8f0" : "#64748b",
                  fontSize: 13,
                  fontWeight: tab === t.id ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  borderRadius: "8px 8px 0 0",
                }}
              >
                <span style={{ marginRight: 6 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* NOTES PANEL */}
      {showNotes && (
        <div style={{
          maxWidth: 1100, margin: "16px auto", padding: "0 24px",
        }}>
          <div style={{
            background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)",
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>
              📝 Quick Notes
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jot down anything — thoughts, adjustments, reminders..."
              style={{
                width: "100%", minHeight: 80, background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                color: "#e2e8f0", padding: 12, fontSize: 13, fontFamily: "inherit",
                resize: "vertical", outline: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px" }}>

        {/* ─── SCHEDULE TAB ─────────────────────────────────────────────── */}
        {tab === "schedule" && (
          <div>
            {/* Day selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {DAYS.map((d, i) => {
                const isToday = i === currentDayIdx;
                const sel = d === selectedDay;
                const hasGym = schedule[d]?.blocks?.some((b) => b.tag === "gym");
                const hasSchool = schedule[d]?.blocks?.some((b) => b.tag === "school");
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    style={{
                      flex: 1, minWidth: 90,
                      padding: "10px 8px",
                      background: sel ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                      border: sel ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: sel ? "#e2e8f0" : "#64748b", letterSpacing: "0.5px" }}>
                      {d.slice(0, 3).toUpperCase()}
                    </div>
                    <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 4 }}>
                      {hasGym && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c084fc" }} />}
                      {hasSchool && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa" }} />}
                    </div>
                    {isToday && (
                      <div style={{
                        position: "absolute", top: -4, right: -4,
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#4ade80", boxShadow: "0 0 6px #4ade8066",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Day content */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                  {selectedDay}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  {schedule[selectedDay]?.title}
                </div>
              </div>
              <div style={{ padding: "8px 0" }}>
                {schedule[selectedDay]?.blocks?.map((block, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 1fr 70px 28px",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 20px",
                      borderBottom: i < schedule[selectedDay].blocks.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                      <EditableCell value={block.time} onChange={(v) => updateBlock(selectedDay, i, "time", v)} />
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <EditableCell value={block.activity} onChange={(v) => updateBlock(selectedDay, i, "activity", v)} />
                    </div>
                    <TagBadge tag={block.tag} />
                    <button
                      onClick={() => {
                        setSchedule((s) => ({
                          ...s,
                          [selectedDay]: {
                            ...s[selectedDay],
                            blocks: s[selectedDay].blocks.filter((_, j) => j !== i),
                          },
                        }));
                      }}
                      style={{
                        background: "none", border: "none", color: "#ef444466",
                        cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1,
                        opacity: 0.4, transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.opacity = 1)}
                      onMouseLeave={(e) => (e.target.style.opacity = 0.4)}
                      title="Remove block"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <button
                  onClick={() => {
                    setSchedule((s) => ({
                      ...s,
                      [selectedDay]: {
                        ...s[selectedDay],
                        blocks: [...s[selectedDay].blocks, { time: "—", activity: "New block", tag: "routine" }],
                      },
                    }));
                  }}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)",
                    color: "#64748b", borderRadius: 8, padding: "8px 16px",
                    fontSize: 12, cursor: "pointer", fontWeight: 500,
                    width: "100%", transition: "all 0.2s",
                  }}
                >
                  + Add block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── WORKOUTS TAB ─────────────────────────────────────────────── */}
        {tab === "workouts" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.keys(workouts).map((w) => (
                <button
                  key={w}
                  onClick={() => {
                    setSelectedWorkout(w);
                    setSelectedPhase(Object.keys(workouts[w].phases)[0]);
                  }}
                  style={{
                    padding: "8px 14px",
                    background: w === selectedWorkout ? "#c084fc18" : "rgba(255,255,255,0.02)",
                    border: w === selectedWorkout ? "1px solid #9333ea44" : "1px solid rgba(255,255,255,0.05)",
                    color: w === selectedWorkout ? "#c084fc" : "#64748b",
                    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {w}
                </button>
              ))}
            </div>

            {workouts[selectedWorkout] && (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14, overflow: "hidden",
              }}>
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(147,51,234,0.04)",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedWorkout}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{workouts[selectedWorkout].day} — {workouts[selectedWorkout].note}</div>
                </div>

                {/* Phase selector */}
                <div style={{ display: "flex", gap: 4, padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {Object.keys(workouts[selectedWorkout].phases).map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPhase(p)}
                      style={{
                        padding: "6px 12px",
                        background: p === selectedPhase ? "rgba(255,255,255,0.08)" : "transparent",
                        border: p === selectedPhase ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                        color: p === selectedPhase ? "#e2e8f0" : "#64748b",
                        borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Exercises */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Exercise", "Sets × Reps", "Method", "Rest", "Notes", "Weight Log"].map((h) => (
                          <th key={h} style={{
                            padding: "10px 16px", textAlign: "left", fontSize: 10,
                            fontWeight: 700, letterSpacing: "1px", color: "#64748b",
                            textTransform: "uppercase",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(workouts[selectedWorkout].phases[selectedPhase] || []).map((ex, i) => {
                        const logKey = `${selectedWorkout}|${selectedPhase}|${ex.exercise}`;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                            <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500 }}>{ex.exercise}</td>
                            <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" }}>{ex.sets}</td>
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: 4,
                                fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
                                background: ex.method === "RPT" ? "#c084fc18" : ex.method === "Kino Rep" ? "#4ade8018" : "#f59e0b18",
                                color: ex.method === "RPT" ? "#c084fc" : ex.method === "Kino Rep" ? "#4ade80" : "#f59e0b",
                                border: `1px solid ${ex.method === "RPT" ? "#9333ea44" : ex.method === "Kino Rep" ? "#15803d44" : "#d9770644"}`,
                              }}>
                                {ex.method}
                              </span>
                            </td>
                            <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{ex.rest}</td>
                            <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>{ex.notes}</td>
                            <td style={{ padding: "10px 16px" }}>
                              <input
                                value={workoutLogs[logKey] || ""}
                                onChange={(e) => setWorkoutLogs((l) => ({ ...l, [logKey]: e.target.value }))}
                                placeholder="e.g. 185×6"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 6, padding: "4px 8px",
                                  color: "#4ade80", fontSize: 12,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  width: 90, outline: "none",
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Progression rules */}
                <div style={{
                  padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.015)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: 8 }}>PROGRESSION</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    <strong style={{ color: "#c084fc" }}>RPT:</strong> Hit top of rep range on heaviest set → add weight next session.{" "}
                    <strong style={{ color: "#4ade80" }}>Kino Rep:</strong> Hit top reps on LAST set → increase that set's weight.{" "}
                    <strong style={{ color: "#f59e0b" }}>Rest Pause:</strong> Total reps exceed target → add 5 lbs.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── HEALTH TAB ───────────────────────────────────────────────── */}
        {tab === "health" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Profile */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.5px" }}>Profile</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 0 }}>
                {Object.entries(profile).map(([key, val]) => (
                  <div key={key} style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 2 }}>
                      {key.replace(/([A-Z])/g, " $1")}
                    </div>
                    <EditableCell value={val} onChange={(v) => updateProfile(key, v)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Conditions */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Health Conditions</span>
                <button onClick={() => addRow(setConditions, { condition: "New", date: "—", impact: "—" })}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                  + Add
                </button>
              </div>
              {conditions.map((c, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 80px 1fr 28px", gap: 12, padding: "10px 20px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}><EditableCell value={c.condition} onChange={(v) => updateCondition(i, "condition", v)} /></div>
                  <div style={{ fontSize: 12, color: "#64748b" }}><EditableCell value={c.date} onChange={(v) => updateCondition(i, "date", v)} /></div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}><EditableCell value={c.impact} onChange={(v) => updateCondition(i, "impact", v)} /></div>
                  <button onClick={() => removeRow(setConditions, i)} style={{ background: "none", border: "none", color: "#ef444466", cursor: "pointer", fontSize: 14, opacity: 0.4 }}
                    onMouseEnter={(e) => (e.target.style.opacity = 1)} onMouseLeave={(e) => (e.target.style.opacity = 0.4)}>×</button>
                </div>
              ))}
            </div>

            {/* Labs */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Lab Results (Oct 24, 2025)</span>
                <button onClick={() => addRow(setLabs, { test: "New", result: "—", unit: "", ref: "—", status: "—", action: "" })}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                  + Add
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Test", "Result", "Ref Range", "Status", "Action", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labs.map((l, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500 }}><EditableCell value={l.test} onChange={(v) => updateLab(i, "test", v)} /></td>
                        <td style={{ padding: "8px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                          <EditableCell value={l.result} onChange={(v) => updateLab(i, "result", v)} />
                          <span style={{ color: "#64748b", fontSize: 11, marginLeft: 4 }}>{l.unit}</span>
                        </td>
                        <td style={{ padding: "8px 16px", fontSize: 12, color: "#64748b" }}>{l.ref}</td>
                        <td style={{ padding: "8px 16px" }}><StatusBadge status={l.status} /></td>
                        <td style={{ padding: "8px 16px", fontSize: 12, color: "#94a3b8" }}><EditableCell value={l.action} onChange={(v) => updateLab(i, "action", v)} /></td>
                        <td style={{ padding: "8px 16px" }}>
                          <button onClick={() => removeRow(setLabs, i)} style={{ background: "none", border: "none", color: "#ef444466", cursor: "pointer", fontSize: 14, opacity: 0.4 }}
                            onMouseEnter={(e) => (e.target.style.opacity = 1)} onMouseLeave={(e) => (e.target.style.opacity = 0.4)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Medications */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Medications</span>
                <button onClick={() => addRow(setMeds, { name: "New", timing: "—", purpose: "—", notes: "" })}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                  + Add
                </button>
              </div>
              {meds.map((m, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 120px 120px 1fr 28px", gap: 12, padding: "10px 20px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}><EditableCell value={m.name} onChange={(v) => updateMed(i, "name", v)} /></div>
                  <div style={{ fontSize: 12, color: "#64748b" }}><EditableCell value={m.timing} onChange={(v) => updateMed(i, "timing", v)} /></div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}><EditableCell value={m.purpose} onChange={(v) => updateMed(i, "purpose", v)} /></div>
                  <div style={{ fontSize: 12, color: "#78716c" }}><EditableCell value={m.notes} onChange={(v) => updateMed(i, "notes", v)} /></div>
                  <button onClick={() => removeRow(setMeds, i)} style={{ background: "none", border: "none", color: "#ef444466", cursor: "pointer", fontSize: 14, opacity: 0.4 }}
                    onMouseEnter={(e) => (e.target.style.opacity = 1)} onMouseLeave={(e) => (e.target.style.opacity = 0.4)}>×</button>
                </div>
              ))}
            </div>

            {/* Supplements */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Supplement Stack</span>
                <button onClick={() => addRow(setSupps, { name: "New", dose: "—", when: "—", why: "" })}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                  + Add
                </button>
              </div>
              {supps.map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 100px 140px 1fr 28px", gap: 12, padding: "10px 20px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}><EditableCell value={s.name} onChange={(v) => updateSupp(i, "name", v)} /></div>
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#4ade80" }}><EditableCell value={s.dose} onChange={(v) => updateSupp(i, "dose", v)} /></div>
                  <div style={{ fontSize: 12, color: "#64748b" }}><EditableCell value={s.when} onChange={(v) => updateSupp(i, "when", v)} /></div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}><EditableCell value={s.why} onChange={(v) => updateSupp(i, "why", v)} /></div>
                  <button onClick={() => removeRow(setSupps, i)} style={{ background: "none", border: "none", color: "#ef444466", cursor: "pointer", fontSize: 14, opacity: 0.4 }}
                    onMouseEnter={(e) => (e.target.style.opacity = 1)} onMouseLeave={(e) => (e.target.style.opacity = 0.4)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── NUTRITION TAB ─────────────────────────────────────────────── */}
        {tab === "nutrition" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Calorie framework */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Calorie Framework</span>
                <span style={{ fontSize: 11, color: "#64748b", marginLeft: 12 }}>Based on goal weight 185–190 lbs</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
                {[
                  { phase: "Aggressive Cut", formula: "Goal BW × 15 − 600", cal: "~2,150/day", when: "Rapid fat loss only", accent: "#ef4444" },
                  { phase: "Standard Cut", formula: "Goal BW × 15 − 400", cal: "~2,350/day", when: "Primary fat loss (start here)", accent: "#f59e0b" },
                  { phase: "Recomposition", formula: "Goal BW × 15 − 200", cal: "~2,550/day", when: "Body recomp + muscle", accent: "#4ade80" },
                ].map((p, i) => (
                  <div key={i} style={{
                    padding: 20,
                    borderRight: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: p.accent, letterSpacing: "0.5px", marginBottom: 8 }}>{p.phase}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#e2e8f0" }}>{p.cal}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{p.formula}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontStyle: "italic" }}>{p.when}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Macros */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Daily Macro Targets</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { macro: "Protein", target: "~172g", note: "0.82g/lb. Prioritize at every meal.", color: "#ef4444" },
                  { macro: "Carbs", target: "~250–300g", note: "Save majority for dinner + post-workout.", color: "#f59e0b" },
                  { macro: "Fats", target: "~70–80g", note: "Olive oil, avocado, nuts, fish.", color: "#4ade80" },
                ].map((m, i) => (
                  <div key={i} style={{
                    background: `${m.color}08`, border: `1px solid ${m.color}22`,
                    borderRadius: 10, padding: 16, textAlign: "center",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: m.color, letterSpacing: "1px" }}>{m.macro.toUpperCase()}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", margin: "8px 0", color: "#e2e8f0" }}>{m.target}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal structure */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Meal Structure (Intermittent Fasting)</span>
                <span style={{ fontSize: 11, color: "#64748b", marginLeft: 12 }}>4–6 hour fasting window in morning</span>
              </div>
              {[
                { meal: "Meal 1 (Break Fast)", pct: "20–25%", time: "~12:00–1:00 PM", what: "Light: protein + fruit + small carb. Greek yogurt, eggs, lean meat." },
                { meal: "Meal 2 (Dinner Feast)", pct: "50–60%", time: "~6:30–7:30 PM", what: "Big meal: protein + carbs + veggies + fats. Main fuel." },
                { meal: "Meal 3 (Late Night)", pct: "15–20%", time: "~9:00–9:30 PM", what: "Light: cottage cheese, protein shake, fruit, dark chocolate." },
              ].map((m, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 70px 120px 1fr", gap: 12, padding: "12px 20px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.meal}</div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                    color: m.pct.startsWith("50") ? "#4ade80" : "#94a3b8", fontWeight: 600,
                  }}>{m.pct}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{m.time}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{m.what}</div>
                </div>
              ))}
            </div>

            {/* VA mods */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>VA-Specific Nutrition Mods</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Gout", text: "Red meat max 2x/week. No organ meats, shellfish. Zero beer. Replace with chicken, turkey, salmon, eggs.", color: "#ef4444" },
                  { label: "Liver", text: "Zero alcohol 30 days. Cruciferous veggies daily (broccoli, cauliflower). Minimize processed foods.", color: "#f59e0b" },
                  { label: "Glucose", text: "Protein + fat first at every meal, carbs last. Walk 10–15 min after dinner. No juice, soda, candy.", color: "#fb923c" },
                  { label: "Folate", text: "Spinach, asparagus, Brussels sprouts, lentils, avocado. 2+ servings dark leafy greens daily.", color: "#4ade80" },
                  { label: "Hydration", text: "100oz+ water daily. Non-negotiable (gout + polycythemia). 40oz bottle, refill 3x. Extra during training.", color: "#60a5fa" },
                ].map((n, i) => (
                  <div key={i} style={{
                    background: `${n.color}08`, border: `1px solid ${n.color}18`,
                    borderRadius: 10, padding: "12px 16px",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: n.color, letterSpacing: "0.5px", marginBottom: 6 }}>{n.label.toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{n.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── GROCERIES TAB ───────────────────────────────────────────────── */}
        {tab === "groceries" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Header with reset and clear */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Weekly Grocery List</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Based on your nutrition targets — check off items as you shop</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    const cleared = {};
                    Object.keys(groceries).forEach(cat => {
                      cleared[cat] = groceries[cat].map(item => ({ ...item, have: false }));
                    });
                    setGroceries(cleared);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "6px 12px", cursor: "pointer",
                  }}
                >
                  Clear All
                </button>
                <button
                  onClick={() => setGroceries(DEFAULT_GROCERIES)}
                  style={{
                    background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                    borderRadius: 6, color: "#60a5fa", fontSize: 11, padding: "6px 12px", cursor: "pointer",
                  }}
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {/* Avoid list */}
            <div style={{
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 10, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", letterSpacing: "0.5px", marginBottom: 6 }}>AVOID (VA MODS)</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Red meat (max 2x/wk) • Shellfish & organ meats (gout) • Alcohol (liver) • Juice, soda, candy (glucose) • Processed foods
              </div>
            </div>

            {/* Category sections */}
            {[
              { key: "proteins", label: "Proteins", color: "#ef4444", icon: "🥩" },
              { key: "carbs", label: "Carbs", color: "#f59e0b", icon: "🍚" },
              { key: "vegetables", label: "Vegetables", color: "#4ade80", icon: "🥬" },
              { key: "fats", label: "Healthy Fats", color: "#60a5fa", icon: "🥑" },
              { key: "fruits", label: "Fruits", color: "#c084fc", icon: "🍇" },
              { key: "other", label: "Other", color: "#94a3b8", icon: "🛒" },
            ].map(({ key, label, color, icon }) => (
              <div key={key} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14, overflow: "hidden",
              }}>
                <div style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  background: `${color}08`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      ({groceries[key]?.filter(i => i.have).length}/{groceries[key]?.length})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setGroceries(g => ({
                        ...g,
                        [key]: [...g[key], { item: "New item", qty: "—", notes: "", have: false }]
                      }));
                    }}
                    style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 10px", cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                </div>
                <div>
                  {groceries[key]?.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 1fr 100px 1fr 28px",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 20px",
                        borderBottom: i < groceries[key].length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                        opacity: item.have ? 0.5 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.have}
                        onChange={(e) => {
                          setGroceries(g => ({
                            ...g,
                            [key]: g[key].map((x, j) => j === i ? { ...x, have: e.target.checked } : x)
                          }));
                        }}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: color }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 500, textDecoration: item.have ? "line-through" : "none" }}>
                        <EditableCell
                          value={item.item}
                          onChange={(v) => {
                            setGroceries(g => ({
                              ...g,
                              [key]: g[key].map((x, j) => j === i ? { ...x, item: v } : x)
                            }));
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
                        <EditableCell
                          value={item.qty}
                          onChange={(v) => {
                            setGroceries(g => ({
                              ...g,
                              [key]: g[key].map((x, j) => j === i ? { ...x, qty: v } : x)
                            }));
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        <EditableCell
                          value={item.notes}
                          onChange={(v) => {
                            setGroceries(g => ({
                              ...g,
                              [key]: g[key].map((x, j) => j === i ? { ...x, notes: v } : x)
                            }));
                          }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          setGroceries(g => ({
                            ...g,
                            [key]: g[key].filter((_, j) => j !== i)
                          }));
                        }}
                        style={{
                          background: "none", border: "none", color: "#ef444466",
                          cursor: "pointer", fontSize: 14, opacity: 0.4,
                        }}
                        onMouseEnter={(e) => (e.target.style.opacity = 1)}
                        onMouseLeave={(e) => (e.target.style.opacity = 0.4)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Meal prep reminder */}
            <div style={{
              background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)",
              borderRadius: 10, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", letterSpacing: "0.5px", marginBottom: 6 }}>SUNDAY MEAL PREP</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                1. Cook 4 lbs chicken (season half differently) • 2. Make big batch rice + quinoa • 3. Roast sweet potatoes + Brussels sprouts • 4. Prep overnight oats (3-4 jars) • 5. Wash/portion greens
              </div>
            </div>
          </div>
        )}

        {/* ─── TARGETS TAB ───────────────────────────────────────────────── */}
        {tab === "targets" && (
          <div>
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>90-Day Targets</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {undoStack.length > 0 && (
                    <button onClick={undoTarget}
                      style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.25)", borderRadius: 6, color: "#facc15", fontSize: 11, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      ↩ Undo {undoStack.length > 1 ? `(${undoStack.length})` : ""}
                    </button>
                  )}
                  <button onClick={resetTargets}
                    style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, color: "#60a5fa", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                    ↻ Reset Defaults
                  </button>
                  <button onClick={() => addRow(setTargets, { metric: "New", current: "—", target: "—", how: "" })}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                    + Add Target
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Metric", "Current", "Target", "How", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}><EditableCell value={t.metric} onChange={(v) => updateTarget(i, "metric", v)} /></td>
                        <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#ef4444" }}>
                          <EditableCell value={t.current} onChange={(v) => updateTarget(i, "current", v)} />
                        </td>
                        <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#4ade80" }}>
                          <EditableCell value={t.target} onChange={(v) => updateTarget(i, "target", v)} />
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                            {t._autoHow !== false && <span title="Auto-generated" style={{ fontSize: 10, opacity: 0.5, flexShrink: 0, marginTop: 2 }}>⚡</span>}
                            <EditableCell value={t.how} onChange={(v) => updateTarget(i, "how", v)} />
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <button onClick={() => removeTarget(i)} style={{ background: "none", border: "none", color: "#ef444466", cursor: "pointer", fontSize: 14, opacity: 0.4 }}
                            onMouseEnter={(e) => (e.target.style.opacity = 1)} onMouseLeave={(e) => (e.target.style.opacity = 0.4)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mental Health */}
            <div style={{
              marginTop: 20,
              background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)",
              borderRadius: 14, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Mental Health Integration</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { title: "PHQ-9 Trend", text: "18 → 15 → 12. Heading right. Target: below 10." },
                  { title: "Exercise as Antidepressant", text: "3x/week heavy training = as effective as adding a second med." },
                  { title: "Vitamin D + Depression", text: "At 16.7, deficiency directly contributes to symptoms. Getting above 40 improves mood." },
                  { title: "Folate + SSRIs", text: "Low folate reduces Sertraline effectiveness. Methylfolate enhances SSRI response." },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{
        textAlign: "center", padding: "20px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        fontSize: 11, color: "#334155",
      }}>
        Weekly Performance Plan v3.0 — Kinobody Movie Star Integration + VA Medical Data — Feb 2026
      </div>
    </div>
  );
}
