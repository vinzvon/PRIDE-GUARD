/**
 * SPARK DATING APP - VIP SETTINGS MODULE
 * VIP privacy and premium features settings
 */

import {
    hasActiveVIP,
    getVIPPrivacySettings,
    updateVIPPrivacySettings
} from './supabase.js';
import { showNotification } from './utils.js';

/**
 * Render VIP settings page
 * @returns {Promise<string>} HTML content for VIP settings
 */
export async function renderVIPSettings() {
    const settings = await getVIPPrivacySettings();
    const hasVIP = settings ? settings.hasVIP : false;

    if (!hasVIP) {
        return renderVIPUpgradePrompt();
    }

    return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="mb-6">
                <h1 class="text-3xl font-bold mb-2" style="color: var(--text-primary);">
                    VIP Настройки
                </h1>
                <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                    Управление приватностью и эксклюзивными функциями
                </p>
            </div>

            <!-- VIP Status Badge -->
            <div class="mb-6 p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border border-yellow-500/30">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">👑</div>
                    <div>
                        <h3 class="font-bold text-lg text-yellow-400">VIP Статус Активен</h3>
                        <p class="text-sm text-yellow-300/80">Эксклюзивные функции доступны</p>
                    </div>
                </div>
            </div>

            <!-- Privacy Settings -->
            <div class="space-y-4">
                <!-- Message Privacy -->
                <div class="glass rounded-xl p-5" style="border: 1px solid var(--border-color);">
                    <div class="flex items-start justify-between gap-4 mb-4">
                        <div class="flex-1">
                            <h3 class="font-bold text-lg mb-1" style="color: var(--text-primary);">
                                💬 Кто может писать мне
                            </h3>
                            <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                                Контролируйте, кто может отправлять вам сообщения
                            </p>
                        </div>
                        <div class="flex-shrink-0">
                            <span class="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold">
                                VIP
                            </span>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/5">
                            <input
                                type="radio"
                                name="privacy-messages"
                                value="all"
                                ${settings.privacy_messages === 'all' ? 'checked' : ''}
                                onchange="updateMessagePrivacy('all')"
                                class="form-radio text-red-500"
                            >
                            <div class="flex-1">
                                <div class="font-medium" style="color: var(--text-primary);">Все пользователи</div>
                                <div class="text-xs opacity-70" style="color: var(--text-secondary);">Любой может написать вам</div>
                            </div>
                        </label>

                        <label class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/5">
                            <input
                                type="radio"
                                name="privacy-messages"
                                value="matched_only"
                                ${settings.privacy_messages === 'matched_only' ? 'checked' : ''}
                                onchange="updateMessagePrivacy('matched_only')"
                                class="form-radio text-red-500"
                            >
                            <div class="flex-1">
                                <div class="font-medium" style="color: var(--text-primary);">Только взаимные лайки</div>
                                <div class="text-xs opacity-70" style="color: var(--text-secondary);">Только если вы лайкнули друг друга</div>
                            </div>
                        </label>

                        <label class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/5">
                            <input
                                type="radio"
                                name="privacy-messages"
                                value="none"
                                ${settings.privacy_messages === 'none' ? 'checked' : ''}
                                onchange="updateMessagePrivacy('none')"
                                class="form-radio text-red-500"
                            >
                            <div class="flex-1">
                                <div class="font-medium" style="color: var(--text-primary);">Никто</div>
                                <div class="text-xs opacity-70" style="color: var(--text-secondary);">Отключить личные сообщения</div>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Hide Online Status -->
                <div class="glass rounded-xl p-5" style="border: 1px solid var(--border-color);">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                            <h3 class="font-bold text-lg mb-1" style="color: var(--text-primary);">
                                🔒 Скрыть онлайн-статус
                            </h3>
                            <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                                Другие пользователи не увидят, когда вы онлайн
                            </p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="hide-online-toggle"
                                ${settings.hide_online_status ? 'checked' : ''}
                                onchange="toggleHideOnline(this.checked)"
                                class="sr-only peer"
                            >
                            <div class="w-14 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
                        </label>
                    </div>
                </div>

                <!-- Invisible Mode -->
                <div class="glass rounded-xl p-5" style="border: 1px solid var(--border-color);">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                            <h3 class="font-bold text-lg mb-1" style="color: var(--text-primary);">
                                👻 Невидимый режим
                            </h3>
                            <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                                Просматривайте профили анонимно. Вы не будете появляться в "Кто смотрел"
                            </p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="invisible-mode-toggle"
                                ${settings.invisible_mode ? 'checked' : ''}
                                onchange="toggleInvisibleMode(this.checked)"
                                class="sr-only peer"
                            >
                            <div class="w-14 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Info Notice -->
            <div class="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div class="flex items-start gap-3">
                    <div class="text-xl">ℹ️</div>
                    <div class="text-sm" style="color: var(--text-secondary);">
                        <p class="font-semibold mb-1" style="color: var(--text-primary);">О VIP функциях</p>
                        <p class="opacity-80">
                            Эти настройки доступны только для VIP-подписчиков и помогают контролировать вашу приватность
                            и взаимодействие с другими пользователями. Изменения применяются мгновенно.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render VIP upgrade prompt for non-VIP users
 * @returns {string} HTML content for upgrade prompt
 */
function renderVIPUpgradePrompt() {
    return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="text-center mb-8">
                <div class="text-6xl mb-4">👑</div>
                <h1 class="text-3xl font-bold mb-2" style="color: var(--text-primary);">
                    VIP Настройки
                </h1>
                <p class="text-lg opacity-70" style="color: var(--text-secondary);">
                    Эксклюзивные функции для VIP-подписчиков
                </p>
            </div>

            <div class="glass rounded-2xl p-8 mb-6" style="border: 1px solid var(--border-color);">
                <h2 class="text-2xl font-bold mb-6 text-center" style="color: var(--text-primary);">
                    Получите доступ к VIP функциям
                </h2>

                <div class="space-y-4 mb-8">
                    <div class="flex items-start gap-4 p-4 rounded-xl bg-white/5">
                        <div class="text-3xl">💬</div>
                        <div class="flex-1">
                            <h3 class="font-bold mb-1" style="color: var(--text-primary);">Контроль сообщений</h3>
                            <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                                Выбирайте, кто может писать вам: все, только взаимные лайки, или никто
                            </p>
                        </div>
                    </div>

                    <div class="flex items-start gap-4 p-4 rounded-xl bg-white/5">
                        <div class="text-3xl">🔒</div>
                        <div class="flex-1">
                            <h3 class="font-bold mb-1" style="color: var(--text-primary);">Скрытый онлайн</h3>
                            <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                                Скройте свой онлайн-статус от других пользователей
                            </p>
                        </div>
                    </div>

                    <div class="flex items-start gap-4 p-4 rounded-xl bg-white/5">
                        <div class="text-3xl">👻</div>
                        <div class="flex-1">
                            <h3 class="font-bold mb-1" style="color: var(--text-primary);">Невидимый режим</h3>
                            <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                                Просматривайте профили без отметок в "Кто смотрел"
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onclick="showVIPModal()"
                    class="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-yellow-500/50 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Получить VIP
                </button>
            </div>
        </div>
    `;
}

/**
 * Update message privacy setting
 * @param {string} value - Privacy value ('all', 'matched_only', 'none')
 */
window.updateMessagePrivacy = async function (value) {
    try {
        await updateVIPPrivacySettings({ privacy_messages: value });

        let message = '';
        if (value === 'all') {
            message = '✅ Все пользователи могут писать вам';
        } else if (value === 'matched_only') {
            message = '✅ Только взаимные лайки могут писать вам';
        } else if (value === 'none') {
            message = '✅ Личные сообщения отключены';
        }

        showNotification(message, 'success');
    } catch (error) {
        console.error('❌ Error updating message privacy:', error);
        showNotification('Ошибка обновления настроек', 'error');
    }
};

/**
 * Toggle hide online status
 * @param {boolean} enabled - Whether to hide online status
 */
window.toggleHideOnline = async function (enabled) {
    try {
        await updateVIPPrivacySettings({ hide_online_status: enabled });

        if (enabled) {
            showNotification('✅ Онлайн-статус скрыт', 'success');
        } else {
            showNotification('✅ Онлайн-статус виден', 'success');
        }
    } catch (error) {
        console.error('❌ Error toggling hide online:', error);
        showNotification('Ошибка обновления настроек', 'error');
        // Revert checkbox
        document.getElementById('hide-online-toggle').checked = !enabled;
    }
};

/**
 * Toggle invisible mode
 * @param {boolean} enabled - Whether to enable invisible mode
 */
window.toggleInvisibleMode = async function (enabled) {
    try {
        await updateVIPPrivacySettings({ invisible_mode: enabled });

        if (enabled) {
            showNotification('👻 Невидимый режим включен', 'success');
        } else {
            showNotification('👁️ Невидимый режим выключен', 'success');
        }
    } catch (error) {
        console.error('❌ Error toggling invisible mode:', error);
        showNotification('Ошибка обновления настроек', 'error');
        // Revert checkbox
        document.getElementById('invisible-mode-toggle').checked = !enabled;
    }
};

console.log('✅ VIP Settings module loaded');
