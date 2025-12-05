import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageUrl: string | null = body.imageUrl ?? null;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl saknas" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY saknas på servern" },
        { status: 500 }
      );
    }

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Du är expert på entreprenadmaskiner. " +
                  "Du får en bild på en maskin. " +
                  "Bedöm visuellt skick på skala 1-5 där 5 = mycket bra (nästan ny), 1 = mycket dålig (närmast skrot). " +
                  "Titta efter rost, bucklor, sprickor, slitna däck, oljeläckage osv. " +
                  "Svara ENDAST som JSON på formen: " +
                  `{"condition_score": 1-5, "condition_label": "...", "notes": "...", "risk_flags": ["...", "..."]}`,
              },
              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
        max_output_tokens: 256,
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("OpenAI error (condition):", text);
      return NextResponse.json(
        { error: "OpenAI-svar fel: " + text },
        { status: 500 }
      );
    }

    const data = await openaiRes.json();

    let text = "";
    if (
      data &&
      data.output &&
      Array.isArray(data.output) &&
      data.output[0] &&
      data.output[0].content &&
      Array.isArray(data.output[0].content) &&
      data.output[0].content[0] &&
      typeof data.output[0].content[0].text === "string"
    ) {
      text = data.output[0].content[0].text;
    }

    if (!text) {
      console.error("Kunde inte hitta text i condition-svar:", JSON.stringify(data));
      return NextResponse.json(
        { error: "Kunde inte läsa AI-svar för skickbedömning" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Kunde inte JSON-parsa condition-svar:", text);
      return NextResponse.json(
        { error: "AI-svaret var inte giltig JSON", raw: text },
        { status: 500 }
      );
    }

    const condition_score: number = parsed.condition_score ?? 0;
    const condition_label: string = parsed.condition_label ?? "";
    const notes: string = parsed.notes ?? "";
    const risk_flags: string[] = parsed.risk_flags ?? [];

    return NextResponse.json({
      condition_score,
      condition_label,
      notes,
      risk_flags,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          "Internt fel vid skickbedömning: " +
          (err?.message || "okänt fel"),
      },
      { status: 500 }
    );
  }
}

