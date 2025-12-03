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

    // 🔹 Anropa OpenAI Responses API UTAN response_format
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
                  "Du får en bild på en maskin eller typskylt. " +
                  "Din uppgift är att försöka läsa av modellbeteckning och serienummer. " +
                  "Svara ENDAST med ett JSON-objekt på formen: " +
                  `{"model": "...", "serial": "..."}. ` +
                  "Om du är osäker, lämna tom sträng för det du inte ser tydligt.",
              },
              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
        // Vi litar på prompten istället för response_format här
        max_output_tokens: 256,
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

    // 🔹 Plocka ut text-svaret ur Responses API-strukturen
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
      console.error("Kunde inte hitta text i AI-svar:", JSON.stringify(data));
      return NextResponse.json(
        { error: "Kunde inte läsa text/JSON från AI-svaret" },
        { status: 500 }
      );
    }

    // 🔹 Försök parsa JSON från texten modellen gav
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Kunde inte JSON-parsa AI-svar:", text);
      return NextResponse.json(
        { error: "AI-svaret var inte giltig JSON", raw: text },
        { status: 500 }
      );
    }

    const model: string = (parsed && parsed.model) || "";
    const serial: string = (parsed && parsed.serial) || "";

    return NextResponse.json({ model, serial });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          "Internt fel: " +
          (err && err.message ? err.message : "okänt fel"),
      },
      { status: 500 }
    );
  }
}






