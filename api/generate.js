export default async function handler(req, res) {
  // 1. Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Extraemos los datos que enviaste desde React
  const { prompt, systemInstruction } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 3. Leemos tu llave secreta directamente del servidor de Vercel
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key missing in Vercel environment variables.");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. URL de Gemini (Usando el modelo estable 1.5-flash)
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

  try {
    // 5. Hacemos la consulta a Google desde el servidor oculto
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey // Usamos el header seguro para llaves AQ.
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction || "" }] }
      })
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gemini API error: ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No text returned from Gemini");
    }

    // 6. Enviamos el texto de vuelta a tu React de forma segura
    return res.status(200).json({ text });

  } catch (error) {
    console.error("Error in API route:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}