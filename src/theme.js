/**
 * SPARK DATING APP - THEME MANAGER
 * Управление темной/светлой темой приложения
 */

/**
 * Initialize theme system
 */
export function initTheme() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    // Helper to update Telegram Web App
    const updateTelegramTheme = (isDark) => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            const bgColor = isDark ? '#1e293b' : '#ffffff'; // Match --bg-secondary
            const headerColor = isDark ? '#1e293b' : '#ffffff';

            // Update background and header colors
            tg.setBackgroundColor(bgColor);
            if (tg.setHeaderColor) {
                tg.setHeaderColor(headerColor);
            }
        }
    };

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Apply saved theme on page load
    if (savedTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        if (themeToggle) {
            themeToggle.checked = true;
        }
        updateTelegramTheme(true);
    } else {
        updateTelegramTheme(false);
    }

    // Theme toggle event listener
    if (themeToggle) {
        themeToggle.addEventListener('change', function () {
            if (this.checked) {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                updateTelegramTheme(true);
            } else {
                html.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                updateTelegramTheme(false);
            }
        });
    }

    console.log('✅ Theme Manager initialized');
}

export default initTheme;
