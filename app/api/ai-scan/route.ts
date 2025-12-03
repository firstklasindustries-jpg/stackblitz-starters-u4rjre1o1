import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({ ok: true, hasKey });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageUrl = body && body.imageUrl;

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

    // Anropa OpenAI Vision
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
                  "Analysera bilden (maskin/typskylt). Försök läsa av modellbeteckning och serienummer. " +
                  "Svara ENDAST som JSON med fälten 'model' och 'serial'. " +
                  "Om du är osäker, lämna tom sträng för det du inte ser tydligt.",
              },
              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "MachineInfo",
            schema: {
              type: "object",
              properties: {
                model: { type: "string" },
                serial: { type: "string" },
              },
              required: ["model", "serial"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("OpenAI error:", text);
      return NextResponse.json(
        { error: "OpenAI-svar fel: " + text },
        { status: 500 }
      );
    }

    const data = await openaiRes.json();

    // Försök plocka ut JSON från svaret
    let raw: any =
      data &&
      data.output &&
      data.output[0] &&
      data.output[0].content &&
      data.output[0].content[0] &&
      (data.output[0].content[0].json ||
        data.output[0].content[0].text);

    if (!raw) {
      return NextResponse.json(
        { error: "Kunde inte läsa ut JSON från AI-svaret", data },
        { status: 500 }
      );
    }

    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        console.error("Kunde inte JSON-parsa raw:", raw);
        return NextResponse.json(
          { error: "Kunde inte parsa AI-JSON" },
          { status: 500 }
        );
      }
    }

    const model: string = (raw.model as string) || "";
    const serial: string = (raw.serial as string) || "";

    return NextResponse.json({ model, serial });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Internt fel: " + (err && err.message ? err.message : "okänt fel") },
      { status: 500 }
    );
  }
}






