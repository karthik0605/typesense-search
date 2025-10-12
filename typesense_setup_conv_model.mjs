const host = process.env.TYPESENSE_HOST || 'localhost';
const port = Number(process.env.TYPESENSE_PORT) || 8108;
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
const typesenseApiKey = process.env.TYPESENSE_API_KEY || 'xyz';

const modelId = process.env.CONV_MODEL_ID || 'conv-model-1';
const modelName = process.env.CONV_MODEL_NAME || 'openai/gpt-4o-mini';
const historyCollection = process.env.CONV_HISTORY_COLLECTION || 'conversation_store';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const systemPrompt = process.env.CONV_SYSTEM_PROMPT || 'You are an assistant for question-answering. You can only make conversations based on the provided context. If a response cannot be formed strictly using the provided context, politely say you do not have knowledge about that topic.';
const ttl = Number(process.env.CONV_TTL || 86400);
const maxBytes = Number(process.env.CONV_MAX_BYTES || 16384);
const openaiBaseUrl = process.env.OPENAI_BASE_URL || '';

async function createOrUpdateModel() {
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const baseUrl = `${protocol}://${host}:${port}`;
  const url = `${baseUrl}/conversations/models`;

  const payload = {
    id: modelId,
    model_name: modelName,
    api_key: openaiApiKey,
    history_collection: historyCollection,
    system_prompt: systemPrompt,
    ttl,
    max_bytes: maxBytes
  };

  if (openaiBaseUrl) {
    payload.openai_url = openaiBaseUrl;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TYPESENSE-API-KEY': typesenseApiKey
    },
    body: JSON.stringify(payload)
  });

  if (res.status === 409) {
    const putUrl = `${baseUrl}/conversations/models/${encodeURIComponent(modelId)}`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-TYPESENSE-API-KEY': typesenseApiKey
      },
      body: JSON.stringify(payload)
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`Failed to update model: ${putRes.status} ${text}`);
    }
    const json = await putRes.json();
    return { updated: true, id: json.id };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create model: ${res.status} ${text}`);
  }

  const json = await res.json();
  return { created: true, id: json.id };
}

async function main() {
  try {
    const result = await createOrUpdateModel();
    if (result.created) console.log(`Created conversation model: ${result.id}`);
    else if (result.updated) console.log(`Updated conversation model: ${result.id}`);
    process.exit(0);
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
}

main();


