import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const model: string | null = body.model ?? null;
    const createdAt: string | null = body.createdAt ?? null;

    // 🔹 Basvärde (väldigt enkel MVP-logik)
    let base = 500_000;

    if (model) {
      const m = model.toLowerCase();
      if (m.includes("volvo")) base = 900_000;
      else if (m.includes("cat") || m.includes("caterpillar"))
        base = 850_000;
      else if (m.includes("komatsu")) base = 800_000;
      else if (m.includes("hitachi")) base = 780_000;
    }

    // 🔹 Justera för ålder utifrån created_at som proxy (MVP)
    let ageFactor = 1;
    if (createdAt) {
      const year = new Date(createdAt).getFullYear();
      const nowYear = new Date().getFullYear();
      const ageYears = Math.max(0, nowYear - year);

      // varje år -4 %, max -40 %
      const maxDrop = 0.4;
      const drop = Math.min(maxDrop, ageYears * 0.04);
      ageFactor = 1 - drop;
    }

    // 🔹 Slumpa liten variation för att inte allt ser identiskt ut
    const randomFactor = 0.95 + Math.random() * 0.1; // 0.95–1.05

    const finalValue = Math.round(base * ageFactor * randomFactor);

    // 🔹 Confidence – bara en enkel siffra 70–90 %
    const confidence = 70 + Math.round(Math.random() * 20);

    const comment = model
      ? `Automatisk MVP-värdering baserad på modell "${model}" och ungefärlig ålder.`
      : "Automatisk MVP-värdering baserad på standardvärde och ålder.";

    return NextResponse.json({
      estimated_value: finalValue,
      confidence,
      comment,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          "Internt fel vid värdering: " +
          (err?.message || "okänt fel"),
      },
      { status: 500 }
    );
  }
}

