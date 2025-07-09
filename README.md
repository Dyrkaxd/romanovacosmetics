# Панель керування "Romanova Cosmetics"

Цей репозиторій містить все необхідне для запуску та розгортання панелі керування вашим інтернет-магазином.

## Змінні середовища

Для повноційної роботи додатку необхідно налаштувати наступні змінні середовища у вашому проекті Netlify (або у файлі `.env` для локальної розробки):

-   `SUPABASE_URL`: URL вашого проекту Supabase.
-   `SUPABASE_SERVICE_ROLE_KEY`: Ключ `service_role` вашого проекту Supabase. Використовується для всіх серверних операцій.
-   `API_KEY`: Ваш ключ API для Google Gemini (використовується для AI-функцій, таких як аналітика).
-   `NOVA_POSHTA_API_KEY`: Ваш персональний ключ API від "Нової Пошти". Необхідний для створення ТТН та пошуку міст/відділень у реальному часі.

## Локальний запуск

**Передумови:**
- Node.js
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)

1.  **Встановіть залежності:**
    ```bash
    npm install
    ```
2.  **Створіть файл `.env`** в корені проекту та додайте в нього змінні середовища, як зазначено вище.
    Приклад файлу `.env`:
    ```
    SUPABASE_URL=https://your-project-ref.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    API_KEY=your-gemini-api-key
    NOVA_POSHTA_API_KEY=your-nova-poshta-api-key
    ```
3.  **Запустіть додаток** в режимі розробки за допомогою Netlify CLI:
    ```bash
    netlify dev
    ```
    Це запустить і фронтенд, і серверні функції одночасно.

## Міграції бази даних

Якщо ви оновлюєте існуючий додаток і зіткнулися з помилкою, такою як `column "nova_poshta_ttn" of relation "public.orders" does not exist`, вам необхідно застосувати міграцію бази даних.

### Міграція: Додавання колонок для Нової Пошти

Виконайте наступний SQL-запит у вашому SQL-редакторі Supabase, щоб додати колонки, необхідні для інтеграції з Новою Поштою:

```sql
-- Додає необхідні колонки до таблиці 'orders' для інтеграції з Новою Поштою.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS nova_poshta_ttn TEXT NULL,
ADD COLUMN IF NOT EXISTS nova_poshta_print_url TEXT NULL;

-- Додає коментарі до колонок для кращого розуміння (необов'язково, але рекомендується)
COMMENT ON COLUMN public.orders.nova_poshta_ttn IS 'Номер товарно-транспортної накладної (ТТН) Нової Пошти.';
COMMENT ON COLUMN public.orders.nova_poshta_print_url IS 'URL для друку ТТН Нової Пошти.';
```
