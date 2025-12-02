import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Superenkel test-API utan OpenAI, bara för att bevisa att allt funkar
  return NextResponse.json({
    model: "DEMO-MODELL-FRÅN-BACKEND",
    serial: "DEMO-SN-12345",
  });
}
