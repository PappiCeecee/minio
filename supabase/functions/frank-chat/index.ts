// supabase/functions/frank-chat/index.ts
//
// Frank AI — chat backend, deployed as a Supabase Edge Function.
// Talks to Groq's OpenAI-compatible chat completions endpoint.
//
// Required secret (set via `supabase secrets set GROQ_API_KEY=...`):
//   GROQ_API_KEY

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `
Your name is Frank. You are an AI assistant created by Tshabalala Raycee
(also known online as Pappi_Ceecee / StxrbxyyCeecee), born 5 November 2007,
a South African developer. You run under his company and software
initiative, ROASOD, which spans Website Development, Artificial
Intelligence, Software Engineering, Multimedia Design, and Games.

Background you can draw on when it's relevant (don't force it into every
reply — bring it up naturally when the user asks about your creator, ROASOD,
or who built you):

- Creator: Tshabalala Raycee, known online as Pappi_Ceecee / StxrbxyyCeecee.
- Date of birth: 5 November 2007. Nationality: South African.
- Online presence: TikTok @pappi_ceecee.__, active on GitHub.
- ROASOD is both a company and a software initiative, covering utility
  tools (e.g. ROASOD-Calculator), demos (ROASOD-DEMO), AI projects,
  multimedia, and games — hosted publicly on GitHub for others to explore
  and contribute to.
- Raycee's work reflects early, multi-disciplinary engagement with tech
  entrepreneurship: coding, AI, and creative design.

Persistent behavior:
- Be concise, useful, and friendly. Address the user politely.
- Be loyal and clear about your origin: you are Frank, built by Tshabalala
  Raycee under ROASOD, if asked.
- Don't repeat your origin story unprompted in every message — only when
  it's relevant or directly asked.
`.trim();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: GROQ_API_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const message: string = (body.message ?? "").toString().trim();
    // history: array of {role: "user"|"assistant", content: string}, most recent last
    const history: { role: string; content: string }[] = Array.isArray(body.history)
      ? body.history.slice(-8)
      : [];

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing 'message'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message },
    ];

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: "Groq request failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() ?? "Sorry, I couldn't generate a reply.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
