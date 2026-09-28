// Cloudflare Worker — KPI Dashboard
// Les clés API sont stockées dans les Secrets (jamais dans le code)

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const source = url.searchParams.get('source');

    try {
      let data;

      switch (source) {
        case 'mailerlite':
          data = await getMailerLiteStats(env);
          break;
        case 'thrivecart':
          data = await getThriveCartStats(env);
          break;
        case 'tally':
          data = await getTallyStats(env);
          break;
        case 'notion':
          data = await getNotionStats(env);
          break;
        case 'instagram':
          data = await getInstagramStats(env);
          break;
        case 'linkedin':
          data = await getLinkedInStats(env);
          break;
        default:
          return new Response(JSON.stringify({ error: 'Source inconnue' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function getMailerLiteStats(env) {
  const apiKey = env.MAILERLITE_API_KEY;
  
  const subsResponse = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
    headers: { 'X-MailerLite-ApiKey': apiKey }
  });
  const subsData = await subsResponse.json();

  const campaignsResponse = await fetch('https://api.mailerlite.com/api/v2/campaigns', {
    headers: { 'X-MailerLite-ApiKey': apiKey }
  });
  const campaignsData = await campaignsResponse.json();

  return {
    subscribers: subsData.total || 0,
    activeSubscribers: subsData.data?.filter(s => s.type === 'active').length || 0,
    campaigns: campaignsData.data?.length || 0,
    recentCampaigns: campaignsData.data?.slice(0, 5).map(c => ({
      name: c.name,
      sent: c.total_recipients,
      opened: c.opened?.count || 0,
      clicked: c.clicked?.count || 0,
      openRate: c.opened?.rate || 0,
      clickRate: c.clicked?.rate || 0
    })) || []
  };
}

async function getThriveCartStats(env) {
  const apiKey = env.THRIVECART_API_KEY;
  
  if (!apiKey) {
    return { error: 'Thrivecart non configuré' };
  }

  const productsResponse = await fetch('https://api.thrivecart.com/v2/products', {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const productsData = await productsResponse.json();

  const ordersResponse = await fetch('https://api.thrivecart.com/v2/orders?limit=50', {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const ordersData = await ordersResponse.json();

  const totalRevenue = ordersData.orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
  const orderCount = ordersData.orders?.length || 0;

  return {
    products: productsData.products?.length || 0,
    activeProducts: productsData.products?.filter(p => p.status === 'active').length || 0,
    orders: orderCount,
    totalRevenue: totalRevenue,
    recentOrders: ordersData.orders?.slice(0, 5).map(o => ({
      id: o.id,
      product: o.product_name,
      total: o.total,
      date: o.created_at,
      status: o.status
    })) || []
  };
}

async function getTallyStats(env) {
  const apiKey = env.TALLY_API_KEY;
  
  if (!apiKey) {
    return { error: 'Tally non configuré' };
  }

  const formsResponse = await fetch('https://api.tally.so/forms', {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const formsData = await formsResponse.json();

  const responsesResponse = await fetch('https://api.tally.so/responses', {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const responsesData = await responsesResponse.json();

  return {
    forms: formsData.forms?.length || 0,
    activeForms: formsData.forms?.filter(f => f.status === 'active').length || 0,
    responses: responsesData.responses?.length || 0,
    recentResponses: responsesData.responses?.slice(0, 5).map(r => ({
      id: r.id,
      form: r.form_name,
      date: r.created_at
    })) || []
  };
}

async function getNotionStats(env) {
  const apiKey = env.NOTION_API_KEY;
  const databaseId = env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return { error: 'Notion non configuré' };
  }

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      filter: {
        property: 'Created time',
        date: {
          on_or_after: firstDayOfMonth
        }
      },
      page_size: 100
    })
  });

  const data = await response.json();

  return {
    newClients: data.results?.length || 0,
    totalLeads: data.results?.length || 0
  };
}

async function getInstagramStats(env) {
  const accessToken = env.INSTAGRAM_TOKEN;
  const instagramId = env.INSTAGRAM_ACCOUNT_ID;

  if (!accessToken || !instagramId) {
    return { error: 'Instagram non configuré' };
  }

  const response = await fetch(
    `https://graph.instagram.com/${instagramId}?fields=followers_count,follows_count,media_count&access_token=${accessToken}`
  );
  const data = await response.json();

  const insightsResponse = await fetch(
    `https://graph.instagram.com/${instagramId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`
  );
  const insights = await insightsResponse.json();

  return {
    followers: data.followers_count || 0,
    following: data.follows_count || 0,
    posts: data.media_count || 0,
    impressions: insights.data?.[0]?.values?.[0]?.value || 0,
    reach: insights.data?.[1]?.values?.[0]?.value || 0,
    profileViews: insights.data?.[2]?.values?.[0]?.value || 0
  };
}

async function getLinkedInStats(env) {
  const accessToken = env.LINKEDIN_TOKEN;
  const organizationId = env.LINKEDIN_ORG_ID;

  if (!accessToken || !organizationId) {
    return { error: 'LinkedIn non configuré' };
  }

  const response = await fetch(
    `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${organizationId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  const data = await response.json();

  return {
    followers: data.elements?.[0]?.followerCounts?.organicFollowerCount || 0,
    paidFollowers: data.elements?.[0]?.followerCounts?.paidFollowerCount || 0
  };
}
