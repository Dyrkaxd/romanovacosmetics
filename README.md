# Запуск та розгортання вашого додатку

Цей репозиторій містить все необхідне для локального запуску вашого додатку.

## Локальний запуск

**Передумови:** Node.js

1.  Встановіть залежності:
    `npm install`
2.  Запустіть додаток в режимі розробки:
    `npm run dev`

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
