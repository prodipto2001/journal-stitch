import { NextRequest, NextResponse } from "next/server";

type GeminiPart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
};

type GeminiErrorResponse = {
  error?: {
    message?: string;
  };
};

function extractText(payload: GeminiResponse) {
  const first = payload.candidates?.[0];
  const parts = first?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

async function callGemini(
  apiKey: string,
  model: string,
  mimeType: string,
  base64: string,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Extract all readable text from this image. Return plain text only. Keep line breaks where possible.",
              },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
      }),
    },
  );
  return response;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY in environment." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { mimeType?: string; base64?: string };
  if (!body?.mimeType || !body?.base64) {
    return NextResponse.json(
      { error: "mimeType and base64 are required." },
      { status: 400 },
    );
  }

  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
  ];
  let lastError: string | null = null;

  for (const model of models) {
    const response = await callGemini(apiKey, model, body.mimeType, body.base64);
    if (!response.ok) {
      const raw = await response.text();
      try {
        const parsed = JSON.parse(raw) as GeminiErrorResponse;
        lastError = parsed.error?.message ?? raw;
      } catch {
        lastError = raw;
      }
      continue;
    }
    const payload = (await response.json()) as GeminiResponse;
    const text = extractText(payload);
    return NextResponse.json({ text });
  }

  return NextResponse.json(
    { error: "Gemini OCR request failed.", details: lastError },
    { status: 502 },
  );
}
