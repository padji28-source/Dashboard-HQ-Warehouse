export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { gasUrl, action, range } = body;
    
    if (!gasUrl) {
      return new Response(JSON.stringify({ error: "Missing gasUrl" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let targetUrl = gasUrl;
    if (action === "get") {
      targetUrl = `${gasUrl}?action=get&range=${encodeURIComponent(range || "")}`;
      
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Response(JSON.stringify({ error: `Failed to fetch from GAS: ${response.status}` }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
      }
      
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error("Error in /api/sheets edge function:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch from GAS" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
