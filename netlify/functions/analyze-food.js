// 食物分析：接收照片(base64)和/或文字備註，呼叫 Anthropic API 判斷熱量與蛋白質
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType, note, isFollowUp } = JSON.parse(event.body || '{}');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'missing_api_key', message: '尚未設定 ANTHROPIC_API_KEY 環境變數' }) };
    }

    const hasImage = !!imageBase64;
    if (!hasImage && !note) {
      return { statusCode: 400, body: JSON.stringify({ error: 'missing_input', message: '需要照片或文字描述其中之一' }) };
    }

    let promptText;
    if (!isFollowUp) {
      promptText = `你是一位經驗豐富的營養師助手，請盡力分析${hasImage ? '這張食物照片' : '以下食物描述'}${note ? `（補充說明："${note}"）` : ''}。
如果照片是營養標籤，請直接讀取標籤上的熱量與蛋白質數值。
只要能看出食物的大致種類（例如：看起來是滷肉飯、看起來是沙拉配雞肉），就請直接給出合理估計的熱量與蛋白質，不需要知道確切品牌、店家或精確做法，用常見份量估算即可，這是給使用者參考用，不用非常精確。
只有在照片真的完全看不出食物內容時（例如太暗、太模糊看不出輪廓、根本不是食物的照片），才回傳 {"confident":false,"question":"用繁體中文簡短反問使用者這是什麼食物、大概份量多少"}
能看出大概內容時，一律回傳 {"confident":true,"name":"食物名稱","calories":數字,"protein":數字}
只回傳 JSON，不要其他文字，不要用 markdown code fence。`;
    } else {
      promptText = `你是一位營養師助手，正在分析一份食物${hasImage ? '（同一張照片）' : ''}。使用者補充說明："${note}"。
請根據這些資訊盡力給出合理估計，即使不是100%確定也要給出數字，不要再反問。
只回傳 JSON：{"name":"食物名稱","calories":數字,"protein":數字}，不要其他文字，不要用 markdown code fence。`;
    }

    const content = [];
    if (hasImage) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
      });
    }
    content.push({ type: 'text', text: promptText });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{ role: 'user', content }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: resp.status, body: JSON.stringify({ error: 'anthropic_error', detail: errText }) };
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const raw = textBlock ? textBlock.text : '';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return { statusCode: 502, body: JSON.stringify({ error: 'invalid_json', raw: cleaned }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', message: String((e && e.message) || e) }) };
  }
};
