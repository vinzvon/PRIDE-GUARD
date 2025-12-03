/**
 * SPARK DATING APP - MAIN APPLICATION
 * Основная логика приложения знакомств
 */

import {
    createParticles,
    createFloatingHearts,
    createConfetti,
    createSuperLikeEffect,
    showNotification,
    generateUserId,
    calculateAge,
    validateBio,
    containsURL,
    compressImage
} from './utils.js';

import {
    initializeChat,
    sendMessage,
    closeChat,
    chatState,
    renderAllMessages,
    scrollToBottom,
    getMatchesWithMessages,
    getUnreadCount
} from './chat.js';

import {
    registerUserWithProfile,
    registerUserWithTelegram,
    getProfiles,
    getCurrentUserProfile,
    getPublicUserProfile,
    saveLike,
    checkMutualMatch,
    debugGetAllLikes,
    checkTelegramUser,
    uploadPhoto,
    deletePhoto,
    deletePhotos,
    checkIsAdmin,
    getAllUsersWithPagination,
    getUserById,
    banUser,
    unbanUser,
    sendVerificationCode,
    storeVerificationCode,
    verifyCode,
    clearVerificationCode,
    // Verification system
    generateVerificationChallenge,
    uploadVerificationPhoto,
    submitVerificationRequest,
    getVerificationStatus,
    isUserVerified,
    getPendingVerifications,
    approveVerification,
    rejectVerification,
    // VIP privacy functions
    hasActiveVIP,
    getVIPPrivacySettings,
    updateVIPPrivacySettings,
    canSendMessage,
    recordProfileView,
    getProfileViewers,
    getViewedProfiles,
    getUserOnlineStatus,
    // Promocode functions
    createPromocode,
    getAllPromocodes,
    deactivatePromocode,
    redeemPromocode,
    getUserCurrency,
    getUserRedemptions,
    // VIP Payment functions
    createVIPPayment,
    activateVIPSubscription,
    getPaymentByOrderId,
    getUserPayments,
    getVIPPackages,
    getAllTransactions,
    deductUserStars,
    // Boost functions
    boostUser,
    getBoostStatus,
    getAllBoostHistory,
    // Pinned position functions
    setPinnedPosition,
    getPinnedPosition,
    // Admin VIP grant
    grantVIPSubscription,
    getSupabase
} from './supabase.js';

import { renderVIPSettings } from './vip-settings.js';


// ========================================
// STATE MANAGEMENT
// ========================================

const state = {
    currentView: 'swipe',
    isEditingProfile: false,
    isRegistering: false, // Prevent double submission
    isLoading: true,
    isOnboarding: false,
    onboardingStep: 0,
    userId: null,
    telegramId: null,
    telegramUser: null,
    myProfile: null,
    potentialMatches: [],
    currentMatchIndex: 0,
    myMatchesList: [],
    likedByOthers: [],
    // Email verification state
    pendingEmail: null,
    isVerifying: false,
    // Verification system state
    verificationChallenge: null,
    verificationPhotoFile: null,
    isSubmittingVerification: false,
    // Admin panel state
    isAdmin: false,
    adminUsers: [],
    adminChats: [],
    adminCurrentPage: 1,
    adminTotalPages: 1,
    adminTotalCount: 0,
    adminChatsTotalCount: 0,
    adminSearchQuery: '',
    adminCurrentTab: 'users',
    selectedUser: null,
    // Settings
    unitSystem: 'metric', // 'metric' or 'imperial'
    // Chat state
    currentChatRecipientId: null // ID of recipient in current chat for message permission check
};


// ========================================
// DOM ELEMENTS
// ========================================

const appContent = document.getElementById('app-content');
const appHeader = document.getElementById('app-header');
const appNav = document.getElementById('app-nav');
const navButtons = document.querySelectorAll('.nav-button');

// Templates
const tplSwipe = document.getElementById('template-swipe').content;
const tplCard = document.getElementById('template-card').content;
const tplNoProfiles = document.getElementById('template-no-profiles').content;
const tplMatches = document.getElementById('template-matches').content;
const tplMatchItem = document.getElementById('template-match-item').content;
const tplNoMatches = document.getElementById('template-no-matches').content;
const tplProfileView = document.getElementById('template-profile-view').content;
const tplProfileEdit = document.getElementById('template-profile-edit').content;
const tplLoading = document.getElementById('template-loading').content;
const tplWelcome = document.getElementById('template-welcome').content;
const tplExplanation = document.getElementById('template-explanation').content;
const tplEmail = document.getElementById('template-email-registration').content;
const tplEmailVerify = document.getElementById('template-email-verify').content;
const tplBanned = document.getElementById('template-banned').content;
// Verification templates
const tplVerificationPrompt = document.getElementById('template-verification-prompt').content;
const tplVerificationPhoto = document.getElementById('template-verification-photo').content;
const tplVerificationPending = document.getElementById('template-verification-pending').content;

// ========================================
// TELEGRAM WEB APP INITIALIZATION
// ========================================

function initTelegramWebApp() {
    console.log('📱 Initializing Telegram Web App...');

    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;

        // Configure Telegram Web App
        tg.ready();
        tg.expand(); // Expand to full height
        tg.disableVerticalSwipes(); // Disable vertical swipes to prevent navigation

        // Set background color to match app theme
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        tg.setBackgroundColor(isDarkMode ? '#1e293b' : '#ffffff');

        // Get user data from Telegram
        const user = tg.initDataUnsafe?.user;

        if (user && user.id) {
            console.log(`✅ Telegram user authenticated: ${user.first_name} (ID: ${user.id})`);
            state.telegramId = user.id;
            state.telegramUser = user;
            return true;
        } else {
            console.warn('⚠️ Telegram user data not available');
            return false;
        }
    } else {
        console.warn('⚠️ Telegram Web App is not available (running outside Telegram)');
        return false;
    }
}

// ========================================
// TELEGRAM CLOUD STORAGE HELPERS
// ========================================

/**
 * Save item to Telegram Cloud Storage
 * @param {string} key - Storage key
 * @param {string} value - Storage value
 * @returns {Promise<boolean>} Success status
 */
async function setCloudStorageItem(key, value) {
    return new Promise((resolve) => {
        if (window.Telegram?.WebApp?.CloudStorage) {
            window.Telegram.WebApp.CloudStorage.setItem(key, value, (error, success) => {
                if (error) {
                    console.error('❌ CloudStorage setItem error:', error);
                    resolve(false);
                } else {
                    console.log(`✅ CloudStorage saved: ${key}`);
                    resolve(true);
                }
            });
        } else {
            console.warn('⚠️ CloudStorage not available');
            resolve(false);
        }
    });
}

/**
 * Get item from Telegram Cloud Storage
 * @param {string} key - Storage key
 * @returns {Promise<string|null>} Stored value or null
 */
async function getCloudStorageItem(key) {
    return new Promise((resolve) => {
        if (window.Telegram?.WebApp?.CloudStorage) {
            window.Telegram.WebApp.CloudStorage.getItem(key, (error, value) => {
                if (error) {
                    console.error('❌ CloudStorage getItem error:', error);
                    resolve(null);
                } else {
                    console.log(`✅ CloudStorage retrieved: ${key}`);
                    resolve(value || null);
                }
            });
        } else {
            console.warn('⚠️ CloudStorage not available');
            resolve(null);
        }
    });
}

/**
 * Remove item from Telegram Cloud Storage
 * @param {string} key - Storage key
 * @returns {Promise<boolean>} Success status
 */
async function removeCloudStorageItem(key) {
    return new Promise((resolve) => {
        if (window.Telegram?.WebApp?.CloudStorage) {
            window.Telegram.WebApp.CloudStorage.removeItem(key, (error, success) => {
                if (error) {
                    console.error('❌ CloudStorage removeItem error:', error);
                    resolve(false);
                } else {
                    console.log(`✅ CloudStorage removed: ${key}`);
                    resolve(true);
                }
            });
        } else {
            console.warn('⚠️ CloudStorage not available');
            resolve(false);
        }
    });
}

// ========================================
// PAYMENT CALLBACK HANDLING
// ========================================

/**
 * Check URL for payment callback and show user notification
 * SECURITY NOTE: VIP activation now happens via IPN webhook on backend
 * This function ONLY handles UI/UX - showing success/failure messages
 */
async function checkPaymentCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('order');

    if (paymentStatus === 'success' && orderId) {
        console.log('✅ Payment callback detected:', orderId);

        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            // Show success notification
            showNotification('Платёж обработан! Проверка статуса...', 'info');

            // Poll payment status to check if activated
            let attempts = 0;
            const maxAttempts = 10;
            const pollInterval = setInterval(async () => {
                attempts++;

                try {
                    const payment = await getPaymentByOrderId(orderId);

                    if (payment && payment.activated_at) {
                        clearInterval(pollInterval);

                        // Show success with confetti
                        setTimeout(() => {
                            createConfetti();
                            showNotification('VIP активирован!', 'success');

                            // Show detailed success modal
                            const modal = document.createElement('div');
                            modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';
                            modal.innerHTML = `
                                <div class="glass rounded-2xl p-8 max-w-md w-full text-center" style="border: 1px solid rgba(234, 179, 8, 0.5);">
                                    <div class="text-6xl mb-4">🎉</div>
                                    <h2 class="text-3xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                                        Поздравляем!
                                    </h2>
                                    <p class="text-xl mb-6" style="color: var(--text-primary);">
                                        VIP подписка успешно активирована!
                                    </p>
                                    <div class="bg-white/5 rounded-xl p-4 mb-6">
                                        <p class="mb-2" style="color: var(--text-secondary);">
                                            <span class="text-yellow-400">👑</span> ${payment.package_type === 'lifetime' ? 'Пожизненная подписка' : payment.vip_days + ' дней VIP'}
                                        </p>
                                        <p style="color: var(--text-secondary);">
                                            <span class="text-yellow-400">⭐</span> +${payment.bonus_stars} звезд
                                        </p>
                                    </div>
                                    <button onclick="this.parentElement.parentElement.remove(); location.reload();"
                                        class="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-3 px-6 rounded-xl">
                                        Отлично!
                                    </button>
                                </div>
                            `;
                            document.body.appendChild(modal);
                        }, 500);

                    } else if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        showNotification('Платёж подтверждён! VIP будет активирован в течение нескольких минут.', 'success');
                        setTimeout(() => location.reload(), 3000);
                    }
                } catch (error) {
                    console.error('Error polling status:', error);
                }
            }, 3000); // Check every 3 seconds

        } catch (error) {
            console.error('❌ Error processing payment callback:', error);
            showNotification('Платёж получен. VIP будет активирован автоматически.', 'info');
        }
    } else if (paymentStatus === 'cancelled') {
        console.log('⚠️ Payment cancelled');
        window.history.replaceState({}, document.title, window.location.pathname);
        showNotification('Оплата отменена', 'info');
    }
}

// ========================================
// INITIALIZATION
// ========================================

function initApp() {
    console.log('🚀 Pride Guard - App initializing...');

    // Check for payment callback
    checkPaymentCallback();

    // Create particles
    createParticles();

    // Show loading screen
    appContent.appendChild(tplLoading.cloneNode(true));

    // Initialize Telegram Web App
    const telegramInitialized = initTelegramWebApp();

    // Load data from Supabase
    setTimeout(async () => {
        try {
            // If Telegram is initialized, check if user exists
            if (telegramInitialized && state.telegramId) {
                const existingUser = await checkTelegramUser(state.telegramId);

                if (existingUser) {
                    // User already registered
                    console.log('✅ User found by Telegram ID');
                    state.userId = existingUser.id;
                    state.myProfile = existingUser;

                    // Check if user is banned
                    if (existingUser.is_banned) {
                        console.log('🚫 User is banned');
                        state.isLoading = false;
                        showBannedScreen();
                        return;
                    }

                    // Check if we have an active Supabase session
                    const currentSession = await getCurrentUserProfile();

                    if (!currentSession) {
                        // No active session - try to restore from CloudStorage
                        console.log('⚠️ No active session, attempting to restore from CloudStorage...');

                        const savedEmail = await getCloudStorageItem('spark_email');
                        const savedPassword = await getCloudStorageItem('spark_password');

                        if (savedEmail && savedPassword) {
                            try {
                                // Sign in with saved credentials
                                const supabase = getSupabase();
                                const { error } = await supabase.auth.signInWithPassword({
                                    email: savedEmail,
                                    password: savedPassword
                                });

                                if (error) {
                                    console.error('❌ Failed to restore session:', error);
                                    showNotification('Ошибка восстановления сессии. Попробуйте перезайти.', 'error');
                                    state.isLoading = false;
                                    startOnboarding();
                                    return;
                                }

                                console.log('✅ Session restored from CloudStorage');
                            } catch (error) {
                                console.error('❌ Error restoring session:', error);
                                showNotification('Ошибка восстановления сессии. Попробуйте перезайти.', 'error');
                                state.isLoading = false;
                                startOnboarding();
                                return;
                            }
                        } else {
                            console.warn('⚠️ No credentials found in CloudStorage');
                            showNotification('Требуется повторная авторизация', 'warning');
                            state.isLoading = false;
                            startOnboarding();
                            return;
                        }
                    }

                    // Check if user is admin
                    state.isAdmin = await checkIsAdmin();
                    // Load profiles from Supabase (exclude current user)
                    const profiles = await getProfiles(state.userId);
                    state.potentialMatches = profiles.length > 0 ? profiles : [];
                    state.isLoading = false;
                    navigate('swipe');
                } else {
                    // New user - start normal onboarding (same as browser users)
                    console.log('📝 New Telegram user - starting onboarding');
                    state.isLoading = false;
                    startOnboarding(); // Start from Welcome
                }
            } else {
                // Try to get user from Supabase session (non-Telegram fallback)
                const userProfile = await getCurrentUserProfile();

                if (userProfile) {
                    // User is logged in
                    state.userId = userProfile.id;
                    state.myProfile = userProfile;

                    // Check if user is banned
                    if (userProfile.is_banned) {
                        console.log('🚫 User is banned');
                        state.isLoading = false;
                        showBannedScreen();
                        return;
                    }

                    // Check if user is admin
                    state.isAdmin = await checkIsAdmin();
                    // Load profiles from Supabase (exclude current user)
                    const profiles = await getProfiles(state.userId);
                    state.potentialMatches = profiles.length > 0 ? profiles : [];
                    state.isLoading = false;
                    navigate('swipe');
                } else {
                    // New user - start normal onboarding
                    state.isLoading = false;
                    startOnboarding();
                }
            }
        } catch (error) {
            console.error('❌ Error initializing app:', error);
            showNotification('Ошибка подключения. Проверьте конфигурацию.', 'error');
            state.isLoading = false;
            startOnboarding();
        }

        updateLayoutVisibility();
        console.log('✅ App initialized successfully');
    }, 1500);
}

function updateLayoutVisibility() {
    if (state.isOnboarding) {
        if (appHeader) appHeader.classList.add('hidden');
        if (appNav) appNav.classList.add('hidden');
    } else {
        if (appHeader) appHeader.classList.remove('hidden');
        if (appNav) appNav.classList.remove('hidden');
    }
}

// ========================================
// UNIT SYSTEM & VIP
// ========================================

window.toggleUnits = function (system) {
    state.unitSystem = system;
    updateUnitUI();

    // Convert values in inputs if they exist
    const form = document.getElementById('profile-form');
    if (form) {
        const heightInput = form.querySelector('input[name="height"]');
        const heightFtInput = form.querySelector('input[name="height_ft"]');
        const heightInInput = form.querySelector('input[name="height_in"]');
        const weightInput = form.querySelector('input[name="weight"]');

        // Handle Height Conversion
        if (system === 'imperial') {
            // Metric -> Imperial
            // If we have a metric value, convert it to ft/in
            if (heightInput && heightInput.value) {
                const cm = parseInt(heightInput.value);
                const totalInches = cm / 2.54;
                const feet = Math.floor(totalInches / 12);
                const inches = Math.round(totalInches % 12);

                if (heightFtInput) heightFtInput.value = feet;
                if (heightInInput) heightInInput.value = inches;
            }
        } else {
            // Imperial -> Metric
            // If we have imperial values, convert to cm
            if (heightFtInput && heightInInput && (heightFtInput.value || heightInInput.value)) {
                const feet = parseInt(heightFtInput.value || 0);
                const inches = parseInt(heightInInput.value || 0);
                const totalInches = (feet * 12) + inches;
                const cm = Math.round(totalInches * 2.54);

                if (heightInput) heightInput.value = cm;
            }
        }

        // Handle Weight Conversion
        if (weightInput && weightInput.value) {
            if (system === 'imperial') {
                // kg -> lbs
                weightInput.value = Math.round(weightInput.value * 2.20462);
            } else {
                // lbs -> kg
                weightInput.value = Math.round(weightInput.value / 2.20462);
            }
        }
    }
};

function updateUnitUI() {
    const btnMetric = document.getElementById('unit-metric');
    const btnImperial = document.getElementById('unit-imperial');
    const labelHeight = document.getElementById('height-unit');
    const labelWeight = document.getElementById('weight-unit');

    // Containers
    const heightMetricContainer = document.getElementById('height-metric-container');
    const heightImperialContainer = document.getElementById('height-imperial-container');

    if (!btnMetric || !btnImperial) return;

    if (state.unitSystem === 'imperial') {
        btnImperial.classList.add('bg-white', 'text-black', 'shadow-sm');
        btnImperial.classList.remove('text-gray-500');
        btnMetric.classList.remove('bg-white', 'text-black', 'shadow-sm');
        btnMetric.classList.add('text-gray-500');

        if (labelHeight) labelHeight.textContent = ''; // Hidden in imperial mode structure
        if (labelWeight) labelWeight.textContent = '(фунты)';

        // Toggle containers
        if (heightMetricContainer) heightMetricContainer.classList.add('hidden');
        if (heightImperialContainer) heightImperialContainer.classList.remove('hidden');

        // Update placeholders and min/max values for imperial
        const form = document.getElementById('profile-form');
        if (form) {
            // Height inputs are separate now, handled by HTML attributes mostly
            // But we can ensure they are correct if needed

            if (form.weight) {
                form.weight.placeholder = '150';
                form.weight.min = '66'; // 30 kg = 66.14 lbs
                form.weight.max = '661'; // 300 kg = 661.39 lbs
            }
        }
    } else {
        btnMetric.classList.add('bg-white', 'text-black', 'shadow-sm');
        btnMetric.classList.remove('text-gray-500');
        btnImperial.classList.remove('bg-white', 'text-black', 'shadow-sm');
        btnImperial.classList.add('text-gray-500');

        if (labelHeight) labelHeight.textContent = '(см)';
        if (labelWeight) labelWeight.textContent = '(кг)';

        // Toggle containers
        if (heightMetricContainer) heightMetricContainer.classList.remove('hidden');
        if (heightImperialContainer) heightImperialContainer.classList.add('hidden');

        // Update placeholders and min/max values for metric
        const form = document.getElementById('profile-form');
        if (form) {
            if (form.height) {
                form.height.placeholder = '175';
                form.height.min = '120'; // 120 cm minimum
                form.height.max = '300'; // 300 cm maximum
            }
            if (form.weight) {
                form.weight.placeholder = '70';
                form.weight.min = '30'; // 30 kg minimum
                form.weight.max = '300'; // 300 kg maximum
            }
        }
    }
}

window.showVIPModal = function () {
    const packages = getVIPPackages();

    const modal = document.createElement('div');
    modal.id = 'vip-purchase-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto';

    modal.innerHTML = `
        <div class="glass rounded-2xl p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto" style="border: 1px solid var(--border-color);">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                    👑 VIP Подписка
                </h2>
                <button onclick="closeVIPModal()" class="text-2xl opacity-70 hover:opacity-100 transition-opacity" style="color: var(--text-primary);">
                    ✕
                </button>
            </div>

            <div class="mb-6 p-4 glass rounded-xl" style="border: 1px solid rgba(234, 179, 8, 0.3);">
                <h3 class="font-bold text-lg mb-3" style="color: var(--text-primary);">Эксклюзивные функции VIP:</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✅</span>
                        <span style="color: var(--text-secondary);">Контроль сообщений</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✅</span>
                        <span style="color: var(--text-secondary);">Скрыть онлайн-статус</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✅</span>
                        <span style="color: var(--text-secondary);">Невидимый режим</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✅</span>
                        <span style="color: var(--text-secondary);">Просмотр лайков</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✅</span>
                        <span style="color: var(--text-secondary);">Бонусные звезды</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✅</span>
                        <span style="color: var(--text-secondary);">VIP бейдж в профиле</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${Object.entries(packages).map(([key, pkg]) => `
                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all duration-300 cursor-pointer ${key === 'lifetime' ? 'md:col-span-2 lg:col-span-3' : ''}"
                        style="border: 2px solid ${key === 'lifetime' ? 'rgba(234, 179, 8, 0.5)' : 'var(--border-color)'};"
                        onclick="handleVIPPurchase('${key}')">
                        ${key === 'lifetime' ? '<div class="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">🔥 ЛУЧШЕЕ</div>' : ''}

                        <div class="text-center">
                            <h3 class="text-xl font-bold mb-2" style="color: var(--text-primary);">
                                ${pkg.name}
                            </h3>
                            <p class="text-sm opacity-70 mb-4" style="color: var(--text-secondary);">
                                ${pkg.description}
                            </p>

                            <div class="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                                $${pkg.price} USDT
                            </div>

                            <div class="flex items-center justify-center gap-4 text-sm mb-4">
                                <span class="flex items-center gap-1">
                                    <span class="text-yellow-400">👑</span>
                                    <span style="color: var(--text-secondary);">${pkg.days ? pkg.days + ' дней' : 'Навсегда'}</span>
                                </span>
                                <span class="flex items-center gap-1">
                                    <span class="text-yellow-400">⭐</span>
                                    <span style="color: var(--text-secondary);">+${pkg.stars} звезд</span>
                                </span>
                            </div>

                            <button class="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105">
                                Купить сейчас
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="mt-6 text-center text-sm opacity-70" style="color: var(--text-secondary);">
                <p>💳 Оплата через криптовалюту (USDT, BTC, ETH и другие)</p>
                <p class="mt-2">🔒 Безопасная оплата через NOWPayments</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.closeVIPModal = function () {
    const modal = document.getElementById('vip-purchase-modal');
    if (modal) modal.remove();
};

window.handleVIPPurchase = async function (packageType) {
    try {
        showNotification('Создание платежа...', 'info');

        // Create payment invoice
        const result = await createVIPPayment(packageType);

        if (result.success && result.invoiceUrl) {
            showNotification('Перенаправление на страницу оплаты...', 'success');

            // Close modal and redirect to payment page
            closeVIPModal();

            // Redirect to NOWPayments invoice page
            window.location.href = result.invoiceUrl;
        } else {
            throw new Error('Не удалось создать платеж');
        }

    } catch (error) {
        console.error('❌ Error creating VIP payment:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

// ========================================
// CURRENCY PURCHASE (Stars & Boosts)
// ========================================

window.showCurrencyModal = function () {
    const modal = document.createElement('div');
    modal.id = 'currency-purchase-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto';

    modal.innerHTML = `
        <div class="glass rounded-2xl p-6 max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto" style="border: 1px solid var(--border-color);">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    💰 Купить валюту
                </h2>
                <button onclick="closeCurrencyModal()" class="text-2xl opacity-70 hover:opacity-100 transition-opacity" style="color: var(--text-primary);">
                    ✕
                </button>
            </div>

            <!-- Stars Section -->
            <div class="mb-8">
                <h3 class="text-2xl font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                    <span class="text-yellow-400">⭐</span>
                    Звезды
                </h3>
                <p class="text-sm mb-4 opacity-70" style="color: var(--text-secondary);">
                    Используйте звезды для отправки подарков и получения дополнительных лайков
                </p>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer" 
                        style="border: 2px solid var(--border-color);"
                        onclick="handleCurrencyPurchase('stars_10')">
                        <div class="text-center">
                            <div class="text-4xl mb-2">⭐</div>
                            <div class="text-2xl font-bold mb-2 text-yellow-400">10</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $5 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>

                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer" 
                        style="border: 2px solid rgba(168, 85, 247, 0.4);"
                        onclick="handleCurrencyPurchase('stars_50')">
                        <div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">+10%</div>
                        <div class="text-center">
                            <div class="text-4xl mb-2">⭐⭐</div>
                            <div class="text-2xl font-bold mb-2 text-yellow-400">55</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $20 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>

                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer" 
                        style="border: 2px solid rgba(168, 85, 247, 0.4);"
                        onclick="handleCurrencyPurchase('stars_100')">
                        <div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">+15%</div>
                        <div class="text-center">
                            <div class="text-4xl mb-2">⭐⭐⭐</div>
                            <div class="text-2xl font-bold mb-2 text-yellow-400">115</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $35 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>

                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer relative" 
                        style="border: 2px solid rgba(168, 85, 247, 0.6);"
                        onclick="handleCurrencyPurchase('stars_500')">
                        <div class="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">🔥 -20%</div>
                        <div class="text-center">
                            <div class="text-4xl mb-2">⭐⭐⭐⭐</div>
                            <div class="text-2xl font-bold mb-2 text-yellow-400">600</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $150 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Boosts Section -->
            <div>
                <h3 class="text-2xl font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                    <span class="text-purple-400">🚀</span>
                    Бусты профиля
                </h3>
                <p class="text-sm mb-4 opacity-70" style="color: var(--text-secondary);">
                    Поднимите свой профиль в топ на 30 минут и получите больше просмотров
                </p>
                
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer" 
                        style="border: 2px solid var(--border-color);"
                        onclick="handleCurrencyPurchase('boosts_5')">
                        <div class="text-center">
                            <div class="text-4xl mb-2">🚀</div>
                            <div class="text-2xl font-bold mb-2 text-purple-400">5 бустов</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $10 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>

                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer" 
                        style="border: 2px solid rgba(168, 85, 247, 0.4);"
                        onclick="handleCurrencyPurchase('boosts_20')">
                        <div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">+25%</div>
                        <div class="text-center">
                            <div class="text-4xl mb-2">🚀🚀</div>
                            <div class="text-2xl font-bold mb-2 text-purple-400">25 бустов</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $35 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>

                    <div class="glass rounded-xl p-4 hover:scale-105 transition-all cursor-pointer relative" 
                        style="border: 2px solid rgba(168, 85, 247, 0.6);"
                        onclick="handleCurrencyPurchase('boosts_50')">
                        <div class="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">🔥 ЛУЧШЕЕ</div>
                        <div class="text-center">
                            <div class="text-4xl mb-2">🚀🚀🚀</div>
                            <div class="text-2xl font-bold mb-2 text-purple-400">60 бустов</div>
                            <div class="text-xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                $80 USDT
                            </div>
                            <button class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded-lg">
                                Купить
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 text-center text-sm opacity-70" style="color: var(--text-secondary);">
                <p>💳 Оплата через криптовалюту (USDT, BTC, ETH и другие)</p>
                <p class="mt-2">🔒 Безопасная оплата через NOWPayments</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.closeCurrencyModal = function () {
    const modal = document.getElementById('currency-purchase-modal');
    if (modal) modal.remove();
};

window.handleCurrencyPurchase = async function (packageType) {
    try {
        showNotification('Создание платежа...', 'info');

        // Call Edge Function to create currency payment
        const supabase = getSupabase();
        const { data, error } = await supabase.functions.invoke('create-currency-payment', {
            body: { packageType }
        });

        if (error) {
            console.error('❌ Edge Function error:', error);
            throw error;
        }

        if (!data || !data.success) {
            throw new Error(data?.error || 'Failed to create payment');
        }

        if (data.success && data.invoiceUrl) {
            showNotification('Перенаправление на страницу оплаты...', 'success');

            // Close modal and redirect to payment page
            closeCurrencyModal();

            // Redirect to NOWPayments invoice page
            window.location.href = data.invoiceUrl;
        } else {
            throw new Error('Не удалось создать платеж');
        }

    } catch (error) {
        console.error('❌ Error creating currency payment:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

// ========================================
// PROMOCODE FUNCTIONS
// ========================================

// Load and display user currency
async function loadUserCurrency() {
    const currency = await getUserCurrency();
    const starsEl = document.getElementById('user-stars');
    const boostsEl = document.getElementById('user-boosts');
    if (starsEl) starsEl.textContent = currency.stars;
    if (boostsEl) boostsEl.textContent = currency.boosts;
}

// Show promocode activation modal
window.showPromocodeModal = function () {
    const modal = document.createElement('div');
    modal.id = 'promocode-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="glass rounded-2xl p-6 max-w-md w-full" style="border: 1px solid var(--border-color);">
            <h2 class="text-2xl font-bold mb-4" style="color: var(--text-primary);">
                🎁 Активировать Промокод
            </h2>
            <input
                type="text"
                id="promocode-input"
                placeholder="Введите промокод"
                class="w-full px-4 py-3 rounded-xl border-2 mb-4"
                style="border-color: var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary);"
            />
            <div class="flex gap-3">
                <button onclick="closePromocodeModal()" class="flex-1 px-4 py-3 rounded-xl bg-gray-600 text-white font-semibold">
                    Отмена
                </button>
                <button onclick="activatePromocode()" class="flex-1 px-4 py-3 rounded-xl bg-green-500 text-white font-semibold">
                    Активировать
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('promocode-input').focus();
};

window.closePromocodeModal = function () {
    const modal = document.getElementById('promocode-modal');
    if (modal) modal.remove();
};

window.activatePromocode = async function () {
    const input = document.getElementById('promocode-input');
    const code = input.value.trim();

    if (!code) {
        showNotification('Введите промокод', 'error');
        return;
    }

    try {
        const result = await redeemPromocode(code);
        if (result.success) {
            showNotification(result.message, 'success');
            closePromocodeModal();
            await loadUserCurrency(); // Refresh currency display
            if (result.reward.type === 'vip') {
                // Reload profile to show VIP badge
                setTimeout(() => location.reload(), 1500);
            }
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error activating promocode:', error);
        showNotification('Ошибка активации промокода', 'error');
    }
};

// ========================================
// BANNED USER SCREEN
// ========================================

function showBannedScreen() {
    console.log('🚫 Showing banned screen');

    // Hide header and navigation
    if (appHeader) appHeader.classList.add('hidden');
    if (appNav) appNav.classList.add('hidden');

    // Clear content and show banned template
    appContent.innerHTML = '';
    const bannedContainer = tplBanned.cloneNode(true);

    // Set ban date if available
    const banDateInfo = bannedContainer.querySelector('#ban-date-info');
    if (banDateInfo && state.myProfile?.banned_at) {
        const banDate = new Date(state.myProfile.banned_at);
        const formattedDate = banDate.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        banDateInfo.textContent = `Дата блокировки: ${formattedDate}`;
    } else if (banDateInfo) {
        banDateInfo.textContent = 'Дата блокировки неизвестна';
    }

    // Set user ID for reference
    const userIdEl = bannedContainer.querySelector('#banned-user-id');
    if (userIdEl && state.userId) {
        userIdEl.textContent = `ID пользователя: ${state.userId}`;
    }

    appContent.appendChild(bannedContainer);
}

// ========================================
// ONBOARDING FLOW
// ========================================

function startOnboarding() {
    console.log('🏁 Starting onboarding flow');
    state.isOnboarding = true;
    state.onboardingStep = 0;
    updateLayoutVisibility();
    renderWelcome();
}

function renderWelcome() {
    appContent.innerHTML = '';
    appContent.appendChild(tplWelcome.cloneNode(true));
}

window.nextOnboardingStep = function () {
    console.log('➡️ Next onboarding step');
    state.onboardingStep++;
    if (state.onboardingStep === 1) {
        renderExplanation();
    }
};

// Back navigation functions for onboarding
window.goBackToWelcome = function () {
    console.log('⬅️ Going back to welcome screen');
    state.onboardingStep = 0;
    renderWelcome();
};

window.goBackToExplanation = function () {
    console.log('⬅️ Going back to explanation screen');
    state.onboardingStep = 1;
    renderExplanation();
};

window.goBackToProfile = function () {
    console.log('⬅️ Going back to profile form');
    state.onboardingStep = 2;
    state.isEditingProfile = true;
    renderProfileView();
};

function renderExplanation() {
    appContent.innerHTML = '';
    appContent.appendChild(tplExplanation.cloneNode(true));
}

window.startOnboardingProfile = function () {
    console.log('📝 Starting profile creation step');
    state.onboardingStep = 2;
    state.isEditingProfile = true;
    updateLayoutVisibility(); // Ensure layout is correct

    try {
        renderProfileView();
    } catch (e) {
        console.error('❌ Error rendering profile edit:', e);
        showNotification('Ошибка загрузки формы', 'error');
    }
};

window.finishOnboarding = async function (event) {
    if (event) {
        event.preventDefault();
    }

    if (state.isRegistering) return;
    state.isRegistering = true;

    const submitBtn = event?.target?.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Загрузка...';
    }

    const form = event.target;
    const email = form.email.value.trim();

    // Validate email
    if (!email) {
        showNotification('Введите почту!', 'error');
        state.isRegistering = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
        return;
    }

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email!', 'error');
        state.isRegistering = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
        return;
    }

    console.log('📧 Processing registration for:', email);
    console.log('📱 Telegram ID available:', !!state.telegramId);

    try {
        showNotification('Отправка кода подтверждения...', 'info');

        // Send verification code via Edge Function
        const code = await sendVerificationCode(email);

        // ДОБАВЛЕНО: Проверка на наличие кода
        if (!code) {
            throw new Error('Не удалось получить код подтверждения');
        }

        // Store code temporarily (expires in 10 minutes)
        storeVerificationCode(email, code, 10);

        // Store email for later use
        state.pendingEmail = email;

        console.log('✅ Verification code sent successfully to:', email);

        // Show verification code screen
        renderEmailVerification();

    } catch (error) {
        console.error('❌ Error sending verification code:', error);
        showNotification(`Ошибка отправки кода: ${error.message}`, 'error');
    } finally {
        state.isRegistering = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
};

// ========================================
// EMAIL VERIFICATION FUNCTIONS
// ========================================

function renderEmailVerification() {
    appContent.innerHTML = '';
    const verifyContainer = tplEmailVerify.cloneNode(true);

    // Set email display
    const emailDisplay = verifyContainer.querySelector('#verify-email');
    if (emailDisplay && state.pendingEmail) {
        emailDisplay.textContent = state.pendingEmail;
    }

    appContent.appendChild(verifyContainer);

    // Focus on code input
    setTimeout(() => {
        const codeInput = document.querySelector('input[name="verification-code"]');
        if (codeInput) codeInput.focus();
    }, 100);
}

window.goBackToEmailInput = function () {
    console.log('⬅️ Going back to email input');
    clearVerificationCode(state.pendingEmail);
    state.pendingEmail = null;
    state.onboardingStep = 3;
    appContent.innerHTML = '';
    appContent.appendChild(tplEmail.cloneNode(true));
};

window.handleVerifyCode = async function (event) {
    if (event) {
        event.preventDefault();
    }

    if (state.isVerifying) return;
    state.isVerifying = true;

    const form = event.target;
    const code = form['verification-code'].value.trim().toUpperCase();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    if (!code || code.length !== 6) {
        showErrorMessage('Введите полный 6-символный код');
        state.isVerifying = false;
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Проверка...';
    }

    try {
        console.log('🔐 Verifying code for email:', state.pendingEmail);

        // Verify code
        const isValid = verifyCode(state.pendingEmail, code);

        if (!isValid) {
            showErrorMessage('Неверный или истекший код. Попробуйте снова.');
            state.isVerifying = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
            return;
        }

        console.log('✅ Code verified successfully');
        showNotification('✅ Код верифицирован! Создаём аккаунт...', 'success');

        const email = state.pendingEmail;

        // Check if we have Telegram ID - use Telegram registration path
        if (state.telegramId) {
            console.log('📱 Registering with Telegram after email verification');

            const result = await registerUserWithTelegram(
                state.telegramId,
                state.telegramUser,
                state.myProfile,
                email
            );

            console.log('✅ User registered with Telegram:', result);
            state.userId = result.user.id;
            state.myProfile = result.profile;

            // Save credentials to Telegram CloudStorage for cross-device sync
            if (result.credentials) {
                await setCloudStorageItem('spark_email', result.credentials.email);
                await setCloudStorageItem('spark_password', result.credentials.password);
                console.log('✅ Credentials saved to CloudStorage for cross-device sync');
            }
        } else {
            // Regular email registration
            console.log('📧 Registering with email');

            const password = generateUserId();

            // Prepare profile data
            const initialProfile = { ...state.myProfile };
            initialProfile.photos = [];
            initialProfile.photoUrl = null;

            // Register user
            const result = await registerUserWithProfile(email, password, initialProfile);
            console.log('✅ User registered:', result);

            state.userId = result.user.id;
            state.myProfile = result.profile;
        }

        // Upload photos if any
        if (state.pendingPhotoFiles && state.pendingPhotoFiles.length > 0) {
            showNotification(`Загрузка ${state.pendingPhotoFiles.length} фото...`, 'info');

            const uploadedUrls = [];
            for (const photoFile of state.pendingPhotoFiles) {
                try {
                    const publicUrl = await uploadPhoto(state.userId, photoFile.file, photoFile.index);
                    uploadedUrls.push(publicUrl);
                } catch (e) {
                    console.error('Failed to upload photo:', e);
                }
            }

            if (uploadedUrls.length > 0) {
                state.myProfile.photos = uploadedUrls;
                state.myProfile.photoUrl = uploadedUrls[0];

                const { updateProfile } = await import('./supabase.js');
                await updateProfile(state.myProfile);
                console.log('✅ Photos uploaded and profile updated');
            }
        }

        // Clear state
        state.isOnboarding = false;
        state.isEditingProfile = false;
        state.pendingPhotoFiles = [];
        state.pendingEmail = null;

        updateLayoutVisibility();

        // Load profiles for swiping
        const profiles = await getProfiles(state.userId);
        state.potentialMatches = profiles.length > 0 ? profiles : [];

        // Navigate to swipe
        navigate('swipe');
        showNotification('🎉 Профиль создан! Добро пожаловать в Pride Guard!', 'success');

    } catch (error) {
        console.error('❌ Registration error:', error);
        showErrorMessage(`Ошибка регистрации: ${error.message}`);
    } finally {
        state.isVerifying = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
};

// Helper function to show error in verification form
function showErrorMessage(message) {
    const errorEl = document.getElementById('verify-error');
    const errorText = document.getElementById('verify-error-text');

    if (errorEl && errorText) {
        errorText.textContent = message;
        errorEl.classList.remove('hidden');

        // Hide after 5 seconds
        setTimeout(() => {
            errorEl.classList.add('hidden');
        }, 5000);
    } else {
        showNotification(message, 'error');
    }
}

// ========================================
// VERIFICATION SYSTEM
// ========================================

/**
 * Check user verification status and show appropriate screen
 */
async function checkAndShowVerificationStatus() {
    try {
        const verificationStatus = await getVerificationStatus();

        if (!verificationStatus) {
            console.log('⚠️ No verification status found');
            return 'not_verified';
        }

        console.log('🔐 Verification status:', verificationStatus.verification_status);

        switch (verificationStatus.verification_status) {
            case 'verified':
                // User is verified, allow access
                return 'verified';

            case 'pending':
                // Show pending screen
                renderVerificationPending();
                return 'pending';

            case 'rejected':
            case 'not_verified':
                // Show verification prompt
                renderVerificationPrompt();
                return verificationStatus.verification_status;

            default:
                console.warn('Unknown verification status:', verificationStatus.verification_status);
                renderVerificationPrompt();
                return 'not_verified';
        }
    } catch (error) {
        console.error('❌ Error checking verification status:', error);
        return 'not_verified';
    }
}

/**
 * Render verification prompt screen
 */
function renderVerificationPrompt() {
    appContent.innerHTML = '';
    appContent.appendChild(tplVerificationPrompt.cloneNode(true));
}

/**
 * Start verification process
 */
window.startVerification = function () {
    console.log('🔐 Starting verification process');

    // Generate random challenge
    state.verificationChallenge = generateVerificationChallenge();
    console.log('Generated challenge:', state.verificationChallenge);

    // Render photo upload screen
    renderVerificationPhoto();
};

/**
 * Render verification photo upload screen
 */
function renderVerificationPhoto() {
    appContent.innerHTML = '';
    const photoContainer = tplVerificationPhoto.cloneNode(true);

    // Set challenge display
    const fingersEl = photoContainer.querySelector('#challenge-fingers');
    const exprTextEl = photoContainer.querySelector('#challenge-expression-text');
    const exprEmojiEl = photoContainer.querySelector('#challenge-expression-emoji');

    if (fingersEl && state.verificationChallenge) {
        fingersEl.textContent = `${state.verificationChallenge.fingers} ${state.verificationChallenge.fingerEmoji}`;
    }

    if (exprTextEl && exprEmojiEl && state.verificationChallenge) {
        exprTextEl.textContent = state.verificationChallenge.expressionText;
        exprEmojiEl.textContent = state.verificationChallenge.expressionEmoji;
    }

    appContent.appendChild(photoContainer);
}

/**
 * Handle verification photo upload
 */
window.handleVerificationPhotoUpload = async function (input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const preview = document.getElementById('preview-verification-photo');
    const placeholder = document.getElementById('verification-photo-placeholder');
    const submitBtn = document.getElementById('btn-submit-verification');

    try {
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            if (preview) {
                preview.src = e.target.result;
                preview.classList.remove('hidden');
            }
            if (placeholder) {
                placeholder.classList.add('hidden');
            }
        };
        reader.readAsDataURL(file);

        // Store file
        state.verificationPhotoFile = file;

        // Enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
        }

        console.log('✅ Verification photo ready:', file.name);
    } catch (error) {
        console.error('❌ Error handling verification photo:', error);
        showNotification('Ошибка загрузки фото', 'error');
    }
};

/**
 * Submit verification request
 */
window.submitVerification = async function () {
    if (state.isSubmittingVerification) return;

    if (!state.verificationPhotoFile) {
        showNotification('Загрузите фото для верификации', 'error');
        return;
    }

    if (!state.verificationChallenge) {
        showNotification('Ошибка: нет данных о жесте', 'error');
        return;
    }

    state.isSubmittingVerification = true;
    const submitBtn = document.getElementById('btn-submit-verification');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Загрузка...';
    }

    try {
        console.log('📤 Submitting verification request...');

        // Upload photo
        const photoUrl = await uploadVerificationPhoto(state.userId, state.verificationPhotoFile);
        console.log('✅ Verification photo uploaded:', photoUrl);

        // Prepare gesture data
        const gestureData = {
            fingers: state.verificationChallenge.fingers,
            expression: state.verificationChallenge.expression
        };

        // Submit verification request
        const result = await submitVerificationRequest(state.userId, photoUrl, gestureData);
        console.log('✅ Verification request submitted:', result);

        // Update profile
        state.myProfile = result;

        // Clear state
        state.verificationPhotoFile = null;
        state.verificationChallenge = null;

        // Show pending screen
        showNotification('✅ Заявка отправлена на модерацию!', 'success');
        renderVerificationPending();

    } catch (error) {
        console.error('❌ Error submitting verification:', error);
        showNotification(`Ошибка отправки: ${error.message}`, 'error');
    } finally {
        state.isSubmittingVerification = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
};

/**
 * Render verification pending screen
 */
function renderVerificationPending() {
    appContent.innerHTML = '';
    appContent.appendChild(tplVerificationPending.cloneNode(true));
}

// ========================================
// NAVIGATION
// ========================================

window.navigate = async function (view) {
    if (state.isOnboarding) return; // Block navigation during onboarding

    // Block navigation for banned users
    if (state.myProfile?.is_banned) {
        console.log('🚫 Navigation blocked - user is banned');
        showNotification('Ваш аккаунт заблокирован', 'error');
        return;
    }

    console.log(`📍 Navigating to: ${view}`);

    // Check verification status for swipe view
    if (view === 'swipe') {
        const verificationStatus = await checkAndShowVerificationStatus();

        if (verificationStatus !== 'verified') {
            console.log(`🔐 Access blocked - verification status: ${verificationStatus}`);
            return; // Verification screen already shown by checkAndShowVerificationStatus
        }
    }

    state.currentView = view;

    // Update navigation buttons
    navButtons.forEach(btn => {
        if (btn.getAttribute('onclick') === `navigate('${view}')`) {
            btn.classList.add('text-red-500');
            btn.classList.remove('text-gray-500');
        } else {
            btn.classList.add('text-gray-500');
            btn.classList.remove('text-red-500');
        }
    });

    // Render appropriate view
    switch (view) {
        case 'swipe':
            renderSwipeView();
            break;
        case 'matches':
            renderMatchesView();
            break;
        case 'profile':
            renderProfileView();
            break;
        case 'vip-settings':
            renderVIPSettingsView();
            break;
        case 'admin':
            if (!state.isAdmin) {
                showNotification('Доступ запрещен', 'error');
                navigate('profile');
                return;
            }
            renderAdminPanel();
            break;
    }
};

// ========================================
// SWIPE VIEW
// ========================================

function renderSwipeView() {
    appContent.innerHTML = '';

    if (state.isLoading) {
        appContent.appendChild(tplLoading.cloneNode(true));
        return;
    }

    if (!state.myProfile) {
        navigate('profile');
        return;
    }

    const swipeContainer = tplSwipe.cloneNode(true);
    const cardContainer = swipeContainer.querySelector('#swipe-card-container');
    const swipeActions = swipeContainer.querySelector('#swipe-actions');

    if (state.currentMatchIndex < state.potentialMatches.length) {
        // Create card stack wrapper
        const stackWrapper = document.createElement('div');
        stackWrapper.style.position = 'relative';
        stackWrapper.style.width = '100%';
        stackWrapper.style.height = '100%';

        // Card 3 (furthest back)
        if (state.currentMatchIndex + 2 < state.potentialMatches.length) {
            const profile3 = state.potentialMatches[state.currentMatchIndex + 2];
            const card3 = createBackCard(profile3, false);
            card3.classList.add('card-behind-2');
            stackWrapper.appendChild(card3);
        }

        // Card 2 (middle)
        if (state.currentMatchIndex + 1 < state.potentialMatches.length) {
            const profile2 = state.potentialMatches[state.currentMatchIndex + 1];
            const card2 = createBackCard(profile2, false);
            card2.classList.add('card-behind-1');
            stackWrapper.appendChild(card2);
        }

        // Current card (top)
        const profile = state.potentialMatches[state.currentMatchIndex];
        const card = createBackCard(profile, true);
        card.classList.add('card-top');
        stackWrapper.appendChild(card);

        cardContainer.appendChild(stackWrapper);
    } else {
        cardContainer.appendChild(tplNoProfiles.cloneNode(true));
        swipeActions.classList.add('hidden');
    }

    appContent.appendChild(swipeContainer);
}

// ========================================
// CARD RENDERING
// ========================================

/**
 * Check if a profile has active VIP status
 * @param {Object} profile - User profile object
 * @returns {boolean} - True if user has active VIP
 */
function isUserVIP(profile) {
    // Strict checks: profile must exist and has_vip must be explicitly true
    if (!profile || profile.has_vip !== true) return false;

    // If no expiration date, treat as lifetime VIP
    if (!profile.subscription_expires_at) return true;

    // Check if subscription is still active
    const isActive = new Date(profile.subscription_expires_at) > new Date();
    return isActive;
}

function createCard(profile) {
    const card = tplCard.cloneNode(true);
    const cardDiv = card.querySelector('div');

    // Set card positioning
    cardDiv.style.position = 'absolute';
    cardDiv.style.left = '0';
    cardDiv.style.right = '0';
    cardDiv.style.top = '0';
    cardDiv.style.bottom = '0';

    // Apply VIP styles if user has active VIP
    if (isUserVIP(profile)) {
        cardDiv.classList.add('vip-border');
        const vipBadge = cardDiv.querySelector('.vip-badge');
        if (vipBadge) {
            vipBadge.classList.remove('hidden');
        }
    }

    // Get photo from photoUrl or photos array
    const photoUrl = profile.photoUrl || (profile.photos && profile.photos[0]) || 'https://placehold.co/600x800?text=No+Photo';
    card.querySelector('img').src = photoUrl;
    card.querySelector('img').alt = profile.name || 'Profile';

    // Calculate age if not provided
    const age = profile.age || (profile.dob ? calculateAge(profile.dob) : '?');
    card.querySelector('.name-age').textContent = `${profile.name || 'Unknown'}, ${age}`;
    card.querySelector('.bio-text').textContent = profile.bio || 'No bio';

    return cardDiv;
}

function createBackCard(profile, isTopCard = false) {
    const cardDiv = createCard(profile);
    if (!isTopCard) {
        cardDiv.classList.remove('card-enter');
    }
    return cardDiv;
}

// ========================================
// SWIPE LOGIC
// ========================================

window.handleSwipe = async function (action) {
    if (state.currentMatchIndex >= state.potentialMatches.length) return;

    const profile = state.potentialMatches[state.currentMatchIndex];
    const cardEl = document.querySelector('.card-top');

    if (!cardEl) return;

    // Handle Super Like
    if (action === 'superlike') {
        // Check and deduct stars
        const result = await deductUserStars(1);
        if (!result.success) {
            showNotification(result.message, 'error');
            if (result.message === 'Недостаточно звёзд') {
                showCurrencyModal();
            }
            return;
        }

        // Show animation
        createSuperLikeEffect();
        cardEl.classList.add('card-swipe-super');

        // Treat as like
        action = 'like';
    } else {
        // 1. Visual Feedback (Optimistic)
        if (action === 'like') {
            cardEl.classList.add('card-swipe-right');
            createFloatingHearts();
        } else {
            cardEl.classList.add('card-swipe-left');
        }
    }

    // 2. Advance State Immediately (after short delay for animation start)
    // Reduced delay for snappier feel
    setTimeout(() => {
        state.currentMatchIndex++;
        renderSwipeView();
    }, 250);

    // 3. Background Network Request
    if (action === 'like') {
        // Fire and forget (don't await)
        saveLike(profile.id).then(result => {
            // Check for mutual match
            checkMutualMatch(profile.id).then(matchInfo => {
                if (matchInfo && matchInfo.isMutualMatch) {
                    console.log('💕 Mutual match found!');
                    // Store match ID for chat
                    window.__matchId = matchInfo.matchId;
                    // Show modal even if user has moved on (it's a nice surprise)
                    showMatchModal(profile);
                    if (!state.myMatchesList.find(m => m.id === profile.id)) {
                        state.myMatchesList.push(profile);
                    }
                } else if (result && result.success) {
                    console.log('👍 Like saved');
                }
            }).catch(e => console.error('Error checking match:', e));
        }).catch(err => {
            console.error('Like failed:', err);
            // Optional: Revert state if like failed?
            // For now, we assume reliability or just ignore occasional failure to prioritize UX speed.
        });
    }
};

// ========================================
// MATCH MODAL
// ========================================

window.showMatchModal = function (profile) {
    const modal = document.getElementById('match-modal');
    const content = document.getElementById('match-modal-content');

    if (!modal || !content) return;

    document.getElementById('match-name').textContent = profile.name;
    document.getElementById('match-my-photo').src = state.myProfile?.photos?.[0] || state.myProfile?.photoUrl || 'https://i.pravatar.cc/100?img=68';
    document.getElementById('match-other-photo').src = profile.photoUrl || (profile.photos && profile.photos[0]) || 'https://i.pravatar.cc/100?img=69';

    // Store profile for chat opening
    window.__matchProfile = profile;

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.style.transform = 'scale(1)';
        content.style.opacity = '1';
        content.classList.add('modal-enter');
        createConfetti();

        // Set up chat button
        const chatBtn = document.getElementById('btn-open-chat');
        if (chatBtn) {
            chatBtn.onclick = () => {
                closeMatchModal();
                // Find the match in the database
                if (state.myMatchesList.some(m => m.id === profile.id)) {
                    // Create match object for opening chat
                    const match = {
                        id: window.__matchId || null,
                        user1_id: state.userId,
                        user1: state.myProfile,
                        user2: profile
                    };
                    if (window.__matchId) {
                        window.openChatWithMatch(window.__matchId, match);
                    }
                }
            };
        }
    }, 10);
};

window.closeMatchModal = function () {
    const modal = document.getElementById('match-modal');
    const content = document.getElementById('match-modal-content');

    if (!modal || !content) return;

    content.style.transform = 'scale(0.5)';
    content.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
        content.classList.remove('modal-enter');
    }, 300);
};

// ========================================
// MATCHES VIEW
// ========================================

function renderMatchesView() {
    // Use chat list instead
    renderChatsList();
}

// ========================================
// PROFILE VIEW
// ========================================

function renderProfileView() {
    appContent.innerHTML = '';

    if (state.isEditingProfile || !state.myProfile) {
        renderProfileEdit();
    } else {
        renderProfileDisplay();
    }
}

// ========================================
// VIP SETTINGS VIEW
// ========================================

async function renderVIPSettingsView() {
    appContent.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div><p class="text-gray-500">Загрузка...</p></div></div>';

    try {
        const html = await renderVIPSettings();
        appContent.innerHTML = html;
    } catch (error) {
        console.error('❌ Error rendering VIP settings:', error);
        appContent.innerHTML = `
            <div class="max-w-4xl mx-auto px-4 py-8">
                <div class="text-center">
                    <div class="text-6xl mb-4">⚠️</div>
                    <h2 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">Ошибка загрузки</h2>
                    <p class="text-gray-500 mb-6">Не удалось загрузить настройки VIP</p>
                    <button onclick="navigate('profile')" class="bg-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors">
                        Вернуться в профиль
                    </button>
                </div>
            </div>
        `;
    }
}

window.handleImageUpload = async function (input, index) {
    if (input.files && input.files[0]) {
        try {
            const file = input.files[0];
            const compressedBase64 = await compressImage(file);

            // Check for duplicate photos
            const existingPreviews = document.querySelectorAll('[id^="preview-photo"]');
            let isDuplicate = false;
            existingPreviews.forEach(p => {
                if (p.id !== `preview-photo${index}` && p.getAttribute('data-base64') === compressedBase64) {
                    isDuplicate = true;
                }
            });

            if (isDuplicate) {
                showNotification('Это фото уже добавлено!', 'error');
                input.value = ''; // Clear input
                return;
            }

            const preview = document.getElementById(`preview-photo${index}`);
            if (preview) {
                preview.src = compressedBase64;
                preview.classList.remove('hidden');
                // Store file for upload to Storage (use property, not attribute)
                preview._file = file;
                // Store Base64 for preview
                preview.setAttribute('data-base64', compressedBase64);
                // Add delete button if not exists
                addPhotoDeleteButton(index);
            }
        } catch (error) {
            console.error('Error processing image:', error);
            showNotification('Ошибка обработки фото', 'error');
        }
    }
};

// Add delete button to photo
window.addPhotoDeleteButton = function (index, container = null) {
    // Use provided container or search globally
    const searchContainer = container || document;
    const photoGroup = searchContainer.querySelector(`.photo-upload-group:nth-child(${index})`);
    if (!photoGroup) return;

    // Remove existing delete button if any
    const existingBtn = photoGroup.querySelector('.photo-delete-btn');
    if (existingBtn) existingBtn.remove();

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'photo-delete-btn absolute top-1 right-1 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-red-700 z-10 font-bold';
    deleteBtn.innerHTML = '✕';
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        deletePhotoFromForm(index);
    };

    const photoDiv = photoGroup.querySelector('div[style*="position"]') || photoGroup.querySelector('div:first-child');
    if (photoDiv) {
        photoDiv.style.position = 'relative';
        photoDiv.appendChild(deleteBtn);
    }
};

// Delete photo from form
window.deletePhotoFromForm = function (index) {
    const preview = document.getElementById(`preview-photo${index}`);
    const input = document.getElementById(`photo${index}-input`);

    if (preview) {
        const photoUrl = preview.getAttribute('data-base64');
        const isExisting = preview.getAttribute('data-existing') === 'true';

        // Mark existing photos for deletion from Storage
        if (isExisting && photoUrl && photoUrl.startsWith('https://')) {
            preview.setAttribute('data-marked-for-delete', 'true');
        }

        preview.src = '';
        preview.classList.add('hidden');
        preview._file = null;
        preview.removeAttribute('data-base64');
        preview.removeAttribute('data-existing');
    }

    if (input) {
        input.value = '';
    }

    // Remove delete button
    const deleteBtn = document.querySelector(`.photo-upload-group:nth-child(${index}) .photo-delete-btn`);
    if (deleteBtn) deleteBtn.remove();

    showNotification('Фото удалено', 'info');
};

function renderProfileEdit() {
    const profileContainer = tplProfileEdit.cloneNode(true);
    const form = profileContainer.querySelector('#profile-form');

    // Add bio char counter
    const bioInput = form.querySelector('textarea[name="bio"]');
    const bioCount = form.querySelector('#bio-count');
    if (bioInput && bioCount) {
        bioInput.addEventListener('input', () => {
            bioCount.textContent = bioInput.value.length;
        });
    }

    if (state.myProfile) {
        form.name.value = state.myProfile.name || '';
        // Disable name editing if not onboarding (existing user)
        if (!state.isOnboarding && state.myProfile.name) {
            form.name.disabled = true;
            form.name.classList.add('opacity-50', 'cursor-not-allowed');
            // Add a small note or tooltip if needed, or just rely on disabled state
        }
        form.dob.value = state.myProfile.dob || '';
        form.city.value = state.myProfile.city || '';
        form.bio.value = state.myProfile.bio || '';
        if (bioCount) bioCount.textContent = (state.myProfile.bio || '').length;

        // Photos
        if (state.myProfile.photos) {
            state.myProfile.photos.forEach((url, i) => {
                const index = i + 1;
                const preview = profileContainer.querySelector(`#preview-photo${index}`);
                if (preview) {
                    preview.src = url;
                    preview.classList.remove('hidden');
                    preview.setAttribute('data-base64', url);
                    // Mark as existing photo (not newly uploaded)
                    preview.setAttribute('data-existing', 'true');
                    // Add delete button for existing photos
                    addPhotoDeleteButton(index, profileContainer);
                }
            });
        }

        // Stats
        // Handle inputs for height and weight
        const heightInput = form.querySelector('input[name="height"]');
        const heightFtInput = form.querySelector('input[name="height_ft"]');
        const heightInInput = form.querySelector('input[name="height_in"]');
        const weightInput = form.querySelector('input[name="weight"]');

        if (state.myProfile.height) {
            // Always set metric value
            if (heightInput) heightInput.value = state.myProfile.height;

            // Also set imperial values for the hidden inputs (or if mode is imperial)
            const totalInches = state.myProfile.height / 2.54;
            const feet = Math.floor(totalInches / 12);
            const inches = Math.round(totalInches % 12);

            if (heightFtInput) heightFtInput.value = feet;
            if (heightInInput) heightInInput.value = inches;
        }

        if (weightInput && state.myProfile.weight) {
            if (state.unitSystem === 'imperial') {
                // Convert kg to lbs
                weightInput.value = Math.round(state.myProfile.weight * 2.20462);
            } else {
                weightInput.value = state.myProfile.weight;
            }
        }

        // Update UI for current unit
        updateUnitUI();
        form.bodyType.value = state.myProfile.bodyType || state.myProfile.body_type || '';

        // Identity
        form.orientation.value = state.myProfile.orientation || '';
        form.role.value = state.myProfile.role || '';

        // Tribes
        if (state.myProfile.tribes) {
            state.myProfile.tribes.forEach(tribe => {
                const cb = form.querySelector(`input[name="tribes"][value="${tribe}"]`);
                if (cb) cb.checked = true;
            });
        }

        // Socials
        if (state.myProfile.socials) {
            form.social_instagram.value = state.myProfile.socials.instagram || '';
            form.social_twitter.value = state.myProfile.socials.twitter || '';
            form.social_onlyfans.value = state.myProfile.socials.onlyfans || '';
            form.social_telegram.value = state.myProfile.socials.telegram || '';
        }
    }

    // VIP-based location editing restriction
    // Check if user is editing their own profile (not onboarding)
    if (!state.isOnboarding && state.myProfile) {
        const cityInput = profileContainer.querySelector('#profile-city-input');
        const detectLocationBtn = profileContainer.querySelector('#detect-location-btn');

        if (!isUserVIP(state.myProfile)) {
            // Non-VIP users cannot edit location
            if (cityInput) {
                cityInput.setAttribute('readonly', 'true');
                cityInput.style.cursor = 'not-allowed';
                cityInput.style.opacity = '0.6';
            }
            // Hide detect location button for non-VIP
            if (detectLocationBtn) {
                detectLocationBtn.classList.add('hidden');
            }
        } else {
            // VIP users can edit location normally
            if (cityInput) {
                cityInput.removeAttribute('readonly');
                cityInput.style.cursor = 'text';
                cityInput.style.opacity = '1';
            }
            // Show detect location button for VIP
            if (detectLocationBtn) {
                detectLocationBtn.classList.remove('hidden');
            }
        }
    }

    // Show appropriate buttons based on mode
    if (state.isOnboarding) {
        // Registration mode - show Next and Back buttons
        const btnNext = profileContainer.querySelector('#btn-next-step');
        const btnBack = profileContainer.querySelector('#btn-back-onboarding');
        if (btnNext) btnNext.classList.remove('hidden');
        if (btnBack) btnBack.classList.remove('hidden');
    } else {
        // Edit mode - show Save and Cancel buttons
        const btnSave = profileContainer.querySelector('#btn-save');
        const btnCancel = profileContainer.querySelector('#btn-cancel');
        if (btnSave) btnSave.classList.remove('hidden');
        if (btnCancel) btnCancel.classList.remove('hidden');
    }

    appContent.appendChild(profileContainer);
}

function renderProfileDisplay() {
    const viewContainer = tplProfileView.cloneNode(true);
    const p = state.myProfile;

    // Main photo container - apply VIP border if user is VIP
    const photoContainer = viewContainer.querySelector('.relative');
    if (photoContainer && isUserVIP(p)) {
        photoContainer.classList.add('vip-profile-border');
    }

    // Main photo
    const mainPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : 'https://placehold.co/600x800?text=No+Photo';
    viewContainer.querySelector('#profile-view-photo').src = mainPhoto;
    viewContainer.querySelector('#profile-view-photo').alt = p.name;

    // Name & Age
    const age = calculateAge(p.dob);
    viewContainer.querySelector('#profile-view-name-age').textContent = `${p.name}, ${age}`;

    // Show VIP badge if user is VIP
    const vipBadge = viewContainer.querySelector('#profile-vip-badge');
    if (vipBadge && isUserVIP(p)) {
        vipBadge.classList.remove('hidden');
    }

    viewContainer.querySelector('#profile-view-city').textContent = `📍 ${p.city || 'Не указан'}`;

    // Stats
    viewContainer.querySelector('#profile-view-height').textContent = p.height ? `${p.height} см` : '--';
    viewContainer.querySelector('#profile-view-weight').textContent = p.weight ? `${p.weight} кг` : '--';

    const bodyTypes = {
        'slim': 'Стройное', 'average': 'Среднее', 'athletic': 'Атлетичное',
        'muscular': 'Мускулистое', 'curvy': 'Плотное', 'large': 'Крупное'
    };
    viewContainer.querySelector('#profile-view-body').textContent = bodyTypes[p.bodyType || p.body_type] || '--';

    const roles = {
        'top': 'Топ', 'bottom': 'Боттом', 'vers': 'Верс', 'side': 'Сайд',
        'oral': 'Орал', 'toys': 'Игрушки', 'dom': 'Доминант',
        'sub': 'Сабмиссив', 'master': 'Мастер', 'slave': 'Слейв'
    };
    viewContainer.querySelector('#profile-view-role').textContent = roles[p.role] || '--';

    // Tribes
    const tribesContainer = viewContainer.querySelector('#profile-view-tribes');
    if (p.tribes && p.tribes.length > 0) {
        p.tribes.forEach(tribe => {
            const span = document.createElement('span');
            span.className = 'px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium capitalize';
            span.textContent = tribe;
            tribesContainer.appendChild(span);
        });
    } else {
        tribesContainer.textContent = 'Не указано';
    }

    // Bio
    viewContainer.querySelector('#profile-view-bio').textContent = p.bio;

    // Socials
    const socialsContainer = viewContainer.querySelector('#profile-view-socials');
    if (p.socials && Object.values(p.socials).some(v => v)) {
        if (p.socials.instagram) addSocialLink(socialsContainer, '📸 Instagram', p.socials.instagram);
        if (p.socials.twitter) addSocialLink(socialsContainer, '🐦 Twitter', p.socials.twitter);
        if (p.socials.onlyfans) addSocialLink(socialsContainer, '🔞 OnlyFans', p.socials.onlyfans);
        if (p.socials.telegram) addSocialLink(socialsContainer, '✈️ Telegram', p.socials.telegram);
    } else {
        socialsContainer.textContent = 'Нет привязанных аккаунтов';
    }

    // Show admin button if user is admin
    const adminBtn = viewContainer.querySelector('#btn-admin-panel');
    if (adminBtn && state.isAdmin) {
        adminBtn.classList.remove('hidden');
    }

    appContent.appendChild(viewContainer);

    // Load and display user currency
    loadUserCurrency();
}

function addSocialLink(container, label, value) {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 rounded-xl shadow-sm';
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.innerHTML = `
            <span class="font-medium" style="color: var(--text-primary)">${label}</span>
            <span class="text-red-500 font-bold">${value}</span>
        `;
    container.appendChild(div);
}

// ========================================
// PROFILE ACTIONS
// ========================================

window.startEditProfile = function () {
    state.isEditingProfile = true;
    renderProfileView();
};

window.cancelEditProfile = function () {
    if (!state.myProfile && !state.isOnboarding) return;
    state.isEditingProfile = false;
    renderProfileView();
};

window.detectLocation = async function () {
    const form = document.getElementById('profile-form');
    if (!form) return;

    const btn = form.querySelector('button[onclick="detectLocation()"]');
    if (btn) {
        btn.style.transform = 'scale(0.95)';
        btn.style.transition = 'transform 0.1s ease';
    }

    try {
        showNotification('⏳ Определение города...', 'info');

        const response = await fetch('https://api.2ip.io/?token=9mg0aouhfmk54u6v');
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        if (data && data.city) {
            form.city.value = data.city;
            showNotification(`📍 Ваш город: ${data.city}`, 'success');
        } else {
            throw new Error('City not found in response');
        }
    } catch (error) {
        console.error('Geolocation error:', error);
        showNotification('Не удалось определить город', 'error');
    } finally {
        if (btn) {
            btn.style.transform = 'scale(1)';
        }
    }
};

window.saveProfile = async function () {
    console.log('💾 Saving profile...');
    const form = document.getElementById('profile-form');

    if (!form) {
        showNotification('Форма не найдена!', 'error');
        return;
    }

    // Basic Info
    // Sanitize Name and Bio (remove URLs)
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.[a-zA-Z]{2,}\/[^\s]*)/g;

    let name = form.name.value.trim();
    name = name.replace(urlRegex, '').trim(); // Remove URLs from name

    const dob = form.dob.value;
    const city = form.city.value.trim();

    // Validation: Basic
    if (!name || !dob || !city) {
        showNotification('Заполните основные поля!', 'error');
        return;
    }

    // Validation: Age
    const age = calculateAge(dob);
    if (age < 18 || age > 99) {
        document.getElementById('dob-error').classList.remove('hidden');
        showNotification('Возраст должен быть 18+!', 'error');
        return;
    } else {
        document.getElementById('dob-error').classList.add('hidden');
    }

    // Photos - Collect from previews
    const photos = [];
    const photoFiles = []; // New files to upload

    for (let i = 1; i <= 5; i++) {
        const preview = document.getElementById(`preview-photo${i}`);
        if (preview && preview.getAttribute('data-base64')) {
            const photoUrl = preview.getAttribute('data-base64');

            // If it's an existing URL (not base64), push it
            if (photoUrl.startsWith('http')) {
                photos.push(photoUrl);
            } else {
                // It's a base64, check if we have the file
                const file = preview._file;
                if (file) {
                    // It's a new file to upload
                    // For now, we'll keep the base64 in the photos array for local preview
                    // BUT we must replace it with the URL after upload
                    photos.push(photoUrl);
                    photoFiles.push({ index: i, file: file, base64: photoUrl });
                } else {
                    // Fallback: just keep the base64 if file is missing (shouldn't happen for new)
                    photos.push(photoUrl);
                }
            }
        }
    }

    if (photos.length === 0) {
        showNotification('Добавьте хотя бы одно фото!', 'error');
        return;
    }

    // Bio Validation
    let bio = form.bio.value.trim();
    bio = bio.replace(urlRegex, '[ссылка удалена]').trim(); // Replace URLs in bio

    if (!validateBio(bio)) {
        showNotification('Описание содержит недопустимые слова!', 'error');
        return;
    }

    // Collect Data
    const tribes = Array.from(form.querySelectorAll('input[name="tribes"]:checked')).map(cb => cb.value);

    // Handle Unit Conversion for Saving (Save as Metric)
    let height = null;
    let weight = parseInt(form.weight.value);

    // Convert to metric if needed
    if (state.unitSystem === 'imperial') {
        // Calculate height from feet/inches
        const feet = parseInt(form.height_ft.value || 0);
        const inches = parseInt(form.height_in.value || 0);

        if (feet > 0) {
            const totalInches = (feet * 12) + inches;
            height = Math.round(totalInches * 2.54);
        }

        // Convert Lbs to KG
        if (weight) weight = Math.round(weight / 2.20462);
    } else {
        // Metric
        height = parseInt(form.height.value);
    }

    // Validation: Height and Weight minimums (in metric)
    if (height && height < 120) {
        showNotification('⚠️ Минимальный рост: 120 см (47 дюймов)', 'error');
        return;
    }
    if (height && height > 300) {
        showNotification('⚠️ Максимальный рост: 300 см (118 дюймов)', 'error');
        return;
    }
    if (weight && weight < 30) {
        showNotification('⚠️ Минимальный вес: 30 кг (66 фунтов)', 'error');
        return;
    }
    if (weight && weight > 300) {
        showNotification('⚠️ Максимальный вес: 300 кг (661 фунт)', 'error');
        return;
    }

    const profileData = {
        name,
        dob,
        city,
        photos, // Contains mix of URLs and Base64s (temporarily)
        photoUrl: photos[0], // Backwards compatibility
        age, // Calculated
        height: height || null,  // Convert empty string to null for integer field
        weight: weight || null,  // Convert empty string to null for integer field
        bodyType: form.bodyType.value,
        orientation: form.orientation.value,
        role: form.role.value,
        tribes,
        bio,
        socials: {
            instagram: form.social_instagram.value.trim(),
            twitter: form.social_twitter.value.trim(),
            onlyfans: form.social_onlyfans.value.trim(),
            telegram: form.social_telegram.value.trim()
        }
    };

    // Save to state
    state.myProfile = profileData;
    state.pendingPhotoFiles = photoFiles; // Store files for later upload

    if (state.isOnboarding) {
        // Move to next onboarding step (Email registration) for EVERYONE
        // This ensures profile is saved to DB only after email is entered
        state.onboardingStep = 3;
        appContent.innerHTML = '';
        appContent.appendChild(tplEmail.cloneNode(true));
    } else {
        // Update profile in Supabase if user is authenticated
        try {
            showNotification('⏳ Сохранение профиля...', 'info');

            // 1. Delete photos marked for deletion
            const photosToDelete = [];
            for (let i = 1; i <= 5; i++) {
                const preview = document.getElementById(`preview-photo${i}`);
                if (preview && preview.getAttribute('data-marked-for-delete') === 'true') {
                    const photoUrl = preview.getAttribute('data-base64');
                    if (photoUrl && photoUrl.startsWith('https://')) {
                        photosToDelete.push(photoUrl);
                    }
                }
            }

            if (photosToDelete.length > 0) {
                const { deletePhotos: deletePhotosFromStorage } = await import('./supabase.js');
                await deletePhotosFromStorage(photosToDelete);
            }

            // 2. Upload new photos
            if (state.pendingPhotoFiles.length > 0) {
                const { uploadPhoto } = await import('./supabase.js');

                // We need to replace the base64s in profileData.photos with the new URLs
                // The photos array currently has [url1, base64_2, url3, ...]
                // pendingPhotoFiles has { index, file, base64 }

                // Let's rebuild the photos array
                const updatedPhotos = [...profileData.photos];

                for (const photoFile of state.pendingPhotoFiles) {
                    // Upload
                    const publicUrl = await uploadPhoto(state.userId, photoFile.file, photoFile.index);

                    // Find where this base64 was in the array and replace it
                    const idx = updatedPhotos.indexOf(photoFile.base64);
                    if (idx !== -1) {
                        updatedPhotos[idx] = publicUrl;
                    }
                }

                profileData.photos = updatedPhotos;
                profileData.photoUrl = updatedPhotos[0];
            }

            // 3. Update profile
            const { updateProfile } = await import('./supabase.js');
            await updateProfile(profileData);

            state.myProfile = profileData;
            state.pendingPhotoFiles = []; // Clear pending

            showNotification('✅ Профиль обновлен!', 'success');
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            showNotification('Ошибка сохранения профиля', 'error');
        }
        state.isEditingProfile = false;
        renderProfileView();
    }

    console.log('✅ Profile saved locally:', state.myProfile);
};

// ========================================
// ADMIN PANEL FUNCTIONS
// ========================================

async function renderAdminPanel() {
    appContent.innerHTML = '';
    const adminContainer = document.getElementById('template-admin-panel').content.cloneNode(true);

    appContent.appendChild(adminContainer);

    // Initialize admin state
    state.adminCurrentTab = state.adminCurrentTab || 'users';

    // Set up search listener
    const searchInput = document.getElementById('admin-search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.adminSearchQuery = e.target.value;
                state.adminCurrentPage = 1;
                if (state.adminCurrentTab === 'users') {
                    loadAdminUsers();
                } else if (state.adminCurrentTab === 'chats') {
                    loadAdminChats();
                } else if (state.adminCurrentTab === 'promocodes') {
                    loadAdminPromocodes();
                } else if (state.adminCurrentTab === 'transactions') {
                    loadAdminTransactions();
                } else if (state.adminCurrentTab === 'boosts') {
                    loadAdminBoosts();
                }
            }, 500);
        });
    }

    // Load initial tab
    if (state.adminCurrentTab === 'chats') {
        await loadAdminChats();
    } else if (state.adminCurrentTab === 'promocodes') {
        await loadAdminPromocodes();
    } else if (state.adminCurrentTab === 'transactions') {
        await loadAdminTransactions();
    } else if (state.adminCurrentTab === 'boosts') {
        await loadAdminBoosts();
    } else {
        await loadAdminUsers();
    }
}

async function loadAdminUsers() {
    try {
        showNotification('Загрузка пользователей...', 'info');

        const result = await getAllUsersWithPagination(
            state.adminCurrentPage,
            20,
            state.adminSearchQuery
        );

        state.adminUsers = result.users;
        state.adminTotalPages = result.totalPages;
        state.adminTotalCount = result.totalCount;

        // Update stats
        const totalUsers = document.getElementById('admin-total-users');
        const activeUsers = document.getElementById('admin-active-users');
        const bannedUsers = document.getElementById('admin-banned-users');

        if (totalUsers) totalUsers.textContent = result.totalCount;
        if (activeUsers) activeUsers.textContent = result.users.filter(u => !u.is_banned).length;
        if (bannedUsers) bannedUsers.textContent = result.users.filter(u => u.is_banned).length;

        // Render user list
        renderAdminUserList();
        renderAdminPagination();
    } catch (error) {
        console.error('❌ Error loading users:', error);
        showNotification('Ошибка загрузки пользователей', 'error');
    }
}

function renderAdminUserList() {
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (state.adminUsers.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12">
                <p class="text-xl opacity-70" style="color: var(--text-secondary);">
                    Пользователи не найдены
                </p>
            </div>
        `;
        return;
    }

    state.adminUsers.forEach(user => {
        const item = document.getElementById('template-admin-user-item').content.cloneNode(true);
        const itemDiv = item.querySelector('.admin-user-item');

        // Photo
        const photo = user.photos && user.photos.length > 0
            ? user.photos[0]
            : 'https://placehold.co/150x150?text=No+Photo';
        item.querySelector('.user-photo').src = photo;

        // Name
        item.querySelector('.user-name').textContent = user.name || 'Имя не указано';

        // Email
        item.querySelector('.user-email').textContent = user.email || 'Email неизвестен';

        // Additional info
        const age = user.dob ? calculateAge(user.dob) : '?';
        const city = user.city || 'Город не указан';
        item.querySelector('.user-info').textContent = `${age} лет • ${city}`;

        // Badges
        if (isUserVIP(user)) {
            item.querySelector('.vip-badge-admin').classList.remove('hidden');
        }
        if (user.is_admin) {
            item.querySelector('.admin-badge').classList.remove('hidden');
        }
        if (user.is_banned) {
            item.querySelector('.banned-badge').classList.remove('hidden');
        }

        // Click handler
        itemDiv.addEventListener('click', () => showAdminUserDetail(user.id));

        listContainer.appendChild(item);
    });
}

function renderAdminPagination() {
    const paginationContainer = document.getElementById('admin-pagination');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    if (state.adminTotalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'px-4 py-2 rounded-lg transition-all duration-300';
    prevBtn.textContent = '←';
    prevBtn.disabled = state.adminCurrentPage === 1;
    prevBtn.style.backgroundColor = 'var(--bg-card)';
    prevBtn.style.color = 'var(--text-primary)';
    if (state.adminCurrentPage === 1) {
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'not-allowed';
    } else {
        prevBtn.classList.add('hover-scale');
        prevBtn.onclick = () => {
            state.adminCurrentPage--;
            loadAdminUsers();
        };
    }
    paginationContainer.appendChild(prevBtn);

    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, state.adminCurrentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(state.adminTotalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'px-4 py-2 rounded-lg transition-all duration-300 hover-scale';
        pageBtn.textContent = i;
        pageBtn.style.backgroundColor = i === state.adminCurrentPage
            ? 'var(--gradient-start)'
            : 'var(--bg-card)';
        pageBtn.style.color = i === state.adminCurrentPage ? 'white' : 'var(--text-primary)';
        pageBtn.onclick = () => {
            state.adminCurrentPage = i;
            loadAdminUsers();
        };
        paginationContainer.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'px-4 py-2 rounded-lg transition-all duration-300';
    nextBtn.textContent = '→';
    nextBtn.disabled = state.adminCurrentPage === state.adminTotalPages;
    nextBtn.style.backgroundColor = 'var(--bg-card)';
    nextBtn.style.color = 'var(--text-primary)';
    if (state.adminCurrentPage === state.adminTotalPages) {
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
    } else {
        nextBtn.classList.add('hover-scale');
        nextBtn.onclick = () => {
            state.adminCurrentPage++;
            loadAdminUsers();
        };
    }
    paginationContainer.appendChild(nextBtn);
}

async function showAdminUserDetail(userId) {
    try {
        const user = await getUserById(userId);
        state.selectedUser = user;

        const modal = document.getElementById('admin-user-modal');
        const content = document.getElementById('admin-user-detail-content');

        if (!modal || !content) return;

        // Build user detail HTML
        const age = user.dob ? calculateAge(user.dob) : 'Не указан';
        const mainPhoto = user.photos && user.photos.length > 0
            ? user.photos[0]
            : 'https://placehold.co/400x400?text=No+Photo';

        content.innerHTML = `
            <div class="space-y-6">
                <!-- Photo -->
                <div class="flex justify-center">
                    <img src="${mainPhoto}" alt="${user.name}" 
                        class="w-48 h-48 rounded-2xl object-cover border-4 border-gray-200">
                </div>

                <!-- Basic Info -->
                <div>
                    <h3 class="text-xl font-bold mb-2" style="color: var(--text-primary);">
                        ${user.name || 'Имя не указано'}, ${age}
                        ${user.is_admin ? '<span class="ml-2 px-2 py-1 bg-orange-500 text-white text-xs rounded-full">ADMIN</span>' : ''}
                        ${user.is_banned ? '<span class="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">BANNED</span>' : ''}
                    </h3>
                    <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                        📧 ${user.email || 'Email не указан'}
                    </p>
                    <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                        📍 ${user.city || 'Город не указан'}
                    </p>
                    <p class="text-sm opacity-70" style="color: var(--text-secondary);">
                        🆔 ${user.id}
                    </p>
                    ${user.telegram_id ? `<p class="text-sm opacity-70" style="color: var(--text-secondary);">✈️ Telegram ID: ${user.telegram_id}</p>` : ''}
                </div>

                <!-- Stats -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-3 rounded-xl glass">
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">Рост</p>
                        <p class="font-bold" style="color: var(--text-primary);">${user.height ? user.height + ' см' : '--'}</p>
                    </div>
                    <div class="p-3 rounded-xl glass">
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">Вес</p>
                        <p class="font-bold" style="color: var(--text-primary);">${user.weight ? user.weight + ' кг' : '--'}</p>
                    </div>
                    <div class="p-3 rounded-xl glass">
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">Ориентация</p>
                        <p class="font-bold" style="color: var(--text-primary);">${user.orientation || '--'}</p>
                    </div>
                    <div class="p-3 rounded-xl glass">
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">Роль</p>
                        <p class="font-bold" style="color: var(--text-primary);">${user.role || '--'}</p>
                    </div>
                </div>

                <!-- Currency Management -->
                <div class="p-4 rounded-xl glass border-2" style="border-color: rgba(168, 85, 247, 0.3);">
                    <h4 class="font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                        <span class="text-2xl">💰</span>
                        Валюта пользователя
                    </h4>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-2" style="border-color: rgba(234, 179, 8, 0.3);">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-2xl">⭐</span>
                                <p class="text-xs opacity-70" style="color: var(--text-secondary);">Звезды</p>
                            </div>
                            <p class="text-2xl font-bold text-yellow-400">${user.stars || 0}</p>
                        </div>
                        <div class="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2" style="border-color: rgba(168, 85, 247, 0.3);">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-2xl">🚀</span>
                                <p class="text-xs opacity-70" style="color: var(--text-secondary);">Бусты</p>
                            </div>
                            <p class="text-2xl font-bold text-purple-400">${user.boosts || 0}</p>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <!-- Stars Management -->
                        <div>
                            <p class="text-sm font-semibold mb-2" style="color: var(--text-primary);">Управление звёздами</p>
                            <div class="flex gap-2">
                                <input type="number" id="stars-amount-${user.id}" placeholder="Кол-во" min="-1000" max="1000" value="10"
                                    class="flex-1 px-3 py-2 rounded-lg border-2 text-sm"
                                    style="background-color: var(--bg-primary); color: var(--text-primary); border-color: var(--border-color);">
                                <button onclick="handleAdminAdjustCurrency('${user.id}', 'stars', 'add')" 
                                    class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                                    ➕ Выдать
                                </button>
                                <button onclick="handleAdminAdjustCurrency('${user.id}', 'stars', 'remove')" 
                                    class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-700 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                                    ➖ Отнять
                                </button>
                            </div>
                        </div>

                        <!-- Boosts Management -->
                        <div>
                            <p class="text-sm font-semibold mb-2" style="color: var(--text-primary);">Управление бустами</p>
                            <div class="flex gap-2">
                                <input type="number" id="boosts-amount-${user.id}" placeholder="Кол-во" min="-100" max="100" value="5"
                                    class="flex-1 px-3 py-2 rounded-lg border-2 text-sm"
                                    style="background-color: var(--bg-primary); color: var(--text-primary); border-color: var(--border-color);">
                                <button onclick="handleAdminAdjustCurrency('${user.id}', 'boosts', 'add')" 
                                    class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                                    ➕ Выдать
                                </button>
                                <button onclick="handleAdminAdjustCurrency('${user.id}', 'boosts', 'remove')" 
                                    class="px-4 py-2 bg-gradient-to-r from-red-500 to-red-700 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                                    ➖ Отнять
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pinned Position Management -->
                <div class="p-4 rounded-xl glass border-2" style="border-color: rgba(249, 115, 22, 0.3);">
                    <h4 class="font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                        <span class="text-2xl">📌</span>
                        Закрепить в топе
                    </h4>
                    
                    <p class="text-sm mb-3 opacity-80" style="color: var(--text-secondary);">
                        Закрепленные пользователи всегда будут на указанной позиции, выше всех бустов.
                    </p>

                    <div class="flex gap-2 items-end">
                        <div class="flex-1">
                            <label class="block text-xs font-semibold mb-1" style="color: var(--text-secondary);">
                                Позиция (1-10)
                            </label>
                            <input type="number" id="pinned-position-${user.id}" 
                                   placeholder="1-10" min="1" max="10" value="${user.pinned_position || ''}"
                                   class="w-full px-3 py-2 rounded-lg border-2 text-sm"
                                   style="background-color: var(--bg-primary); color: var(--text-primary); border-color: var(--border-color);">
                        </div>
                        <button onclick="handleSetPinnedPosition('${user.id}')" 
                                class="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                            📌 Установить
                        </button>
                        <button onclick="handleUnpinUser('${user.id}')" 
                                class="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-700 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                            ✖️ Открепить
                        </button>
                    </div>

                    ${user.pinned_position ? `
                        <div class="mt-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                            <p class="text-sm font-semibold text-orange-400 text-center">
                                ⚡ Текущая позиция: ${user.pinned_position}
                            </p>
                        </div>
                    ` : ''}
                </div>

                <!-- VIP Subscription Management -->
                <div class="p-4 rounded-xl glass border-2" style="border-color: rgba(251, 191, 36, 0.3);">
                    <h4 class="font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
                        <span class="text-2xl">👑</span>
                        VIP Подписка
                    </h4>
                    
                    ${isUserVIP(user) ? `
                        <div class="mb-4 p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border-2" style="border-color: rgba(251, 191, 36, 0.3);">
                            <p class="text-sm font-bold text-yellow-400 mb-1">✨ Пользователь VIP</p>
                            <p class="text-xs opacity-80" style="color: var(--text-secondary);">
                                ${user.subscription_expires_at ? `Действует до: ${new Date(user.subscription_expires_at).toLocaleDateString('ru-RU')}` : 'VIP навсегда'}
                            </p>
                        </div>
                    ` : `
                        <p class="text-sm mb-3 opacity-80" style="color: var(--text-secondary);">
                            Пользователь не имеет VIP статуса
                        </p>
                    `}

                    <div class="flex gap-2 items-end">
                        <div class="flex-1">
                            <label class="block text-xs font-semibold mb-1" style="color: var(--text-secondary);">
                                Количество дней
                            </label>
                            <input type="number" id="vip-days-${user.id}" 
                                   placeholder="30" min="1" max="999999" value="30"
                                   class="w-full px-3 py-2 rounded-lg border-2 text-sm"
                                   style="background-color: var(--bg-primary); color: var(--text-primary); border-color: var(--border-color);">
                            <p class="text-xs opacity-70 mt-1" style="color: var(--text-secondary);">999999 = навсегда</p>
                        </div>
                        <button onclick="handleGrantVIP('${user.id}')" 
                                class="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 font-bold rounded-lg shadow-lg transition-all hover:scale-105 text-sm">
                            👑 Выдать VIP
                        </button>
                    </div>
                </div>

                <!-- Verification Status -->
                ${user.bio ? `
                <div>
                    <h4 class="font-bold mb-2" style="color: var(--text-primary);">О себе</h4>
                    <p style="color: var(--text-secondary);">${user.bio}</p>
                </div>
                ` : ''}

                <!-- Verification Status -->
                ${user.verification_status ? `
                <div class="p-4 rounded-xl" style="background-color: ${user.verification_status === 'verified' ? 'rgba(34, 197, 94, 0.1)' :
                    user.verification_status === 'pending' ? 'rgba(249, 115, 22, 0.1)' :
                        user.verification_status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' :
                            'rgba(156, 163, 175, 0.1)'
                }; border: 1px solid ${user.verification_status === 'verified' ? '#22c55e' :
                    user.verification_status === 'pending' ? '#f97316' :
                        user.verification_status === 'rejected' ? '#ef4444' :
                            '#9ca3af'
                };">
                    <h4 class="font-bold mb-2" style="color: var(--text-primary);">
                        ${user.verification_status === 'verified' ? '✅ Верификация: Подтверждена' :
                    user.verification_status === 'pending' ? '⏳ Верификация: На модерации' :
                        user.verification_status === 'rejected' ? '❌ Верификация: Отклонена' :
                            '⚠️ Верификация: Не верифицирован'}
                    </h4>
                    
                    ${user.verification_status === 'pending' && user.verification_photo ? `
                        <div class="mt-3">
                            <p class="text-sm mb-2" style="color: var(--text-secondary);">Требуемый жест:</p>
                            ${user.verification_gesture ? `
                                <div class="flex gap-4 mb-3 text-sm">
                                    <div class="flex items-center gap-2">
                                        <span class="font-semibold">Пальцев:</span>
                                        <span class="text-2xl">${user.verification_gesture.fingers || '?'}</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-semibold">Выражение:</span>
                                        <span>${user.verification_gesture.expression || '?'}</span>
                                    </div>
                                </div>
                            ` : ''}
                            <img src="${user.verification_photo}" alt="Фото верификации" 
                                class="w-full max-w-sm rounded-xl shadow-lg mx-auto">
                        </div>
                    ` : ''}
                    
                    ${user.verification_submitted_at ? `
                        <p class="text-xs mt-2 opacity-70" style="color: var(--text-secondary);">
                            Отправлено: ${new Date(user.verification_submitted_at).toLocaleString('ru-RU')}
                        </p>
                    ` : ''}
                </div>
                ` : ''}

                <!-- Dates -->
                <div>
                    <p class="text-xs opacity-70" style="color: var(--text-secondary);">
                        Зарегистрирован: ${user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : 'Неизвестно'}
                    </p>
                    ${user.banned_at ? `
                    <p class="text-xs opacity-70 text-red-500">
                        Забанен: ${new Date(user.banned_at).toLocaleDateString('ru-RU')}
                    </p>
                    ` : ''}
                </div>

                <!-- Actions -->
                <div class="space-y-3">
                    ${user.verification_status === 'pending' ? `
                        <div class="flex gap-3">
                            <button onclick="handleApproveVerification('${user.id}')" 
                                class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 ripple">
                                ✅ Одобрить верификацию
                            </button>
                            <button onclick="handleRejectVerification('${user.id}')" 
                                class="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 ripple">
                                ❌ Отклонить
                            </button>
                        </div>
                        <hr style="border-color: var(--border-color);">
                    ` : ''}
                    
                    <div class="flex gap-3">
                        ${user.is_banned ? `
                            <button onclick="handleUnbanUser('${user.id}')" 
                                class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 ripple">
                                ✅ Разбанить
                            </button>
                        ` : `
                            <button onclick="handleBanUser('${user.id}')" 
                                class="flex-1 bg-gradient-to-r from-red-500 to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 ripple">
                                🚫 Забанить
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('❌ Error loading user details:', error);
        showNotification('Ошибка загрузки данных пользователя', 'error');
    }
}

window.closeAdminUserModal = function () {
    const modal = document.getElementById('admin-user-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    state.selectedUser = null;
};

window.handleBanUser = async function (userId) {
    if (!confirm('Вы уверены, что хотите забанить этого пользователя?')) {
        return;
    }

    try {
        await banUser(userId);
        showNotification('✅ Пользователь забанен', 'success');
        closeAdminUserModal();
        await loadAdminUsers(); // Reload list
    } catch (error) {
        console.error('❌ Error banning user:', error);
        showNotification('Ошибка при бане пользователя', 'error');
    }
};

window.handleUnbanUser = async function (userId) {
    try {
        await unbanUser(userId);
        showNotification('✅ Пользователь разбанен', 'success');
        closeAdminUserModal();
        await loadAdminUsers(); // Reload list
    } catch (error) {
        console.error('❌ Error unbanning user:', error);
        showNotification('Ошибка при разбане пользователя', 'error');
    }
};

/**
 * Handle admin currency adjustment (stars/boosts)
 */
window.handleAdminAdjustCurrency = async function (userId, currencyType, action) {
    try {
        // Get amount from input
        const inputId = currencyType === 'stars' ? `stars-amount-${userId}` : `boosts-amount-${userId}`;
        const input = document.getElementById(inputId);

        if (!input) {
            throw new Error('Input not found');
        }

        const amount = parseInt(input.value);

        if (isNaN(amount) || amount === 0) {
            showNotification('Введите корректное количество', 'error');
            return;
        }

        // Calculate final amount (negative for remove)
        const finalAmount = action === 'remove' ? -Math.abs(amount) : Math.abs(amount);

        // Get current user data
        const user = state.selectedUser;
        if (!user) {
            throw new Error('User not selected');
        }

        // Calculate new value
        const currentValue = currencyType === 'stars' ? (user.stars || 0) : (user.boosts || 0);
        const newValue = Math.max(0, currentValue + finalAmount); // Don't allow negative

        // Update in database
        const supabase = getSupabase();
        const updateData = {};
        updateData[currencyType] = newValue;

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;

        const currencyName = currencyType === 'stars' ? 'звёзд' : 'бустов';
        const emoji = currencyType === 'stars' ? '⭐' : '🚀';
        const actionText = action === 'add' ? 'выдано' : 'отнято';

        showNotification(`${emoji} ${Math.abs(finalAmount)} ${currencyName} ${actionText}`, 'success');

        // Refresh user details
        const { data: updatedUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (updatedUser) {
            state.selectedUser = updatedUser;
            // Re-render modal with updated data
            const modal = document.getElementById('admin-user-modal');
            if (modal && !modal.classList.contains('hidden')) {
                closeAdminUserModal();
                setTimeout(() => {
                    // Re-open with updated data
                    window.location.hash = `#user-${userId}`;
                    renderAdminUserDetails(updatedUser);
                }, 200);
            }
        }

    } catch (error) {
        console.error('❌ Error adjusting currency:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Handle admin set pinned position
 */
window.handleSetPinnedPosition = async function (userId) {
    try {
        const input = document.getElementById(`pinned-position-${userId}`);
        if (!input) {
            throw new Error('Input not found');
        }

        const position = input.value ? parseInt(input.value) : null;

        if (position !== null && (position < 1 || position > 10)) {
            showNotification('Позиция должна быть от 1 до 10', 'error');
            return;
        }

        const result = await setPinnedPosition(userId, position);

        if (result.success) {
            showNotification(result.message, 'success');

            // Refresh user details
            closeAdminUserModal();
            setTimeout(() => showAdminUserDetail(userId), 200);
        } else {
            showNotification(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Error setting pinned position:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Handle admin unpin user
 */
window.handleUnpinUser = async function (userId) {
    if (!confirm('Открепить пользователя?')) return;

    try {
        const result = await setPinnedPosition(userId, null);

        if (result.success) {
            showNotification(result.message, 'success');

            // Refresh user details
            closeAdminUserModal();
            setTimeout(() => showAdminUserDetail(userId), 200);
        } else {
            showNotification(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Error unpinning user:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Handle admin grant VIP subscription
 */
window.handleGrantVIP = async function (userId) {
    try {
        const input = document.getElementById(`vip-days-${userId}`);
        if (!input) {
            throw new Error('Input not found');
        }

        const days = parseInt(input.value);

        if (isNaN(days) || days < 1) {
            showNotification('Введите корректное количество дней', 'error');
            return;
        }

        const confirmMessage = days === 999999
            ? 'Выдать VIP навсегда?'
            : `Выдать VIP на ${days} дней?`;

        if (!confirm(confirmMessage)) return;

        const result = await grantVIPSubscription(userId, days);

        if (result.success) {
            showNotification(result.message, 'success');

            // Refresh user details
            closeAdminUserModal();
            setTimeout(() => showAdminUserDetail(userId), 200);
        } else {
            showNotification(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Error granting VIP:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Handle verification approval (admin only)
 */
window.handleApproveVerification = async function (userId) {
    if (!confirm('Одобрить верификацию этого пользователя?')) return;

    try {
        await approveVerification(userId);
        showNotification('✅ Верификация одобрена!', 'success');
        closeAdminUserModal();
        await loadAdminUsers();
    } catch (error) {
        console.error('❌ Error approving verification:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Handle verification rejection (admin only)
 */
window.handleRejectVerification = async function (userId) {
    if (!confirm('Отклонить верификацию? Пользователю нужно будет пройти верификацию заново.')) return;

    try {
        await rejectVerification(userId);
        showNotification('❌ Верификация отклонена', 'success');
        closeAdminUserModal();
        await loadAdminUsers();
    } catch (error) {
        console.error('❌ Error rejecting verification:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Helper to escape HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Switch admin panel tabs between users, chats, and promocodes
 */
window.switchAdminTab = async function (tab) {
    state.adminCurrentTab = tab;
    state.adminSearchQuery = '';
    state.adminCurrentPage = 1;

    // Update UI
    const usersTab = document.getElementById('admin-tab-users');
    const chatsTab = document.getElementById('admin-tab-chats');
    const promocodesTab = document.getElementById('admin-tab-promocodes');
    const transactionsTab = document.getElementById('admin-tab-transactions');
    const boostsTab = document.getElementById('admin-tab-boosts');
    const searchInput = document.getElementById('admin-search-input');
    const statsSection = document.getElementById('admin-stats');
    const paginationSection = document.getElementById('admin-pagination');

    // Reset all tabs
    usersTab?.style.setProperty('color', 'var(--text-secondary)');
    usersTab?.style.setProperty('border-color', 'transparent');
    chatsTab?.style.setProperty('color', 'var(--text-secondary)');
    chatsTab?.style.setProperty('border-color', 'transparent');
    promocodesTab?.style.setProperty('color', 'var(--text-secondary)');
    promocodesTab?.style.setProperty('border-color', 'transparent');
    transactionsTab?.style.setProperty('color', 'var(--text-secondary)');
    transactionsTab?.style.setProperty('border-color', 'transparent');
    boostsTab?.style.setProperty('color', 'var(--text-secondary)');
    boostsTab?.style.setProperty('border-color', 'transparent');

    if (tab === 'users') {
        usersTab?.style.setProperty('color', 'var(--text-primary)');
        usersTab?.style.setProperty('border-color', 'var(--gradient-start)');
        if (searchInput) searchInput.placeholder = 'Поиск по имени, email или городу...';
        if (statsSection) statsSection.style.display = 'grid';
        if (paginationSection) paginationSection.style.display = 'flex';
        await loadAdminUsers();
    } else if (tab === 'chats') {
        chatsTab?.style.setProperty('color', 'var(--text-primary)');
        chatsTab?.style.setProperty('border-color', 'var(--gradient-start)');
        if (searchInput) searchInput.placeholder = 'Поиск по имени...';
        if (statsSection) statsSection.style.display = 'none';
        if (paginationSection) paginationSection.style.display = 'none';
        await loadAdminChats();
    } else if (tab === 'promocodes') {
        promocodesTab?.style.setProperty('color', 'var(--text-primary)');
        promocodesTab?.style.setProperty('border-color', 'var(--gradient-start)');
        if (searchInput) searchInput.placeholder = 'Поиск по коду...';
        if (statsSection) statsSection.style.display = 'none';
        if (paginationSection) paginationSection.style.display = 'none';
        await loadAdminPromocodes();
    } else if (tab === 'transactions') {
        transactionsTab?.style.setProperty('color', 'var(--text-primary)');
        transactionsTab?.style.setProperty('border-color', 'var(--gradient-start)');
        if (searchInput) searchInput.placeholder = 'Поиск транзакций...';
        if (statsSection) statsSection.style.display = 'none';
        if (paginationSection) paginationSection.style.display = 'none';
        await loadAdminTransactions();
    } else if (tab === 'boosts') {
        boostsTab?.style.setProperty('color', 'var(--text-primary)');
        boostsTab?.style.setProperty('border-color', 'var(--gradient-start)');
        if (searchInput) searchInput.placeholder = 'Поиск по имени...';
        if (statsSection) statsSection.style.display = 'none';
        if (paginationSection) paginationSection.style.display = 'none';
        await loadAdminBoosts();
    }
};

/**
 * Load all chats/matches for admin panel
 */
async function loadAdminChats() {
    const supabase = getSupabase();

    try {
        showNotification('Загрузка чатов...', 'info');

        // Get all matches with user info
        const { data: matches, error } = await supabase
            .from('matches')
            .select(`
                id,
                user1_id,
                user2_id,
                user1:profiles!user1_id(id, name, photos),
                user2:profiles!user2_id(id, name, photos),
                last_message_at,
                created_at
            `)
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        // Get last message for each match
        const matchesWithMessages = [];
        for (const match of matches || []) {
            const { data: messages, error: msgError } = await supabase
                .from('messages')
                .select('id, content, created_at')
                .eq('match_id', match.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!msgError && messages && messages.length > 0) {
                match.lastMessage = messages[0];
            }

            matchesWithMessages.push(match);
        }

        // Filter by search query if provided
        let filteredMatches = matchesWithMessages;
        if (state.adminSearchQuery) {
            const query = state.adminSearchQuery.toLowerCase();
            filteredMatches = matchesWithMessages.filter(match => {
                const user1Name = match.user1?.name?.toLowerCase() || '';
                const user2Name = match.user2?.name?.toLowerCase() || '';
                return user1Name.includes(query) || user2Name.includes(query);
            });
        }

        state.adminChats = filteredMatches;
        state.adminChatsTotalCount = filteredMatches.length;

        // Render chat list
        renderAdminChatsList();
        showNotification(`✅ Загружено ${filteredMatches.length} чатов`, 'success');
    } catch (error) {
        console.error('❌ Error loading chats:', error);
        showNotification('Ошибка загрузки чатов', 'error');
    }
}

/**
 * Render all chats list in admin panel
 */
function renderAdminChatsList() {
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) {
        console.error('❌ admin-users-list container not found');
        return;
    }

    listContainer.innerHTML = '';

    // Check if adminChats is initialized
    if (!state.adminChats || !Array.isArray(state.adminChats) || state.adminChats.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12">
                <p class="text-xl opacity-70" style="color: var(--text-secondary);">
                    Чаты не найдены
                </p>
            </div>
        `;
        return;
    }

    state.adminChats.forEach(match => {
        const template = document.getElementById('template-admin-chat-item');
        if (!template) {
            console.error('❌ template-admin-chat-item not found');
            return;
        }

        try {
            const item = template.content.cloneNode(true);

            // Determine which user is which
            const user1 = match.user1;
            const user2 = match.user2;

            // Create user pair info
            const userPhoto = user1?.photos?.[0] || user2?.photos?.[0] || 'https://placehold.co/50x50';
            const userName = `${user1?.name || 'User'} ↔️ ${user2?.name || 'User'}`;
            const lastMessage = match.lastMessage?.content || 'Нет сообщений';
            const lastMessageTime = match.last_message_at
                ? new Date(match.last_message_at).toLocaleString('ru-RU')
                : 'Нет сообщений';

            item.querySelector('.chat-user-photo').src = userPhoto;
            item.querySelector('.chat-user-name').textContent = userName;
            item.querySelector('.chat-last-message').textContent = lastMessage;
            item.querySelector('.chat-time').textContent = lastMessageTime;

            // Add click handler to view match details
            const chatItem = item.querySelector('.admin-chat-item');
            if (chatItem) {
                chatItem.addEventListener('click', () => {
                    showAdminChatDetail(match);
                });
            }

            listContainer.appendChild(item);
        } catch (error) {
            console.error('❌ Error rendering chat item:', error);
        }
    });
}

/**
 * Show chat detail in admin modal
 */
async function showAdminChatDetail(match) {
    const supabase = getSupabase();

    try {
        // Get all messages for this match
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('match_id', match.id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const user1 = match.user1;
        const user2 = match.user2;

        // Create modal content
        const content = `
            <div class="space-y-6">
                <!-- Users Info -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="text-center">
                        <img src="${user1?.photos?.[0] || 'https://placehold.co/100x100'}" alt="${user1?.name}"
                            class="w-24 h-24 rounded-2xl object-cover mx-auto mb-2 border-2"
                            style="border-color: var(--border-color);">
                        <h3 class="font-bold" style="color: var(--text-primary);">${user1?.name || 'User 1'}</h3>
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">${user1?.id || 'N/A'}</p>
                    </div>
                    <div class="text-center">
                        <img src="${user2?.photos?.[0] || 'https://placehold.co/100x100'}" alt="${user2?.name}"
                            class="w-24 h-24 rounded-2xl object-cover mx-auto mb-2 border-2"
                            style="border-color: var(--border-color);">
                        <h3 class="font-bold" style="color: var(--text-primary);">${user2?.name || 'User 2'}</h3>
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">${user2?.id || 'N/A'}</p>
                    </div>
                </div>

                <!-- Chat Info -->
                <div style="background-color: var(--bg-secondary); padding: 1rem; border-radius: 1rem;">
                    <p class="text-sm" style="color: var(--text-secondary);">
                        <strong>Матч создан:</strong> ${new Date(match.created_at).toLocaleString('ru-RU')}
                    </p>
                    <p class="text-sm mt-2" style="color: var(--text-secondary);">
                        <strong>Последнее сообщение:</strong> ${match.last_message_at ? new Date(match.last_message_at).toLocaleString('ru-RU') : 'Нет'}
                    </p>
                    <p class="text-sm mt-2" style="color: var(--text-secondary);">
                        <strong>Всего сообщений:</strong> ${messages?.length || 0}
                    </p>
                </div>

                <!-- Messages Preview -->
                <div style="border-top: 2px solid var(--border-color); padding-top: 1rem;">
                    <h4 class="font-bold mb-3" style="color: var(--text-primary);">Сообщения (последние 5)</h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        ${messages && messages.length > 0
                ? messages.slice(-5).map(msg => {
                    const sender = msg.sender_id === user1?.id ? user1?.name : user2?.name;
                    return `
                                    <div style="background-color: var(--bg-card); padding: 0.75rem; border-radius: 0.5rem; border-left: 3px solid var(--gradient-start);">
                                        <p class="text-xs font-bold" style="color: var(--gradient-start);">${sender}</p>
                                        <p class="text-sm mt-1" style="color: var(--text-primary); word-break: break-word;">${escapeHtml(msg.content)}</p>
                                        <p class="text-xs opacity-50 mt-1" style="color: var(--text-secondary);">${new Date(msg.created_at).toLocaleString('ru-RU')}</p>
                                    </div>
                                `;
                }).join('')
                : '<p style="color: var(--text-secondary);">Нет сообщений в этом чате</p>'
            }
                    </div>
                </div>
            </div>
        `;

        const modal = document.getElementById('admin-user-modal');
        const modalContent = document.getElementById('admin-user-detail-content');

        if (modal && modalContent) {
            const title = modal.querySelector('h2');
            if (title) title.textContent = '💬 Детали чата';
            modalContent.innerHTML = content;
            modal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('❌ Error loading chat detail:', error);
        showNotification('Ошибка загрузки деталей чата', 'error');
    }
}

// ========================================
// USER PROFILE MODAL
// ========================================

/**
 * Show user profile in a modal
 */
async function showUserProfileModal(userId) {
    try {
        const user = await getPublicUserProfile(userId);
        console.log('🔍 DEBUG - User object:', user);

        if (!user) {
            showNotification('Пользователь не найден', 'error');
            return;
        }

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'user-profile-modal';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modal.style.animation = 'fadeIn 0.3s ease-out';

        // Calculate age
        const age = user.dob ? calculateAge(user.dob) : '?';

        // Build user profile content
        const mainPhoto = user.photos && user.photos.length > 0
            ? user.photos[0]
            : 'https://placehold.co/400x400?text=No+Photo';

        const content = `
            <style>
                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .profile-card {
                    animation: slideInUp 0.5s ease-out;
                }

                .profile-section {
                    animation: slideInUp 0.5s ease-out;
                }

                .stat-card {
                    transition: all 0.3s ease;
                    animation: scaleIn 0.4s ease-out backwards;
                    border: 1.5px solid var(--border-color);
                    position: relative;
                    overflow: hidden;
                }

                .stat-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, var(--accent-color), transparent);
                }

                .stat-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
                    border-color: var(--accent-color);
                }

                .photo-gallery img {
                    animation: fadeIn 0.6s ease-out;
                    transition: transform 0.3s ease;
                    border: 2px solid var(--border-color);
                }

                .photo-gallery img:hover {
                    transform: scale(1.02);
                    border-color: var(--accent-color);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .section-title {
                    position: relative;
                    padding-bottom: 12px;
                    margin-bottom: 16px;
                }

                .section-title::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 40px;
                    height: 3px;
                    background: linear-gradient(90deg, var(--accent-color), transparent);
                    border-radius: 2px;
                }

                .tribe-badge {
                    animation: scaleIn 0.4s ease-out backwards;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .tribe-badge:hover {
                    transform: scale(1.05);
                    border-color: var(--accent-color);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                .social-link {
                    transition: all 0.3s ease;
                    border: 1.5px solid var(--border-color);
                    position: relative;
                    overflow: hidden;
                }

                .social-link::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: linear-gradient(180deg, var(--accent-color), transparent);
                }

                .social-link:hover {
                    transform: translateX(4px);
                    border-color: var(--accent-color);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
            </style>

            <div class="profile-card rounded-3xl max-w-3xl w-full max-h-[95vh] overflow-y-auto"
                style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%); padding: 24px; scrollbar-width: thin; scrollbar-color: var(--accent-color) transparent;">

                <!-- Header with Boost & Close Button -->
                <div class="flex justify-between items-center mb-6 pb-6" style="border-bottom: 1px solid var(--border-color);">
                    <div>
                        <h2 class="text-3xl font-bold" style="color: var(--text-primary);">Профиль</h2>
                        <p class="text-sm opacity-60" style="color: var(--text-secondary);">Полная информация пользователя</p>
                    </div>
                    <div class="flex gap-2">
                        <!-- Boost Button -->
                        <button id="boost-user-btn" onclick="handleBoostUser('${user.id}')"
                            class="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 hover:scale-105"
                            style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; font-weight: 600; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                            <span style="font-size: 18px;">🚀</span>
                            <span>Забустить</span>
                        </button>
                        
                        <!-- Close Button -->
                        <button onclick="closeUserProfileModal()"
                            class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:rotate-90"
                            style="background-color: var(--bg-secondary); color: var(--text-secondary);">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                                stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="space-y-4">
                    <!-- Photo Gallery -->
                    ${user.photos && user.photos.length > 0 ? `
                        <div class="profile-section photo-gallery">
                            <div class="rounded-2xl overflow-hidden">
                                ${user.photos.length > 1 ? `
                                    <div class="grid grid-cols-2 gap-2">
                                        ${user.photos.map((photo, index) => `
                                            <img src="${photo}" alt="Photo ${index + 1}"
                                                class="w-full rounded-xl object-cover ${index === 0 ? 'col-span-2 h-48' : 'h-32'}"
                                                style="border: 2px solid ${isUserVIP(user) ? '#fbbf24' : 'var(--border-color)'};">
                                        `).join('')}
                                    </div>
                                ` : `
                                    <img src="${user.photos[0]}" alt="Photo 1"
                                        class="w-full h-56 rounded-xl object-cover"
                                        style="border: 2px solid ${isUserVIP(user) ? '#fbbf24' : 'var(--border-color)'};">
                                `}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Main Info Card -->
                    <div class="profile-section rounded-2xl p-4" style="background-color: var(--bg-card); border: 2px solid var(--border-color); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--accent-color), transparent);"></div>
                        <div class="text-center">
                            <div class="flex items-center justify-center gap-2 mb-1">
                                <h3 class="text-3xl font-bold" style="color: var(--text-primary);">
                                    ${user.name || 'Имя не указано'}
                                </h3>
                                ${isUserVIP(user) ? '<span style="font-size: 20px;">👑</span>' : ''}
                            </div>
                            <p class="text-lg font-semibold mb-2" style="color: var(--accent-color);">${age} лет</p>
                            ${user.city ? `<p class="text-base flex items-center justify-center gap-2" style="color: var(--text-secondary);">📍 ${user.city}</p>` : ''}
                        </div>
                    </div>

                    <!-- Boost Status Display (will be updated via JS) -->
                    <div id="boost-status-display"></div>

                    <!-- Physical Stats -->
                    ${user.height || user.weight || user.body_type ? `
                    <div class="profile-section">
                        <h4 class="text-base font-bold section-title" style="color: var(--text-primary);">О теле</h4>
                        <div class="grid grid-cols-3 gap-2">
                            ${user.height ? `
                                <div class="stat-card p-3 rounded-lg" style="background-color: var(--bg-secondary); animation-delay: 0s;">
                                    <p class="text-xs font-semibold mb-1 uppercase" style="color: var(--accent-color);">📏 Рост</p>
                                    <p class="text-xl font-bold" style="color: var(--text-primary);">${user.height}</p>
                                    <p class="text-xs opacity-60" style="color: var(--text-secondary);">см</p>
                                </div>
                            ` : ''}
                            ${user.weight ? `
                                <div class="stat-card p-3 rounded-lg" style="background-color: var(--bg-secondary); animation-delay: 0.1s;">
                                    <p class="text-xs font-semibold mb-1 uppercase" style="color: var(--accent-color);">⚖️ Вес</p>
                                    <p class="text-xl font-bold" style="color: var(--text-primary);">${user.weight}</p>
                                    <p class="text-xs opacity-60" style="color: var(--text-secondary);">кг</p>
                                </div>
                            ` : ''}
                            ${user.body_type ? `
                                <div class="stat-card p-3 rounded-lg" style="background-color: var(--bg-secondary); animation-delay: 0.2s;">
                                    <p class="text-xs font-semibold mb-1 uppercase" style="color: var(--accent-color);">💪 Тело</p>
                                    <p class="text-sm font-bold" style="color: var(--text-primary);">${user.body_type}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Preferences -->
                    ${user.orientation || user.role ? `
                    <div class="profile-section">
                        <h4 class="text-base font-bold section-title" style="color: var(--text-primary);">Предпочтения</h4>
                        <div class="grid grid-cols-2 gap-2">
                            ${user.orientation ? `
                                <div class="stat-card p-3 rounded-lg" style="background-color: var(--bg-secondary); animation-delay: 0.3s;">
                                    <p class="text-xs font-semibold mb-1 uppercase" style="color: var(--accent-color);">💗 Ориент.</p>
                                    <p class="text-sm font-bold capitalize" style="color: var(--text-primary);">${user.orientation}</p>
                                </div>
                            ` : ''}
                            ${user.role ? `
                                <div class="stat-card p-3 rounded-lg" style="background-color: var(--bg-secondary); animation-delay: 0.4s;">
                                    <p class="text-xs font-semibold mb-1 uppercase" style="color: var(--accent-color);">👥 Роль</p>
                                    <p class="text-sm font-bold capitalize" style="color: var(--text-primary);">${user.role}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Tribes/Interests -->
                    ${user.tribes && user.tribes.length > 0 ? `
                        <div class="profile-section">
                            <h4 class="text-base font-bold section-title" style="color: var(--text-primary);">🎭 Интересы</h4>
                            <div class="flex flex-wrap gap-1 p-3 rounded-lg" style="background-color: var(--bg-secondary); border: 1.5px solid var(--border-color); position: relative;">
                                <div style="position: absolute; top: 0; right: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, transparent, var(--accent-color)); border-radius: 0 8px 8px 0;"></div>
                                ${user.tribes.map((tribe, index) => `
                                    <span class="tribe-badge px-3 py-1 rounded-full text-xs font-semibold cursor-default"
                                        style="background: linear-gradient(135deg, var(--accent-color) 0%, var(--bg-secondary) 100%); color: var(--text-primary); animation-delay: ${index * 0.05}s;">
                                        ✨ ${tribe}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Bio Section -->
                    ${user.bio ? `
                        <div class="profile-section">
                            <h4 class="text-base font-bold section-title" style="color: var(--text-primary);">📝 О себе</h4>
                            <div class="p-3 rounded-lg" style="background-color: var(--bg-secondary); border: 1.5px solid var(--border-color); position: relative;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, var(--accent-color), transparent); border-radius: 0 0 0 8px;"></div>
                                <p class="leading-relaxed text-sm" style="color: var(--text-secondary);">${escapeHtml(user.bio)}</p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Social Links -->
                    ${user.social_instagram || user.social_twitter || user.social_telegram || user.social_onlyfans ? `
                        <div class="profile-section">
                            <h4 class="text-base font-bold section-title" style="color: var(--text-primary);">🔗 Соцсети</h4>
                            <div class="space-y-1">
                                ${user.social_instagram ? `
                                    <a href="https://instagram.com/${user.social_instagram}" target="_blank"
                                        class="social-link flex items-center gap-2 p-2 rounded-lg text-sm"
                                        style="background-color: var(--bg-secondary); color: var(--text-primary); text-decoration: none;">
                                        <span>📷</span>
                                        <span class="font-semibold">@${user.social_instagram}</span>
                                    </a>
                                ` : ''}
                                ${user.social_twitter ? `
                                    <a href="https://twitter.com/${user.social_twitter}" target="_blank"
                                        class="social-link flex items-center gap-2 p-2 rounded-lg text-sm"
                                        style="background-color: var(--bg-secondary); color: var(--text-primary); text-decoration: none;">
                                        <span>𝕏</span>
                                        <span class="font-semibold">@${user.social_twitter}</span>
                                    </a>
                                ` : ''}
                                ${user.social_telegram ? `
                                    <a href="https://t.me/${user.social_telegram}" target="_blank"
                                        class="social-link flex items-center gap-2 p-2 rounded-lg text-sm"
                                        style="background-color: var(--bg-secondary); color: var(--text-primary); text-decoration: none;">
                                        <span>✈️</span>
                                        <span class="font-semibold">@${user.social_telegram}</span>
                                    </a>
                                ` : ''}
                                ${user.social_onlyfans ? `
                                    <a href="${user.social_onlyfans}" target="_blank"
                                        class="social-link flex items-center gap-2 p-2 rounded-lg text-sm"
                                        style="background-color: var(--bg-secondary); color: var(--text-primary); text-decoration: none;">
                                        <span>🔞</span>
                                        <span class="font-semibold">OnlyFans</span>
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Verification Status -->
                    ${user.is_verified ? `
                        <div class="profile-section p-3 rounded-lg text-center" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.3);">
                            <p class="text-base font-bold" style="color: var(--text-primary);">✅ Профиль верифицирован</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        modal.innerHTML = content;

        // Close modal on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeUserProfileModal();
            }
        });

        document.body.appendChild(modal);

        // Check and display boost status
        updateBoostStatusDisplay(userId);

    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

window.closeUserProfileModal = function () {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.remove();
    }
};

/**
 * Update boost status display for a user
 * @param {string} userId - User ID to check boost status for
 */
async function updateBoostStatusDisplay(userId) {
    try {
        const boostStatus = await getBoostStatus(userId);
        const statusDisplay = document.getElementById('boost-status-display');

        if (!statusDisplay) return;

        if (boostStatus.isBoosted) {
            statusDisplay.innerHTML = `
                <div class="profile-section rounded-2xl p-4 text-center animate-pulse" 
                    style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%); border: 2px solid rgba(139, 92, 246, 0.5);">
                    <div class="flex items-center justify-center gap-2">
                        <span style="font-size: 24px;">🚀</span>
                        <div>
                            <p class="text-lg font-bold" style="color: var(--text-primary);">В топе мира!</p>
                            <p class="text-sm" style="color: var(--text-secondary);">Ещё ${boostStatus.minutesRemaining} мин</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            statusDisplay.innerHTML = '';
        }
    } catch (error) {
        console.error('❌ Error updating boost status:', error);
    }
}

/**
 * Handle boosting a user
 * @param {string} targetUserId - ID of user to boost
 */
window.handleBoostUser = async function (targetUserId) {
    try {
        // Get current user's boost balance
        const currency = await getUserCurrency();

        if (currency.boosts < 1) {
            showNotification('У вас недостаточно бустов! Купите бусты в магазине.', 'error');
            return;
        }

        // Show confirmation dialog
        const confirmed = confirm(
            `Забустить пользователя?\n\n` +
            `Это будет стоить 1 буст.\n` +
            `Пользователь получит +10 минут в топе мира.\n\n` +
            `Ваш баланс: ${currency.boosts} бустов`
        );

        if (!confirmed) return;

        // Disable boost button
        const boostBtn = document.getElementById('boost-user-btn');
        if (boostBtn) {
            boostBtn.disabled = true;
            boostBtn.style.opacity = '0.6';
            boostBtn.innerHTML = '<span style="font-size: 18px;">⏳</span> <span>Обработка...</span>';
        }

        // Call boost function
        const result = await boostUser(targetUserId);

        if (result.success) {
            // Show success with confetti
            createConfetti();
            showNotification(`✨ Пользователь забустен! +${result.minutesAdded} минут в топе`, 'success');

            // Update boost status display
            await updateBoostStatusDisplay(targetUserId);

            // Re-enable button with updated text
            if (boostBtn) {
                boostBtn.disabled = false;
                boostBtn.style.opacity = '1';
                boostBtn.innerHTML = '<span style="font-size: 18px;">🚀</span> <span>Забустить ещё</span>';
            }
        } else {
            showNotification(result.message || 'Ошибка буста', 'error');

            // Re-enable button
            if (boostBtn) {
                boostBtn.disabled = false;
                boostBtn.style.opacity = '1';
                boostBtn.innerHTML = '<span style="font-size: 18px;">🚀</span> <span>Забустить</span>';
            }
        }

    } catch (error) {
        console.error('❌ Error handling boost:', error);
        showNotification('Произошла ошибка при бусте', 'error');

        // Re-enable button
        const boostBtn = document.getElementById('boost-user-btn');
        if (boostBtn) {
            boostBtn.disabled = false;
            boostBtn.style.opacity = '1';
            boostBtn.innerHTML = '<span style="font-size: 18px;">🚀</span> <span>Забустить</span>';
        }
    }
};


// ========================================
// CHAT FUNCTIONS
// ========================================

window.openChatWithMatch = async function (matchId, match) {
    console.log('💬 Opening chat with match:', matchId);

    try {
        // Initialize chat
        await initializeChat(matchId, match);

        // Render chat view
        appContent.innerHTML = '';
        const chatContainer = document.getElementById('template-chat').content.cloneNode(true);

        // Set user info in header
        const otherUser = match.user1_id === state.userId ? match.user2 : match.user1;

        // Store other user ID in state for message sending
        state.currentChatRecipientId = otherUser?.id;

        chatContainer.querySelector('#chat-user-name').textContent = otherUser?.name || 'User';
        const chatUserPhoto = chatContainer.querySelector('#chat-user-photo');
        chatUserPhoto.src = otherUser?.photos?.[0] || 'https://placehold.co/50x50';

        // Check and display online status with VIP privacy check
        const statusElement = chatContainer.querySelector('#chat-user-status');
        if (statusElement && otherUser?.id) {
            const onlineStatus = await getUserOnlineStatus(otherUser.id);
            if (onlineStatus.hidden) {
                statusElement.textContent = '';
            } else if (onlineStatus.isOnline) {
                statusElement.textContent = 'в сети';
            } else {
                statusElement.textContent = '';
            }
        }

        // Add click handler to view user profile
        chatUserPhoto.style.cursor = 'pointer';
        chatUserPhoto.addEventListener('click', () => {
            if (otherUser?.id) {
                showUserProfileModal(otherUser.id);
            }
        });

        appContent.appendChild(chatContainer);

        // Render messages (await the async function)
        await renderAllMessages(chatState.messages);

        // Set up message input
        const input = document.getElementById('message-input');
        if (input) {
            input.addEventListener('input', () => {
                const sendBtn = document.getElementById('send-btn');
                if (sendBtn) {
                    sendBtn.disabled = !input.value.trim();
                }
            });
            input.focus();
        }

        console.log('✅ Chat opened successfully');
    } catch (error) {
        console.error('❌ Error opening chat:', error);
        showNotification('Ошибка открытия чата', 'error');
    }
};

window.handleSendMessage = async function (event) {
    event.preventDefault();

    const input = document.getElementById('message-input');
    if (!input || !input.value.trim()) return;

    const text = input.value;
    input.value = '';

    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.disabled = true;

    try {
        // Pass recipientId for permission check
        const recipientId = state.currentChatRecipientId || null;
        await sendMessage(chatState.activeMatchId, text, recipientId);
        scrollToBottom();
        // Focus input for next message
        input.focus();
    } catch (error) {
        console.error('Error sending message:', error);
        // Restore text if sending failed
        input.value = text;
    } finally {
        if (sendBtn) sendBtn.disabled = !input.value.trim();
    }
};

window.closeChatModal = function () {
    console.log('🔌 Closing chat');
    closeChat();
    state.currentChatRecipientId = null; // Clear recipient ID
    navigate('matches');
};

window.renderChatsList = async function () {
    console.log('💬 Rendering chats list');

    appContent.innerHTML = '';
    const chatsContainer = document.getElementById('template-chats-list').content.cloneNode(true);

    try {
        const matches = await getMatchesWithMessages(state.userId);
        const listEl = chatsContainer.querySelector('#chats-list');
        const noChatsEl = chatsContainer.querySelector('#no-chats');

        if (!matches || matches.length === 0) {
            if (noChatsEl) noChatsEl.classList.remove('hidden');
            if (listEl) listEl.innerHTML = '';
        } else {
            if (noChatsEl) noChatsEl.classList.add('hidden');
            if (listEl) {
                listEl.innerHTML = '';

                for (const match of matches) {
                    const otherUser = match.user1_id === state.userId ? match.user2 : match.user1;
                    if (!otherUser) continue;

                    const item = document.getElementById('template-chat-item').content.cloneNode(true);

                    item.querySelector('.chat-avatar').src = otherUser.photos?.[0] || 'https://placehold.co/100x100';
                    item.querySelector('.chat-name').textContent = otherUser.name || 'User';

                    // Get last message info
                    const lastMessageTime = match.last_message_at
                        ? new Date(match.last_message_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                        : '';
                    item.querySelector('.chat-time').textContent = lastMessageTime;

                    // Set placeholder for last message
                    item.querySelector('.chat-last-message').textContent = 'Нажмите для открытия чата';

                    // Set click handler
                    const chatItem = item.querySelector('.chat-item');
                    if (chatItem) {
                        chatItem.onclick = () => window.openChatWithMatch(match.id, match);
                    }

                    // Get unread count
                    const unreadCount = await getUnreadCount(match.id);
                    if (unreadCount > 0) {
                        const badge = item.querySelector('.chat-unread-badge');
                        if (badge) {
                            badge.classList.remove('hidden');
                            badge.textContent = unreadCount;
                        }
                    }

                    listEl.appendChild(item);
                }
            }
        }

        appContent.appendChild(chatsContainer);

        // Set up search
        const searchInput = chatsContainer.querySelector('#chats-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const items = listEl.querySelectorAll('.chat-item');

                items.forEach(item => {
                    const name = item.querySelector('.chat-name').textContent.toLowerCase();
                    item.style.display = name.includes(query) ? '' : 'none';
                });
            });
        }
    } catch (error) {
        console.error('❌ Error rendering chats:', error);
        showNotification('Ошибка загрузки чатов', 'error');
    }
};

// ========================================
// ADMIN PROMOCODES FUNCTIONS
// ========================================

/**
 * Load all promocodes for admin panel
 */
async function loadAdminPromocodes() {
    try {
        showNotification('Загрузка промокодов...', 'info');

        const promocodes = await getAllPromocodes();

        // Filter by search query if provided
        let filteredPromocodes = promocodes;
        if (state.adminSearchQuery) {
            const query = state.adminSearchQuery.toLowerCase();
            filteredPromocodes = promocodes.filter(promo =>
                promo.code.toLowerCase().includes(query)
            );
        }

        state.adminPromocodes = filteredPromocodes;

        // Render promocodes list
        renderAdminPromocodesList();
        showNotification(`✅ Загружено ${filteredPromocodes.length} промокодов`, 'success');
    } catch (error) {
        console.error('❌ Error loading promocodes:', error);
        showNotification('Ошибка загрузки промокодов', 'error');
    }
}

/**
 * Render promocodes list in admin panel
 */
function renderAdminPromocodesList() {
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) {
        console.error('❌ admin-users-list container not found');
        return;
    }

    listContainer.innerHTML = '';

    // Add "Create Promocode" button
    const createButton = document.createElement('button');
    createButton.className = 'w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all duration-300 hover:scale-[1.02] mb-6 flex items-center justify-center gap-3';
    createButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Создать Промокод
    `;
    createButton.onclick = showCreatePromocodeModal;
    listContainer.appendChild(createButton);

    // Check if promocodes exist
    if (!state.adminPromocodes || !Array.isArray(state.adminPromocodes) || state.adminPromocodes.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-center py-12';
        emptyDiv.innerHTML = `
            <p class="text-xl opacity-70" style="color: var(--text-secondary);">
                Промокоды не найдены
            </p>
        `;
        listContainer.appendChild(emptyDiv);
        return;
    }

    // Create promocodes table
    const table = document.createElement('div');
    table.className = 'glass rounded-2xl overflow-hidden';
    table.style.border = '1px solid var(--border-color)';

    let tableHTML = `
        <table class="w-full">
            <thead class="bg-white/5">
                <tr>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Код</th>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Тип</th>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Награда</th>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Использований</th>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Истекает</th>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Статус</th>
                    <th class="px-4 py-3 text-left font-bold" style="color: var(--text-primary);">Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    state.adminPromocodes.forEach(promo => {
        const rewardTypeEmoji = {
            'stars': '⭐',
            'boosts': '🚀',
            'vip': '👑'
        };

        const rewardTypeText = {
            'stars': 'Звезды',
            'boosts': 'Бусты',
            'vip': 'VIP'
        };

        const usageText = promo.max_uses
            ? `${promo.current_uses || 0}/${promo.max_uses}`
            : `${promo.current_uses || 0}/∞`;

        const expiresText = promo.expires_at
            ? new Date(promo.expires_at).toLocaleDateString('ru-RU')
            : 'Никогда';

        const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date();
        const isMaxedOut = promo.max_uses && (promo.current_uses >= promo.max_uses);
        const isActive = promo.is_active && !isExpired && !isMaxedOut;

        const statusBadge = isActive
            ? '<span class="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Активен</span>'
            : '<span class="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs">Неактивен</span>';

        tableHTML += `
            <tr class="border-t hover:bg-white/5 transition-colors" style="border-color: var(--border-color);">
                <td class="px-4 py-4">
                    <span class="font-bold" style="color: var(--text-primary);">${promo.code}</span>
                </td>
                <td class="px-4 py-4">
                    <span>${rewardTypeEmoji[promo.reward_type]} ${rewardTypeText[promo.reward_type]}</span>
                </td>
                <td class="px-4 py-4">
                    <span class="font-semibold">${promo.reward_amount}</span>
                </td>
                <td class="px-4 py-4">
                    <span>${usageText}</span>
                </td>
                <td class="px-4 py-4">
                    <span class="text-sm">${expiresText}</span>
                </td>
                <td class="px-4 py-4">
                    ${statusBadge}
                </td>
                <td class="px-4 py-4">
                    ${isActive ? `
                        <button onclick="handleDeactivatePromocode('${promo.id}')"
                            class="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors">
                            Деактивировать
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    table.innerHTML = tableHTML;
    listContainer.appendChild(table);
}

/**
 * Show create promocode modal
 */
window.showCreatePromocodeModal = function () {
    const modal = document.createElement('div');
    modal.id = 'create-promocode-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="glass rounded-2xl p-6 max-w-md w-full" style="border: 1px solid var(--border-color);">
            <h2 class="text-2xl font-bold mb-4" style="color: var(--text-primary);">
                🎁 Создать Промокод
            </h2>
            <form id="create-promocode-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
                        Код промокода
                    </label>
                    <input
                        type="text"
                        id="promo-code"
                        placeholder="WELCOME2024"
                        required
                        class="w-full px-4 py-3 rounded-xl border-2"
                        style="border-color: var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary);"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
                        Тип награды
                    </label>
                    <select
                        id="promo-reward-type"
                        required
                        class="w-full px-4 py-3 rounded-xl border-2"
                        style="border-color: var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary);"
                    >
                        <option value="stars">⭐ Звезды</option>
                        <option value="boosts">🚀 Бусты</option>
                        <option value="vip">👑 VIP (дни)</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
                        Количество
                    </label>
                    <input
                        type="number"
                        id="promo-reward-amount"
                        placeholder="100"
                        required
                        min="1"
                        class="w-full px-4 py-3 rounded-xl border-2"
                        style="border-color: var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary);"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
                        Макс. использований (опционально)
                    </label>
                    <input
                        type="number"
                        id="promo-max-uses"
                        placeholder="Не ограничено"
                        min="1"
                        class="w-full px-4 py-3 rounded-xl border-2"
                        style="border-color: var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary);"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
                        Срок действия (опционально)
                    </label>
                    <input
                        type="datetime-local"
                        id="promo-expires-at"
                        class="w-full px-4 py-3 rounded-xl border-2"
                        style="border-color: var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary);"
                    />
                </div>

                <div class="flex gap-3 mt-6">
                    <button type="button" onclick="closeCreatePromocodeModal()" class="flex-1 px-4 py-3 rounded-xl bg-gray-600 text-white font-semibold">
                        Отмена
                    </button>
                    <button type="submit" class="flex-1 px-4 py-3 rounded-xl bg-green-500 text-white font-semibold">
                        Создать
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // Handle form submission
    document.getElementById('create-promocode-form').addEventListener('submit', handleCreatePromocode);
};

window.closeCreatePromocodeModal = function () {
    const modal = document.getElementById('create-promocode-modal');
    if (modal) modal.remove();
};

/**
 * Handle promocode creation
 */
async function handleCreatePromocode(e) {
    e.preventDefault();

    const code = document.getElementById('promo-code').value.trim();
    const reward_type = document.getElementById('promo-reward-type').value;
    const reward_amount = parseInt(document.getElementById('promo-reward-amount').value);
    const max_uses = document.getElementById('promo-max-uses').value
        ? parseInt(document.getElementById('promo-max-uses').value)
        : null;
    const expires_at = document.getElementById('promo-expires-at').value || null;

    try {
        await createPromocode({
            code,
            reward_type,
            reward_amount,
            max_uses,
            expires_at
        });

        showNotification('✅ Промокод создан!', 'success');
        closeCreatePromocodeModal();
        await loadAdminPromocodes();
    } catch (error) {
        console.error('❌ Error creating promocode:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

/**
 * Handle promocode deactivation
 */
window.handleDeactivatePromocode = async function (promocodeId) {
    if (!confirm('Деактивировать этот промокод?')) return;

    try {
        await deactivatePromocode(promocodeId);
        showNotification('✅ Промокод деактивирован', 'success');
        await loadAdminPromocodes();
    } catch (error) {
        console.error('❌ Error deactivating promocode:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
};

/**
 * Load all boost history for admin panel
 */
async function loadAdminBoosts() {
    try {
        showNotification('Загрузка истории бустов...', 'info');

        const boosts = await getAllBoostHistory(200); // Load latest 200

        // Filter by search query if provided
        let filteredBoosts = boosts;
        if (state.adminSearchQuery) {
            const query = state.adminSearchQuery.toLowerCase();
            filteredBoosts = boosts.filter(boost =>
                boost.booster?.name?.toLowerCase().includes(query) ||
                boost.boosted?.name?.toLowerCase().includes(query) ||
                boost.booster?.email?.toLowerCase().includes(query) ||
                boost.boosted?.email?.toLowerCase().includes(query)
            );
        }

        state.adminBoosts = filteredBoosts;

        // Render boosts list
        renderAdminBoostsList();
        showNotification(`✅ Загружено ${filteredBoosts.length} бустов`, 'success');
    } catch (error) {
        console.error('❌ Error loading boosts:', error);
        showNotification('Ошибка загрузки бустов', 'error');
    }
}

/**
 * Render boost history list in admin panel
 */
function renderAdminBoostsList() {
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) {
        console.error('❌ admin-users-list container not found');
        return;
    }

    listContainer.innerHTML = '';

    if (!state.adminBoosts || state.adminBoosts.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12">
                <p class="text-xl font-bold mb-2" style="color: var(--text-primary);">Нет бустов</p>
                <p class="text-sm opacity-70" style="color: var(--text-secondary);">История бустов пока пуста</p>
            </div>
        `;
        return;
    }

    // Create table for boosts
    const table = document.createElement('div');
    table.className = 'overflow-x-auto';
    table.innerHTML = `
        <table class="w-full" style="border-collapse: collapse;">
            <thead>
                <tr class="border-b-2" style="border-color: var(--border-color);">
                    <th class="px-4 py-3 text-left text-sm font-bold" style="color: var(--text-primary);">Кто</th>
                    <th class="px-4 py-3 text-left text-sm font-bold" style="color: var(--text-primary);">Кого</th>
                    <th class="px-4 py-3 text-left text-sm font-bold" style="color: var(--text-primary);">Дата</th>
                </tr>
            </thead>
            <tbody id="boosts-table-body">
            </tbody>
        </table>
    `;

    listContainer.appendChild(table);

    const tbody = document.getElementById('boosts-table-body');

    state.adminBoosts.forEach(boost => {
        const createdAt = new Date(boost.created_at);
        const formattedDate = createdAt.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-white/5 transition-colors';
        row.style.borderColor = 'var(--border-color)';

        row.innerHTML = `
            <td class="px-4 py-4">
                <div class="flex items-center gap-3">
                    <div>
                        <p class="font-semibold" style="color: var(--text-primary);">${boost.booster?.name || 'N/A'}</p>
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">${boost.booster?.email || 'N/A'}</p>
                    </div>
                </div>
            </td>
            <td class="px-4 py-4">
                <div class="flex items-center gap-3">
                    <div>
                        <p class="font-semibold" style="color: var(--text-primary);">${boost.boosted?.name || 'N/A'}</p>
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">${boost.boosted?.email || 'N/A'}</p>
                    </div>
                </div>
            </td>
            <td class="px-4 py-4">
                <span class="text-sm" style="color: var(--text-secondary);">${formattedDate}</span>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// ========================================
// DEBUG FUNCTIONS (available in console)
// ========================================

window.debugAllLikes = debugGetAllLikes;

/**
 * Load all transactions for admin panel
 */
async function loadAdminTransactions() {
    try {
        showNotification('Загрузка транзакций...', 'info');

        const result = await getAllTransactions(1, 100, 'all'); // Load first 100

        state.adminTransactions = result.transactions;

        // Render transactions list
        renderAdminTransactionsList();
        showNotification(`✅ Загружено ${result.transactions.length} транзакций`, 'success');
    } catch (error) {
        console.error('❌ Error loading transactions:', error);
        showNotification('Ошибка загрузки транзакций', 'error');
    }
}

/**
 * Render transactions list in admin panel
 */
function renderAdminTransactionsList() {
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) {
        console.error('❌ admin-users-list container not found');
        return;
    }

    listContainer.innerHTML = '';

    // Check if transactions exist
    if (!state.adminTransactions || !Array.isArray(state.adminTransactions) || state.adminTransactions.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12">
                <p class="text-xl opacity-70" style="color: var(--text-secondary);">
                    Транзакции не найдены
                </p>
            </div>
        `;
        return;
    }

    // Create transactions table
    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b-2" style="border-color: var(--border-color);">
                        <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: var(--text-secondary);">Тип</th>
                        <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: var(--text-secondary);">Пользователь</th>
                        <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: var(--text-secondary);">Детали</th>
                        <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: var(--text-secondary);">Сумма</th>
                        <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: var(--text-secondary);">Статус</th>
                        <th class="px-4 py-3 text-left text-xs font-bold uppercase" style="color: var(--text-secondary);">Дата</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Iterate through transactions
    state.adminTransactions.forEach(transaction => {
        // Transaction type badge
        const typeBadge = transaction.transaction_type === 'vip'
            ? '<span class="px-2 py-1 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-400 rounded-full text-xs font-bold">👑 VIP</span>'
            : '<span class="px-2 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 rounded-full text-xs font-bold">💰 Валюта</span>';

        // Details
        let details = '';
        if (transaction.transaction_type === 'vip') {
            details = `${transaction.package_type} (${transaction.vip_days === 999999 ? 'Навсегда' : transaction.vip_days + ' дней'})`;
        } else {
            details = `${transaction.currency_type === 'stars' ? '⭐' : '🚀'} ${transaction.amount} ${transaction.currency_type === 'stars' ? 'звёзд' : 'бустов'}`;
        }

        // Status badge
        let statusBadge = '';
        const status = transaction.payment_status;
        if (status === 'finished') {
            statusBadge = '<span class="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">✅ Оплачен</span>';
        } else if (status === 'waiting' || status === 'pending') {
            statusBadge = '<span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">⏳ Ожидание</span>';
        } else if (status === 'failed') {
            statusBadge = '<span class="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">❌ Ошибка</span>';
        } else {
            statusBadge = `<span class="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs">${status}</span>`;
        }

        // Format date
        const date = new Date(transaction.created_at).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const transactionIndex = state.adminTransactions.indexOf(transaction);

        tableHTML += `
            <tr class="border-t hover:bg-white/5 transition-colors cursor-pointer" 
                style="border-color: var(--border-color);"
                onclick="showTransactionDetail(${transactionIndex})">
                <td class="px-4 py-4">
                    ${typeBadge}
                </td>
                <td class="px-4 py-4">
                    <div>
                        <p class="font-semibold" style="color: var(--text-primary);">${transaction.user_name}</p>
                        <p class="text-xs opacity-70" style="color: var(--text-secondary);">${transaction.user_email}</p>
                    </div>
                </td>
                <td class="px-4 py-4">
                    <span class="text-sm" style="color: var(--text-primary);">${details}</span>
                </td>
                <td class="px-4 py-4">
                    <span class="font-bold text-green-400">$${transaction.price_amount}</span>
                </td>
                <td class="px-4 py-4">
                    ${statusBadge}
                </td>
                <td class="px-4 py-4">
                    <span class="text-xs" style="color: var(--text-secondary);">${date}</span>
                </td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    listContainer.innerHTML = tableHTML;
}

/**
 * Show transaction detail modal
 */
window.showTransactionDetail = function (transactionIndex) {
    const transaction = state.adminTransactions[transactionIndex];
    if (!transaction) return;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'transaction-detail-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    const isVIP = transaction.transaction_type === 'vip';
    const statusColor = transaction.payment_status === 'finished' ? 'green' :
        transaction.payment_status === 'waiting' || transaction.payment_status === 'pending' ? 'yellow' :
            'red';

    modal.innerHTML = `
        <div class="glass rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" style="border: 1px solid var(--border-color);">
            <div class="flex justify-between items-start mb-6">
                <h2 class="text-2xl font-bold" style="color: var(--text-primary);">
                    ${isVIP ? '👑' : '💰'} Детали транзакции
                </h2>
                <button onclick="closeTransactionDetail()" class="text-gray-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="space-y-4">
                <!-- Type & Status -->
                <div class="flex gap-3">
                    <span class="px-3 py-1 ${isVIP ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-400' : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400'} rounded-full text-sm font-bold">
                        ${isVIP ? '👑 VIP Подписка' : '💰 Покупка валюты'}
                    </span>
                    <span class="px-3 py-1 bg-${statusColor}-500/20 text-${statusColor}-400 rounded-full text-sm font-bold">
                        ${transaction.payment_status}
                    </span>
                </div>

                <!-- User Info -->
                <div class="p-4 rounded-xl glass">
                    <h3 class="font-bold mb-2" style="color: var(--text-primary);">Пользователь</h3>
                    <p style="color: var(--text-secondary);"><strong>Имя:</strong> ${transaction.user_name}</p>
                    <p style="color: var(--text-secondary);"><strong>Email:</strong> ${transaction.user_email}</p>
                    <p style="color: var(--text-secondary);"><strong>ID:</strong> ${transaction.user_id}</p>
                </div>

                <!-- Package Details -->
                <div class="p-4 rounded-xl glass">
                    <h3 class="font-bold mb-2" style="color: var(--text-primary);">Детали пакета</h3>
                    ${isVIP ? `
                        <p style="color: var(--text-secondary);"><strong>Тип:</strong> ${transaction.package_type}</p>
                        <p style="color: var(--text-secondary);"><strong>Дней:</strong> ${transaction.vip_days === 999999 ? 'Навсегда' : transaction.vip_days}</p>
                        <p style="color: var(--text-secondary);"><strong>Бонус звёзд:</strong> ${transaction.bonus_stars}</p>
                    ` : `
                        <p style="color: var(--text-secondary);"><strong>Пакет:</strong> ${transaction.package_type}</p>
                        <p style="color: var(--text-secondary);"><strong>Тип валюты:</strong> ${transaction.currency_type === 'stars' ? '⭐ Звёзды' : '🚀 Бусты'}</p>
                        <p style="color: var(--text-secondary);"><strong>Количество:</strong> ${transaction.amount}</p>
                    `}
                </div>

                <!-- Payment Info -->
                <div class="p-4 rounded-xl glass">
                    <h3 class="font-bold mb-2" style="color: var(--text-primary);">Платёжная информация</h3>
                    <p style="color: var(--text-secondary);"><strong>Order ID:</strong> ${transaction.order_id}</p>
                    ${transaction.invoice_id ? `<p style="color: var(--text-secondary);"><strong>Invoice ID:</strong> ${transaction.invoice_id}</p>` : ''}
                    ${transaction.payment_id ? `<p style="color: var(--text-secondary);"><strong>Payment ID:</strong> ${transaction.payment_id}</p>` : ''}
                    <p style="color: var(--text-secondary);"><strong>Цена:</strong> <span class="text-green-400 font-bold">$${transaction.price_amount} ${transaction.price_currency?.toUpperCase()}</span></p>
                    ${transaction.actually_paid ? `<p style="color: var(--text-secondary);"><strong>Оплачено:</strong> ${transaction.actually_paid} ${transaction.pay_currency?.toUpperCase()}</p>` : ''}
                </div>

                <!-- Timestamps -->
                <div class="p-4 rounded-xl glass">
                    <h3 class="font-bold mb-2" style="color: var(--text-primary);">Даты</h3>
                    <p style="color: var(--text-secondary);"><strong>Создано:</strong> ${new Date(transaction.created_at).toLocaleString('ru-RU')}</p>
                    ${transaction.updated_at && transaction.updated_at !== transaction.created_at ? `<p style="color: var(--text-secondary);"><strong>Обновлено:</strong> ${new Date(transaction.updated_at).toLocaleString('ru-RU')}</p>` : ''}
                    ${transaction.paid_at ? `<p style="color: var(--text-secondary);"><strong>Оплачено:</strong> ${new Date(transaction.paid_at).toLocaleString('ru-RU')}</p>` : ''}
                    ${transaction.activated_at ? `<p style="color: var(--text-secondary);"><strong>Активировано:</strong> ${new Date(transaction.activated_at).toLocaleString('ru-RU')}</p>` : ''}
                </div>

                ${transaction.invoice_url ? `
                    <a href="${transaction.invoice_url}" target="_blank" 
                       class="block w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl text-center hover:scale-105 transition-all">
                        🔗 Открыть инвойс
                    </a>
                ` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.closeTransactionDetail = function () {
    const modal = document.getElementById('transaction-detail-modal');
    if (modal) modal.remove();
};

// ========================================
// START APPLICATION
// ========================================

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

console.log('✅ Main application script loaded');
console.log('💡 Tip: Use debugAllLikes() in console to see all likes in database');
