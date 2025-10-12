import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: Number(process.env.TYPESENSE_PORT) || 8108,
      protocol: process.env.TYPESENSE_PROTOCOL || 'http'
    }
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: Number(process.env.TYPESENSE_TIMEOUT_SECONDS || 10)
});

async function ensureConversationCollection() {
  const schema = {
    name: 'conversation_store',
    fields: [
      { name: 'conversation_id', type: 'string' },
      { name: 'model_id', type: 'string' },
      { name: 'timestamp', type: 'int32' },
      { name: 'role', type: 'string', index: false },
      { name: 'message', type: 'string', index: false }
    ]
  };

  try {
    await client.collections('conversation_store').retrieve();
    return { created: false };
  } catch (err) {
    if (err?.httpStatus !== 404) throw err;
  }

  const created = await client.collections().create(schema);
  return { created: true, name: created.name };
}

async function main() {
  try {
    const result = await ensureConversationCollection();
    console.log(result.created ? 'Created collection `conversation_store`' : '`conversation_store` already exists');
    process.exit(0);
  } catch (error) {
    console.error('Failed to setup conversation collection:', error?.message || error);
    process.exit(1);
  }
}

main();


