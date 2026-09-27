// 運動分析：接收文字描述，呼叫 Groq API（免費）估算消耗熱量
// Cloudflare Pages Functions 格式：檔名對應路由 /analyze-exercise
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { text } = await request.json();
    const apiKey = env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'missing_api_key', message: '尚未設定 GROQ_API_KEY 環境變數' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!text) {
      return new Response(JSON.stringify({ error: 'missing_text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prompt = `使用者記錄了一項運動："${text}"。請估算並只回傳 JSON，格式：{"name":"運動名稱簡稱","minutes":數字或null,"calories":估計消耗大卡數字}。以一般成人中等體重估算即可，沒有時間資訊時 minutes 給 null 但仍要估 calories。只回傳 JSON，不要其他文字，不要用 markdown code fence。`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Groq API error, status:', resp.status, '| body:', errText);
      return new Response(JSON.stringify({ error: 'groq_error', detail: errText }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await resp.json();
    const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else {
        return new Response(JSON.stringify({ error: 'invalid_json', raw: cleaned }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', message: String((e && e.message) || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
