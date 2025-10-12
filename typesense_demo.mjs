import Typesense from 'typesense';
import fs from 'node:fs/promises';

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

async function ensureHealthy() {
  const health = await client.health.retrieve();
  return health;
}

async function recreateBooksCollection() {
  try {
    await client.collections('books').retrieve();
    await client.collections('books').delete();
  } catch (error) {
    if (error?.httpStatus !== 404) {
      throw error;
    }
  }

  const schema = {
    name: 'books',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'authors', type: 'string[]', facet: true },
      { name: 'publication_year', type: 'int32', facet: true },
      { name: 'average_rating', type: 'float' },
      { name: 'ratings_count', type: 'int32' },
      { name: 'image_url', type: 'string' }
    ],
    default_sorting_field: 'ratings_count'
  };

  const created = await client.collections().create(schema);
  return created;
}

async function importBooks() {
  const filePath = '/Users/karthikbalaji/Riverstone/books.jsonl';
  const data = await fs.readFile(filePath, 'utf8');
  const result = await client
    .collections('books')
    .documents()
    .import(data, { action: 'upsert', batch_size: 1000 });

  const lines = result.trim().split('\n');
  let success = 0;
  let failed = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.success) success += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { success, failed, total: lines.length };
}

async function sampleSearch(query = 'harry') {
  const res = await client.collections('books').documents().search({
    q: query,
    query_by: 'title,authors',
    per_page: 5
  });
  return res;
}

async function main() {
  try {
    console.log('Checking Typesense health...');
    const health = await ensureHealthy();
    console.log('Health:', health);

    console.log('Recreating collection `books`...');
    const created = await recreateBooksCollection();
    console.log('Collection ready:', created.name);

    console.log('Importing documents from books.jsonl ...');
    const summary = await importBooks();
    console.log(`Imported: ${summary.success} ok, ${summary.failed} failed, total ${summary.total}`);

    const arg = process.argv.find(a => a.startsWith('--search='));
    const query = arg ? arg.split('=')[1] : 'harry';
    console.log(`\nSearching for: ${query}`);
    const results = await sampleSearch(query);
    const hits = results.hits?.map(h => ({ id: h.document.id, title: h.document.title, authors: h.document.authors })) || [];
    console.log('Top hits:', hits);
  } catch (error) {
    console.error('Error:', error?.message || error);
    if (error?.code === 'ECONNREFUSED' || error?.errno === -61) {
      console.error('Cannot connect to Typesense at host/port. Is the server running?');
    }
    process.exit(1);
  }
}

main();


