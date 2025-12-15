// app/api/estimate/route.ts
import { NextResponse } from "next/server";

type ExcavatorPayload = {
  brand?: string;
  model?: string;
  year?: number;
  hours?: number;
  weightClass?: "1-3t" | "4-6t" | "7-10t" | "11-15t" | "16-20t" | "21-30t" | "30t+";
  undercarriage?: "Rubber tracks" | "Steel tracks" | "Wheeled";
  quickCoupler?: boolean;
  rototilt?: boolean;
  condition?: "Excellent" | "Good" | "OK" | "Needs work";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function weightBase(weightClass?: ExcavatorPayload["weightClass"]) {
  switch (weightClass) {
    case "1-3t": return 250_000;
    case "4-6t": return 450_000;
    case "7-10t": return 650_000;
    case "11-15t": return 900_000;
    case "16-20t": return 1_200_000;
    case "21-30t": return 1_650_000;
    case "30t+": return 2_200_000;
    default: return 650_000;
  }
}

function conditionFactor(c?: ExcavatorPayload["condition"]) {
  switch (c) {
    case "Excellent": return 1.1;
    case "Good": return 1.0;
    case "OK": return 0.9;
    case "Needs work": return 0.75;
    default: return 1.0;
  }
}

export async function POST(req: Request) {
  try {
    const { machine_type, payload } = await req.json();

    if (machine_type !== "excavator") {
      return NextResponse.json({ ok: false, error: "Unsupported machine_type" }, { status: 400 });
    }

    const p = (payload ?? {}) as ExcavatorPayload;

    const base = weightBase(p.weightClass);
    const year = p.year ?? 2015;
    const hours = p.hours ?? 6000;

    // År: nyare = dyrare (max/min)
    const yearFactor = clamp(1 + (year - 2015) * 0.03, 0.65, 1.6);

    // Timmar: fler = billigare
    const hourFactor = clamp(1 - (hours - 6000) / 20000, 0.55, 1.25);

    // Utrustning
    const equip =
      (p.quickCoupler ? 0.06 : 0) +
      (p.rototilt ? 0.12 : 0) +
      (p.undercarriage === "Wheeled" ? 0.05 : 0);

    const cond = conditionFactor(p.condition);

    const mid = base * yearFactor * hourFactor * (1 + equip) * cond;

    const low = Math.round(mid * 0.85);
    const high = Math.round(mid * 1.15);

    const note =
      "Snabbestimat för MVP baserat på viktklass, årsmodell, timmar och utrustning. " +
      "För exakt värde behöver vi sålda-priser och/eller bildanalys.";

    return NextResponse.json({
      ok: true,
      estimate_low: low,
      estimate_high: high,
      estimate_note: note,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
