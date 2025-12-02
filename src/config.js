/**
 * SPARK DATING APP - CONFIGURATION
 * Environment configuration using Vite environment variables
 */

// Environment configuration
// These values come from .env file in development
// and from Vercel environment variables in production
export const config = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

// Log configuration status (without exposing secrets)
if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    console.log('✅ Supabase configuration loaded');
} else {
    console.warn('⚠️ Supabase credentials not configured. Running in demo mode.');
}

export default config;
