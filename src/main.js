/**
 * PRIDE GUARD - MAIN ENTRY POINT
 * Main application initialization
 */

import { createClient } from '@supabase/supabase-js';
import { initTheme } from './theme.js';
import './app.js';

// Initialize theme on app load
initTheme();

console.log('✅ Pride Guard - Main module loaded');
