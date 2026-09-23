// Vercel serverless function: POST /api/chat
// Reads OPENAI_API_KEY from Vercel's environment variables, so the key
// never reaches the browser. Streams OpenAI's reply straight back.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.6-luna';

function errorResponse(status, message) {
    return new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function POST(request) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return errorResponse(500, 'OPENAI_API_KEY is not set in Vercel. Add it, then redeploy.');
    }

    // Optional lock: if APP_PASSWORD is set in Vercel, only people who
    // enter that password in Customize can use your credits.
    const password = process.env.APP_PASSWORD;
    if (password && request.headers.get('x-app-password') !== password) {
        return errorResponse(401, 'Wrong or missing app password.');
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse(400, 'Request body was not valid JSON.');
    }

    const { model, messages } = body || {};
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) {
        return errorResponse(400, 'Messages are missing or too many.');
    }

    let upstream;
    try {
        upstream = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: model || DEFAULT_MODEL,
                messages,
                stream: true
            }),
            signal: request.signal
        });
    } catch {
        return errorResponse(502, 'The server could not reach OpenAI.');
    }

    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
            'Cache-Control': 'no-cache'
        }
    });
}
