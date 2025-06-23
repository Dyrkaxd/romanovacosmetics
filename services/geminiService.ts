// Прямі імпорти @google/genai та ініціалізація на клієнті видалені для безпеки

export const generateProductDescription = async (productName: string, category: string): Promise<string> => {
  try {
    const response = await fetch('/.netlify/functions/gemini', { // Шлях до Netlify функції
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateProductDescription',
        productName,
        category,
      }),
    });

    if (!response.ok) {
      // Спробуємо отримати тіло помилки, якщо воно є
      const errorData = await response.json().catch(() => ({ error: 'Невідома помилка від сервера Netlify Functions.' }));
      console.error("Помилка від Netlify функції:", response.status, errorData);
      throw new Error(errorData.error || `Помилка сервера: ${response.status}`);
    }

    const data = await response.json();
    if (data.description) {
      return data.description;
    } else {
      throw new Error("Відповідь від ШІ не містить опису.");
    }
  } catch (error) {
    console.error("Помилка виклику Netlify функції для генерації опису:", error);
    if (error instanceof Error) {
        // Викидаємо повідомлення, яке вже може бути специфічним (з функції або з обробки відповіді)
        throw new Error(error.message || "Не вдалося згенерувати опис товару через мережеву або серверну помилку.");
    }
    // Загальна помилка, якщо тип не Error
    throw new Error("Не вдалося згенерувати опис товару. Невідома помилка.");
  }
};
