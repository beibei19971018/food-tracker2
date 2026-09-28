// Cloudflare 「_worker.js」進階模式：由這支腳本全權處理所有請求，
// 包含 /analyze-exercise 這個 API 路由，以及其餘所有靜態檔案（透過 env.ASSETS）。
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/analyze-exercise' && request.method === 'POST') {
      return handleAnalyzeExercise(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleAnalyzeExercise(request, env) {
  try {
    const { text } = await request.json();
    const apiKey = env.GROQ_API_KEY;

    if (!apiKey) {
      return json({
        error: 'missing_api_key',
        message: '尚未設定 GROQ_API_KEY 環境變數',
        visibleEnvNames: Object.keys(env || {})
      }, 500);
    }
    if (!text) {
      return json({ error: 'missing_text' }, 400);
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
        max_completion_tokens: 1024,
        reasoning_effort: 'low',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ error: 'groq_error', detail: errText }, resp.status);
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
      else return json({ error: 'invalid_json', raw: cleaned }, 502);
    }

    return json(parsed, 200);
  } catch (e) {
    return json({ error: 'server_error', message: String((e && e.message) || e) }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
