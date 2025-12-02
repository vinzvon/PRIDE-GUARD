/**
 * ВРЕМЕННАЯ ТЕСТОВАЯ ФУНКЦИЯ
 * Используйте только для тестирования!
 * Активирует VIP БЕЗ реальной оплаты
 *
 * УДАЛИТЕ ПЕРЕД PRODUCTION!
 */

// Замените функцию handleVIPPurchase в app.js (строка 556) на эту:

window.handleVIPPurchase = async function(packageType) {
    console.log('🧪 TEST MODE: Активация VIP без оплаты');

    try {
        showNotification('Активация VIP (тестовый режим)...', 'info');

        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('Пользователь не авторизован');
        }

        const packages = getVIPPackages();
        const pkg = packages[packageType];

        if (!pkg) {
            throw new Error('Неверный тип пакета');
        }

        // Создаём тестовый order ID
        const orderId = `TEST-${user.id.slice(0, 8)}-${Date.now()}`;

        // Создаём запись о платеже в БД
        const { data: payment, error: dbError } = await supabase
            .from('vip_payments')
            .insert({
                user_id: user.id,
                order_id: orderId,
                package_type: packageType,
                vip_days: pkg.days || 999999,
                bonus_stars: pkg.stars,
                price_amount: pkg.price,
                price_currency: 'usdt',
                payment_status: 'finished',
                paid_at: new Date().toISOString(),
                invoice_id: `TEST-INVOICE-${Date.now()}`,
                payment_id: `TEST-PAYMENT-${Date.now()}`
            })
            .select()
            .single();

        if (dbError) throw dbError;

        console.log('✅ Запись о платеже создана:', payment);

        // Активируем VIP подписку
        const result = await activateVIPSubscription(orderId);

        if (result.success) {
            closeVIPModal();

            // Показываем успех с конфетти
            createConfetti();
            showNotification(`🎉 ${result.message}`, 'success');

            // Модальное окно с поздравлением
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';
            modal.innerHTML = `
                <div class="glass rounded-2xl p-8 max-w-md w-full text-center" style="border: 1px solid rgba(234, 179, 8, 0.5);">
                    <div class="text-6xl mb-4">🎉</div>
                    <h2 class="text-3xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                        Поздравляем!
                    </h2>
                    <div class="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl mb-4 text-sm">
                        ⚠️ ТЕСТОВЫЙ РЕЖИМ
                    </div>
                    <p class="text-xl mb-6" style="color: var(--text-primary);">
                        VIP подписка успешно активирована!
                    </p>
                    <div class="bg-white/5 rounded-xl p-4 mb-6">
                        <p class="mb-2" style="color: var(--text-secondary);">
                            <span class="text-yellow-400">👑</span> ${packageType === 'lifetime' ? 'Пожизненная подписка' : pkg.days + ' дней VIP'}
                        </p>
                        <p style="color: var(--text-secondary);">
                            <span class="text-yellow-400">⭐</span> +${pkg.stars} звезд
                        </p>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove(); location.reload();"
                        class="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-3 px-6 rounded-xl">
                        Отлично!
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            throw new Error('Не удалось активировать VIP');
        }

    } catch (error) {
        console.error('❌ Error in test VIP activation:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

console.log('🧪 TEST MODE: handleVIPPurchase заменена на тестовую версию');
console.log('⚠️ ВАЖНО: Удалите это перед запуском в production!');
