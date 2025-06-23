import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// API_KEY буде отримано з середовищних змінних Netlify
const API_KEY = process.env.API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17"; // Використовуйте рекомендовану модель

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  if (!API_KEY) {
    console.error("API_KEY для Gemini API не налаштовано у змінних середовища Netlify.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Серверна помилка: API ключ не налаштовано." }),
    };
  }

  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch(initError) {
     console.error("Помилка ініціалізації GoogleGenAI:", initError);
     return {
        statusCode: 500,
        body: JSON.stringify({ error: "Серверна помилка: Не вдалося ініціалізувати сервіс ШІ." }),
     };
  }
  

  try {
    const body = JSON.parse(event.body || "{}");
    const { productName, category, action } = body;

    if (action === 'generateProductDescription') {
      if (!productName || !category) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Назва товару та категорія є обов'язковими." }),
        };
      }
      const prompt = `Generate a compelling e-commerce product description for a product named "${productName}" in the category "${category}". 
The description should be engaging for online shoppers, highlight key features and benefits, and be approximately 2-3 sentences long.
Focus on persuasive language. Do not use markdown or bullet points. Output plain text.`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ description: response.text }), // Використовуйте response.text
      };
    }
    // Тут можна додати інші дії (actions) для Gemini API у майбутньому

    return { statusCode: 400, body: JSON.stringify({ error: "Невідома дія." }) };

  } catch (error) {
    console.error("Помилка у Netlify функції (Gemini):", error);
    // Надайте більш загальне повідомлення про помилку клієнту
    let errorMessage = "Не вдалося обробити запит до ШІ.";
    if (error instanceof Error && error.message.includes('API key not valid')) {
        errorMessage = "Серверна помилка: Недійсний API ключ.";
    } else if (error instanceof Error) {
        // Можна логувати error.message на сервері, але не відправляти його повністю клієнту
        // якщо він може містити чутливу інформацію
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};

export { handler };
