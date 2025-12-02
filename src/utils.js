/**
 * SPARK DATING APP - UTILITY FUNCTIONS
 * Вспомогательные функции для приложения
 */

/**
 * Create background particles
 */
export function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

/**
 * Create floating hearts animation
 */
export function createFloatingHearts() {
    const container = document.getElementById('swipe-card-container');
    if (!container) return;

    for (let i = 0; i < 10; i++) {
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.textContent = '❤️';
        heart.style.left = Math.random() * 100 + '%';
        heart.style.fontSize = (Math.random() * 20 + 20) + 'px';
        heart.style.animationDelay = (Math.random() * 0.5) + 's';
        heart.style.zIndex = '1000';
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 2000);
    }
}

/**
 * Create confetti effect
 */
export function createConfetti() {
    const modal = document.getElementById('match-modal');
    if (!modal) return;

    const colors = ['#ef4444', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        modal.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
    }
}

/**
 * Create Super Like effect (Star Burst)
 */
export function createSuperLikeEffect() {
    const container = document.body;

    // Create big star in center
    const bigStar = document.createElement('div');
    bigStar.className = 'fixed inset-0 flex items-center justify-center pointer-events-none z-[100]';
    bigStar.innerHTML = `
        <div class="text-9xl animate-bounce-in text-blue-400 drop-shadow-[0_0_50px_rgba(96,165,250,0.8)]">
            ⭐
        </div>
    `;
    container.appendChild(bigStar);
    setTimeout(() => bigStar.remove(), 1000);

    // Create exploding stars
    for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.className = 'fixed text-4xl pointer-events-none z-[99] text-blue-400';
        star.innerHTML = '⭐';

        // Random position around center
        const angle = Math.random() * Math.PI * 2;
        const velocity = 10 + Math.random() * 20;
        const tx = Math.cos(angle) * 500; // Fly out distance
        const ty = Math.sin(angle) * 500;

        star.style.left = '50%';
        star.style.top = '50%';
        star.style.transform = 'translate(-50%, -50%)';
        star.style.transition = 'all 1s cubic-bezier(0.16, 1, 0.3, 1)';

        container.appendChild(star);

        // Trigger animation
        requestAnimationFrame(() => {
            star.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
            star.style.opacity = '0';
        });

        setTimeout(() => star.remove(), 1000);
    }
}

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info)
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 modal-enter ${type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
        } text-white`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

/**
 * Generate random user ID
 * @returns {string} Random user ID
 */
export function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get mock profiles data
 * @returns {Array} Array of profile objects
 */
export function getMockProfiles() {
    return [
        {
            id: 'u1',
            name: 'Анна',
            age: 24,
            photoUrl: 'https://i.pravatar.cc/600?img=1',
            bio: 'Обожаю путешествия, книги и кофе ☕'
        },
        {
            id: 'u2',
            name: 'Дмитрий',
            age: 28,
            photoUrl: 'https://i.pravatar.cc/600?img=12',
            bio: 'Программист днем, музыкант ночью 🎸'
        },
        {
            id: 'u3',
            name: 'Елена',
            age: 26,
            photoUrl: 'https://i.pravatar.cc/600?img=5',
            bio: 'Фотограф и любитель приключений 📸'
        },
        {
            id: 'u4',
            name: 'Алексей',
            age: 30,
            photoUrl: 'https://i.pravatar.cc/600?img=15',
            bio: 'Спорт, кино и хорошая компания 🏋️'
        },
        {
            id: 'u5',
            name: 'Мария',
            age: 23,
            photoUrl: 'https://i.pravatar.cc/600?img=9',
            bio: 'Танцы, музыка и позитив! 💃'
        },
        {
            id: 'u6',
            name: 'Сергей',
            age: 27,
            photoUrl: 'https://i.pravatar.cc/600?img=13',
            bio: 'Люблю готовить и пробовать новое 👨‍🍳'
        },
        {
            id: 'u7',
            name: 'Ольга',
            age: 25,
            photoUrl: 'https://i.pravatar.cc/600?img=10',
            bio: 'Йога, медитация и саморазвитие 🧘‍♀️'
        },
        {
            id: 'u8',
            name: 'Игорь',
            age: 32,
            photoUrl: 'https://i.pravatar.cc/600?img=14',
            bio: 'IT-предприниматель и путешественник 🌍'
        },
        {
            id: 'u9',
            name: 'Виктория',
            age: 22,
            photoUrl: 'https://i.pravatar.cc/600?img=16',
            bio: 'Студентка, модель и мечтательница ✨'
        },
        {
            id: 'u10',
            name: 'Андрей',
            age: 29,
            photoUrl: 'https://i.pravatar.cc/600?img=11',
            bio: 'Любитель экстрима и активного отдыха 🚴'
        }
    ];
}

/**
 * Calculate age from date of birth
 * @param {string} dob - Date of birth in YYYY-MM-DD format
 * @returns {number} Age in years
 */
export function calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

/**
 * Validate bio text for bad words
 * @param {string} text - Bio text to validate
 * @returns {boolean} True if valid, false if contains bad words
 */
export function validateBio(text) {
    if (!text) return true;

    // Simple list of bad words/patterns (can be expanded)
    const badWords = ['badword', 'spam', 'scam', 'hate', 'abuse'];
    const lowerText = text.toLowerCase();

    for (const word of badWords) {
        if (lowerText.includes(word)) {
            return false;
        }
    }

    // Check for gibberish (e.g., too many consecutive consonants)
    // This is a very basic check
    const consonantClusters = /[bcdfghjklmnpqrstvwxyz]{6,}/i;
    if (consonantClusters.test(text)) {
        return false;
    }

    return true;
}

/**
 * Check if text contains URLs
 * @param {string} text - Text to check for URLs
 * @returns {boolean} True if contains URL, false otherwise
 */
export function containsURL(text) {
    if (!text) return false;

    // Various URL patterns to catch
    const urlPatterns = [
        // http:// or https://
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
        // www. pattern
        /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
        // Domain without protocol (e.g., link.net, example.com, site.io)
        // Matches: word.tld or word.word.tld with 2+ letter TLD
        /\b[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.[a-zA-Z]{2,}\b/gi,
        // Subdomains (e.g., sub.domain.com)
        /\b[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+\.([a-zA-Z]{2,})\b/gi,
        // Telegram handles
        /@[a-zA-Z0-9_]{5,32}/g,
        // Common TLDs with @ or without http (backup pattern)
        /[a-zA-Z0-9-]+\.(com|ru|org|net|info|io|me|app|xyz|cc|us|uk|de|co|biz|gov|edu|mil)\b/gi
    ];

    // Check against all patterns
    for (const pattern of urlPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }

    return false;
}

/**
 * Compress image file
 * @param {File} file - Image file
 * @param {number} maxWidth - Maximum width
 * @param {number} quality - JPEG quality (0 to 1)
 * @returns {Promise<string>} Compressed image as Base64
 */
export function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}
