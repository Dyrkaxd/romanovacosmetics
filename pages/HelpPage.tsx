import React from 'react';
import { useAuth } from '../AuthContext';
import { 
    DashboardIcon, ChartBarIcon, UsersIcon, CreditCardIcon, ProductsIcon, 
    ArchiveBoxIcon, OrdersIcon, SettingsIcon, InformationCircleIcon 
} from '../components/Icons';
import type { FC, SVGProps, ReactNode } from 'react';

// A simple helper component for consistent section styling
const HelpSection: FC<{ title: string; icon: FC<SVGProps<SVGSVGElement>>; children: ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center mb-4">
            <Icon className="w-6 h-6 mr-3 text-rose-500" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <div className="space-y-3 text-slate-600 dark:text-slate-300">
            {children}
        </div>
    </div>
);

const AdminHelpContent: FC = () => (
    <div className="space-y-6">
        <HelpSection title="Панель керування" icon={DashboardIcon}>
            <p>Це головний екран, що надає огляд ключових показників вашого бізнесу за обраний період (7, 30 або 90 днів).</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Основні показники (KPI):</strong> Відображають дохід, прибуток, кількість замовлень та нових клієнтів у порівнянні з попереднім аналогічним періодом.</li>
                <li><strong>Огляд продажів і прибутку:</strong> Графік, що показує динаміку доходу та прибутку по днях.</li>
                <li><strong>Останні замовлення та Топ товари:</strong> Списки для швидкого перегляду поточної активності.</li>
            </ul>
        </HelpSection>

        <HelpSection title="Звіти" icon={ChartBarIcon}>
            <p>Ця сторінка дозволяє глибоко аналізувати фінансові результати за будь-який довільний період.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Звіт про прибутки та збитки:</strong> Розраховує 4 основні метрики:
                    <ul className="list-disc list-inside space-y-2 pl-6 mt-2">
                        <li><strong>Дохід (отримано):</strong> Загальна сума грошей з замовлень зі статусом "Отримано".</li>
                        <li><strong>Валовий прибуток:</strong> Дохід мінус собівартість товарів (ціна салону).</li>
                        <li><strong>Витрати:</strong> Сума всіх витрат, доданих на сторінці "Витрати".</li>
                        <li><strong>Чистий прибуток:</strong> Ваш фінальний заробіток (Дохід - Витрати).</li>
                    </ul>
                </li>
                <li><strong>AI-Аналіз:</strong> Gemini аналізує звіт та надає короткий висновок з порадами.</li>
                <li><strong>Топ-10:</strong> Списки найприбутковіших товарів та найактивніших клієнтів.</li>
            </ul>
        </HelpSection>

        <HelpSection title="Звіт по менеджерах" icon={UsersIcon}>
            <p>Тут ви можете оцінити ефективність роботи кожного співробітника, який обробляє замовлення.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Таблиця ефективності:</strong> Показує кількість оброблених замовлень, загальну суму продажів та валовий прибуток для кожного менеджера та адміністратора.</li>
                <li><strong>Сортування:</strong> Ви можете сортувати таблицю за будь-яким показником, щоб легко визначити лідерів.</li>
            </ul>
        </HelpSection>

        <HelpSection title="Витрати" icon={CreditCardIcon}>
            <p>Фіксуйте всі операційні витрати вашого бізнесу, щоб отримувати точний розрахунок чистого прибутку у звітах.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Додавання витрат:</strong> Вкажіть назву, суму, дату та нотатки для кожної витрати.</li>
                <li><strong>Керування:</strong> Редагуйте або видаляйте існуючі записи про витрати.</li>
            </ul>
        </HelpSection>

        <HelpSection title="Товари" icon={ProductsIcon}>
            <p>Централізоване керування всім асортиментом вашої продукції.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Додавання/Редагування:</strong> Створюйте нові товари, вказуючи назву, групу, роздрібну ціну ($), ціну салону ($) та поточний курс UAH/$.</li>
                <li><strong>Пошук:</strong> Швидко знаходьте потрібний товар за назвою.</li>
                <li><strong>Увага:</strong> Кількість товару на складі редагується на окремій сторінці "Склад".</li>
            </ul>
        </HelpSection>
        
        <HelpSection title="Склад" icon={ArchiveBoxIcon}>
            <p>Ця сторінка призначена для інвентаризації та контролю залишків товарів на складі.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Огляд залишків:</strong> Переглядайте актуальну кількість кожного товару.</li>
                <li><strong>Оновлення кількості:</strong> Просто введіть нове значення в поле поруч з товаром та натисніть "Зберегти" для оновлення даних.</li>
                <li><strong>Фільтрація:</strong> Використовуйте пошук та фільтр за групою для швидкого доступу до потрібних позицій.</li>
            </ul>
        </HelpSection>

        <HelpSection title="Замовлення" icon={OrdersIcon}>
            <p>Повнофункціональний інструмент для обробки замовлень від створення до відправки.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Створення:</strong> Додавайте нові замовлення, обираючи клієнта та товари.</li>
                <li><strong>Керування статусами:</strong> Змінюйте статус замовлення в залежності від етапу його виконання.</li>
                <li><strong>Генерація документів:</strong> Створюйте, друкуйте або діліться посиланням на Рахунок-фактуру в один клік.</li>
            </ul>
        </HelpSection>
        
        <HelpSection title="Клієнти" icon={UsersIcon}>
             <p>Ведення клієнтської бази, аналіз та сегментація.</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                 <li><strong>Керування даними:</strong> Додавайте, редагуйте та видаляйте клієнтів. Менеджери мають повний доступ до керування клієнтською базою.</li>
                 <li><strong>Історія замовлень:</strong> Переглядайте повну історію покупок для кожного клієнта.</li>
                 <li><strong>Сегментація:</strong> Використовуйте фільтри для миттєвого відбору <strong>VIP-клієнтів</strong> (за сумою витрат) або <strong>Неактивних клієнтів</strong> для запуску маркетингових кампаній.</li>
             </ul>
        </HelpSection>

        <HelpSection title="Налаштування" icon={SettingsIcon}>
            <p>Керування доступом та глобальними параметрами системи.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Тема оформлення:</strong> Перемикайтеся між світлою та темною темою інтерфейсу.</li>
                <li><strong>Керування курсом валют:</strong> Встановлюйте курс UAH/$ глобально для всіх товарів або індивідуально для кожної групи.</li>
                <li><strong>Керування адміністраторами:</strong> Надавайте або забирайте права адміністратора іншим користувачам.</li>
                <li><strong>Керування менеджерами:</strong> Додавайте, редагуйте нотатки або видаляйте облікові записи менеджерів.</li>
            </ul>
        </HelpSection>
    </div>
);

const ManagerHelpContent: FC = () => (
    <div className="space-y-6">
        <HelpSection title="Мій огляд" icon={DashboardIcon}>
            <p>Це ваш персональний дашборд, що відображає вашу ефективність за обраний період (7, 30 або 90 днів).</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Ваші показники (KPI):</strong> Відображають ваші особисті продажі, прибуток та кількість оброблених замовлень у порівнянні з попереднім періодом.</li>
                <li><strong>Мої останні замовлення:</strong> Список останніх замовлень, які ви обробили.</li>
                <li><strong>Мої топ товари:</strong> Список товарів, які ви продали на найбільшу суму.</li>
            </ul>
        </HelpSection>
        
        <HelpSection title="Замовлення" icon={OrdersIcon}>
            <p>Основний інструмент для вашої щоденної роботи. Тут ви керуєте замовленнями.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Створення:</strong> Ви можете додавати нові замовлення, обираючи існуючого клієнта або створюючи нового.</li>
                <li><strong>Керування статусами:</strong> Оновлюйте статус замовлення відповідно до його поточного стану (наприклад, "Відправлено", "Отримано").</li>
                <li><strong>Документи:</strong> Ви можете генерувати, друкувати та ділитися посиланням на рахунки-фактури для клієнтів.</li>
            </ul>
        </HelpSection>

        <HelpSection title="Клієнти" icon={UsersIcon}>
            <p>Повноцінне керування вашою клієнтською базою. Тут ви можете додавати, редагувати, видаляти та аналізувати інформацію про клієнтів.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Керування даними:</strong> Додавайте нових клієнтів, оновлюйте їх контактну інформацію та видаляйте застарілі профілі.</li>
                <li><strong>Історія замовлень:</strong> Переглядайте повну історію покупок для кожного клієнта, щоб краще розуміти їхні потреби.</li>
                <li><strong>Сегментація:</strong> Використовуйте фільтри, щоб побачити VIP-клієнтів або тих, хто давно не робив замовлень, для проактивної роботи.</li>
            </ul>
        </HelpSection>
        
        <HelpSection title="Налаштування" icon={SettingsIcon}>
            <p>На цій сторінці ви можете переглянути інформацію про свій обліковий запис та налаштувати вигляд панелі.</p>
             <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Тема оформлення:</strong> Перемикайтеся між світлою та темною темою для комфортної роботи.</li>
                <li><strong>Мій профіль:</strong> Відображається ваше ім'я, email та роль в системі ("Менеджер").</li>
            </ul>
        </HelpSection>
    </div>
);

const HelpPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Довідковий центр</h2>
                    <p className="text-slate-500 dark:text-slate-400">Детальний опис функціоналу для вашої ролі: <strong className="text-rose-600 dark:text-rose-400">{isAdmin ? 'Адміністратор' : 'Менеджер'}</strong></p>
                </div>
            </div>
            
            {isAdmin ? <AdminHelpContent /> : <ManagerHelpContent />}
        </div>
    );
};

export default HelpPage;