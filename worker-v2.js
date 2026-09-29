// Cloudflare Worker v2 — KPI Dashboard (version simplifiée et robuste)

const SECRETS = {
  MAILERLITE: 'MAILERLITE_API_KEY',
  THRIVECART: 'KEY_THRIVECART',
  TALLY: 'KEY_TALLY',
  NOTION: 'NOTION_API_KEY',
  NOTION_DB: 'NOTION_DATABASE_ID',
  INSTAGRAM: 'INSTAGRAM_TOKEN',
  INSTAGRAM_ID: 'INSTAGRAM_ACCOUNT_ID',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const callback = url.searchParams.get('callback');

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    let data;

    try {
      switch (source) {
        case 'mailerlite':
          data = await getMailerLite(env);
          break;
        case 'thrivecart':
          data = await getThriveCart(env);
          break;
        case 'tally':
          data = await getTally(env);
          break;
        case 'notion':
          data = await getNotion(env);
          break;
        case 'instagram':
          data = await getInstagram(env);
          break;
        case 'linkedin':
          data = await getLinkedIn(env);
          break;
        default:
          data = { error: 'Source inconnue' };
      }
    } catch (e) {
      data = { error: e.message };
    }

    const json = JSON.stringify(data);

    if (callback) {
      return new Response(`${callback}(${json})`, {
        headers: { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(json, { headers });
  }
};

async function getMailerLite(env) {
  const key = env[SECRETS.MAILERLITE];
  if (!key) return { error: 'MailerLite non configuré' };

  const res = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
    headers: { 'X-MailerLite-ApiKey': key }
  });
  const data = await res.json();

  return {
    subscribers: data.total || 0,
    campaigns: data.data?.length || 0,
  };
}

async function getThriveCart(env) {
  const key = env[SECRETS.THRIVECART];
  if (!key) return { error: 'Thrivecart non configuré' };

  const res = await fetch('https://api.thrivecart.com/v2/orders?limit=50', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();

  const orders = data.orders || [];
  const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return {
    orders: orders.length,
    totalRevenue: revenue,
  };
}

async function getTally(env) {
  const key = env[SECRETS.TALLY];
  if (!key) return { error: 'Tally non configuré' };

  return { forms: 0, responses: 0 };
}

async function getNotion(env) {
  const key = env[SECRETS.NOTION];
  const dbId = env[SECRETS.NOTION_DB];

  if (!key || !dbId) return { error: 'Notion non configuré' };

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      filter: { property: 'Created time', date: { on_or_after: firstDay } },
      page_size: 100
    })
  });

  const data = await res.json();
  return { newClients: data.results?.length || 0 };
}

async function getInstagram(env) {
  const token = env[SECRETS.INSTAGRAM];
  const id = env[SECRETS.INSTAGRAM_ID];

  if (!token || !id) return { error: 'Instagram non configuré' };

  const res = await fetch(
    `https://graph.instagram.com/${id}?fields=followers_count,follows_count,media_count&access_token=${token}`
  );
  const data = await res.json();

  return {
    followers: data.followers_count || 0,
    following: data.follows_count || 0,
    posts: data.media_count || 0,
  };
}

async function getLinkedIn(env) {
  return { error: 'LinkedIn non configuré' };
}
