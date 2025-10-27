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

function buildSchema() {
  return {
    name: 'seating',
    fields: [
      //need a manufacturer field
      { name: 'id', type: 'string' },
      { name: 'code', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'price', type: 'float' },
      { name: 'price_text', type: 'string' },
      { name: 'image_url', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'price_bucket', type: 'string', facet: true },
      { name: 'color', type: 'string', facet: true },
      {
        name: 'embedding',
        type: 'float[]',
        embed: {
          from: ['code', 'description', 'category', 'price_text', 'price_bucket', 'color'],
          model_config: {
            model_name: 'openai/text-embedding-3-small',
            api_key: process.env.OPENAI_API_KEY || ''
          }
        }
      }
    ],
    default_sorting_field: 'price'
  };
}

async function recreate() {
  // Clean up any previous collections
  try { await client.collections('seating').delete(); } catch (err) { if (err?.httpStatus !== 404) throw err; }
  try { await client.collections('books').delete(); } catch (err) { if (err?.httpStatus !== 404) throw err; }
  const schema = buildSchema();
  const created = await client.collections().create(schema);
  return created;
}

async function reimport() {
  const srcPath = '/Users/karthikbalaji/Riverstone/via-seating-from-app.json';
  const raw = await fs.readFile(srcPath, 'utf8');
  const json = JSON.parse(raw);
  const products = Array.isArray(json?.Products) ? json.Products : [];

  const docs = [];
  for (const p of products) {
    const code = String(p?.Code || '').trim();
    if (!code) continue;
    const description = (p?.Description || '').toString();
    const price = Number(p?.BasePrice?.[0]?.price || 0);
    const imageUrl = (p?.SuperCatalog?.EnhancedPreview || '').toString();
    const category = (p?.Category?.Category || p?.ProductCategories?.[0]?.ProductCategory || '').toString();
    const price_text = price ? `price ${price} USD` : '';
    // Derive a simple price bucket for faceting
    let price_bucket = '';
    if (price > 0 && price <= 250) price_bucket = '$0–$250';
    else if (price <= 500) price_bucket = '$250–$500';
    else if (price <= 1000) price_bucket = '$500–$1000';
    else if (price > 1000) price_bucket = '$1000+';

    // Heuristic color extraction from code/description
    const palette = ['black','white','gray','grey','blue','green','red','yellow','orange','purple','brown','beige','ivory','silver','gold','alloy'];
    const hay = (code + ' ' + description).toLowerCase();
    let color = '';
    for (const c of palette) { if (hay.includes(c)) { color = c; break; } }

    docs.push({ id: code, code, description, price, price_text, image_url: imageUrl, category, price_bucket, color });
  }

  const jsonl = docs.map(d => JSON.stringify(d)).join('\n') + (docs.length ? '\n' : '');
  const result = await client.collections('seating').documents().import(jsonl, { action: 'upsert', batch_size: 1000 });
  const lines = result.trim().split('\n');
  let success = 0, failed = 0;
  for (const line of lines) {
    try { const r = JSON.parse(line); if (r.success) success++; else failed++; } catch { failed++; }
  }
  return { success, failed, total: lines.length };
}

async function main() {
  try {
    const created = await recreate();
    console.log('Recreated collection:', created.name);
    const summary = await reimport();
    console.log(`Imported: ${summary.success} ok, ${summary.failed} failed, total ${summary.total}`);
    console.log('Now you can query with query_by=embedding and exclude_fields=embedding');
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
}

main();


