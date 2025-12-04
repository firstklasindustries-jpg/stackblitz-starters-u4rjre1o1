import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const model: string | null = body.model ?? null;
    const year: number | null = body.year ?? null;
    const hours: number | null = body.hours ?? null;

    // 🔹 Basvärde från modell
    let base = 500_000;
    if (model) {
      const m = model.toLowerCase();
      if (m.includes("volvo")) base = 900_000;
      else if (m.includes("cat") || m.includes("caterpillar"))
        base = 850_000;
      else if (m.includes("komatsu")) base = 800_000;
      else if (m.includes("hitachi")) base = 780_000;
    }

    // 🔹 Ålder
    let ageFactor = 1;
    if (year) {
      const nowYear = new Date().getFullYear();
      const ageYears = Math.max(0, nowYear - year);
      const maxDrop = 0.5;
      const drop = Math.min(maxDrop, ageYears * 0.05); // -5% per år
      ageFactor = 1 - drop;
    }

    // 🔹 Timmar
    let hourFactor = 1;
    if (typeof hours === "number") {
      if (hours > 12_000) hourFactor -= 0.3;
      else if (hours > 8_000) hourFactor -= 0.2;
      else if (hours > 5_000) hourFactor -= 0.1;
      else if (hours < 3_000) hourFactor += 0.05;
    }

    const randomFactor = 0.95 + Math.random() * 0.1;

    const finalValue = Math.round(base * ageFactor * hourFactor * randomFactor);
    const confidence = 70 + Math.round(Math.random() * 20);

    const commentParts = [];
    if (model) commentParts.push(`modell "${model}"`);
    if (year) commentParts.push(`årsmodell ${year}`);
    if (typeof hours === "number") commentParts.push(`${hours} timmar`);

    const commentBase =
      commentParts.length > 0
        ? "Automatisk MVP-värdering baserad på " +
          commentParts.join(", ") +
          "."
        : "Automatisk MVP-värdering baserad på standardvärden.";

    return NextResponse.json({
      estimated_value: finalValue,
      confidence,
      comment: commentBase,
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
