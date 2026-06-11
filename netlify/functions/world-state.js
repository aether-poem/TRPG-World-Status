const SYSTEM_PROMPT = `You are a digital-humanities ontology assistant and TRPG
world-state designer. Convert narrative prose into a detailed, playable JSON
world state. Return valid JSON only, without Markdown. Keep proper nouns in
their original language and write other values in concise Chinese.`;

function buildPrompt(text) {
  return `Return one JSON object with these top-level fields:
- summary
- acts: an ordered array of 3-6 dramatic acts when supported. Each act contains
  act_number, title, dramatic_purpose, opening_state, scenes, character_changes,
  clues_revealed, unresolved_threads, closing_state, and next_act_hook.
  Each scene contains title, location, time, participants, objective, beats,
  conflict, discoveries, player_choices, consequences, and transition.
  Write 3-6 concrete beats for each substantial scene.
- characters: items contain name, description, goals, secrets, status
- locations: items contain name, description, hazards, clues
- factions: items contain name, agenda, resources, relationships
- items: items contain name, description, owner, importance
- relationships: items contain source, target, relation
- timeline
- quests: items contain title, hook, objective, stakes
- open_threads
- context_variables: contains atmosphere and scene_state

Separate acts at meaningful reversals, revelations, changes of goal, location,
or time. Do not invent certain facts unsupported by the source. Mark uncertain
inferences as possibilities.

Narrative:
${text}`;
}

function normalizeWorldState(worldState) {
  if (!worldState || typeof worldState !== "object" || Array.isArray(worldState)) {
    return worldState;
  }
  const context = worldState.context_variables && typeof worldState.context_variables === "object"
    ? worldState.context_variables
    : {};
  context.atmosphere ??= worldState.atmosphere || "";
  context.scene_state ??= worldState.scene_state || "";
  delete worldState.atmosphere;
  delete worldState.scene_state;
  worldState.context_variables = context;
  if (!Array.isArray(worldState.acts)) worldState.acts = [];
  return worldState;
}

export default async (request) => {
  if (request.method !== "POST") {
    return Response.json({ detail: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Netlify.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return Response.json(
      { detail: "Missing DEEPSEEK_API_KEY in Netlify environment variables." },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid JSON request body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ detail: "Text is required." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Netlify.env.get("DEEPSEEK_MODEL") || "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(text) },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ detail: `DeepSeek request failed: ${error}` }, { status: response.status });
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "{}";
    const worldState = normalizeWorldState(JSON.parse(content));
    return Response.json({
      input_chunks: [text],
      resolved_chunks: [text],
      resolved_text: text,
      world_state: worldState,
      model: payload.model || Netlify.env.get("DEEPSEEK_MODEL") || "deepseek-chat",
      usage: payload.usage || {},
    });
  } catch (error) {
    return Response.json({ detail: error.message || "World-state generation failed." }, { status: 500 });
  }
};

export const config = {
  path: "/api/world-state",
};
