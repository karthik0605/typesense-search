import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [
    { host: process.env.TYPESENSE_HOST || 'localhost', port: Number(process.env.TYPESENSE_PORT) || 8108, protocol: process.env.TYPESENSE_PROTOCOL || 'http' }
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: Number(process.env.TYPESENSE_TIMEOUT_SECONDS || 10)
});

async function createSearchOnlyKey() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
  const params = {
    description: 'Search-only key for books',
    actions: ['documents:search'],
    collections: ['books'],
    expires_at: expiresAt
  };
  const key = await client.keys().create(params);
  return key;
}

createSearchOnlyKey()
  .then((k) => {
    console.log(JSON.stringify(k, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });



