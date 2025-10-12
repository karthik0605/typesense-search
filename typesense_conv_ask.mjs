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

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(kv => {
    const [k, v = ''] = kv.split('=');
    return [k.replace(/^--/, ''), v];
  }));
  return args;
}

async function ask() {
  const args = parseArgs();
  const q = args.q || args.query || 'suggest a popular fantasy book'; //obv change to chair query
  const query_by = args.query_by || 'title,authors';
  const convModelId = process.env.CONV_MODEL_ID || 'conv-model-1';
  const conversation_id = args.conversation_id || undefined;

  const params = {
    q,
    query_by,
    conversation: true,
    conversation_model_id: convModelId
  };
  if (conversation_id) params.conversation_id = conversation_id;

  const response = await client.collections('books').documents().search(params);
  console.log(JSON.stringify(response.conversation || response, null, 2));
}

ask().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});


