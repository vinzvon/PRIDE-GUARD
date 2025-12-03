/**
 * SPARK DATING APP - SUPABASE CLIENT
 * Supabase client initialization and management
 */

import { createClient } from '@supabase/supabase-js';
import config from './config.js';

// Initialize Supabase client
let supabaseClient = null;

/**
 * Initialize the Supabase client
 * @returns {Object} Supabase client instance
 * @throws {Error} If Supabase credentials are not configured
 */
function initSupabase() {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
        throw new Error(
            '❌ Supabase configuration missing!\n' +
            'Please add to your .env file:\n' +
            'VITE_SUPABASE_URL=your_url\n' +
            'VITE_SUPABASE_ANON_KEY=your_key\n' +
            'Get these from: https://supabase.com/dashboard'
        );
    }

    try {
        supabaseClient = createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY
        );
        console.log('✅ Supabase client initialized successfully');
        return supabaseClient;
    } catch (error) {
        console.error('❌ Error initializing Supabase client:', error);
        throw error;
    }
}

/**
 * Get the Supabase client instance
 * @returns {Object|null} Supabase client instance
 */
export function getSupabase() {
    if (!supabaseClient) {
        supabaseClient = initSupabase();
    }
    return supabaseClient;
}

/**
 * Register user with email and save profile
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} profileData - User profile data
 * @returns {Promise<Object>} User and profile data
 */
export async function registerUserWithProfile(email, password, profileData) {
    const supabase = getSupabase();

    try {
        // Sign up user with metadata
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: profileData.name,
                    bio: profileData.bio,
                    city: profileData.city
                }
            }
        });

        if (authError) throw authError;

        const userId = authData.user.id;

        // Try to sign in user immediately after signup
        // This allows RLS policies to work (auth.uid() will be available)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            console.warn('⚠️ Auto sign-in after registration failed:', signInError.message);
            console.warn('💡 Hint: If "Email not confirmed" error - disable "Confirm email" in Supabase Authentication settings');
        }

        // Wait for trigger to complete and session to establish
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: profileRes, error: profileError } = await supabase
            .from('profiles')
            .update({
                name: profileData.name,
                dob: profileData.dob,
                city: profileData.city,
                bio: profileData.bio,
                height: profileData.height,
                weight: profileData.weight,
                body_type: profileData.bodyType,
                orientation: profileData.orientation,
                role: profileData.role,
                tribes: profileData.tribes,
                photos: profileData.photos,
                socials: profileData.socials,
                verification_status: 'not_verified'
            })
            .eq('id', userId)
            .select()
            .single();

        if (profileError) throw profileError;

        console.log('✅ User and profile saved to Supabase');
        return { user: authData.user, profile: profileRes };
    } catch (error) {
        console.error('❌ Error registering user:', error);
        throw error;
    }
}

/**
 * Get all profiles (excluding current user)
 * Sorting priority: 1) Pinned position, 2) Active boosted users, 3) Regular users
 * @param {string} currentUserId - Current user ID to exclude
 * @returns {Promise<Array>} Array of profiles
 */
export async function getProfiles(currentUserId = null) {
    const supabase = getSupabase();

    try {
        let query = supabase.from('profiles').select('*');

        if (currentUserId) {
            query = query.neq('id', currentUserId);
        }

        // Only show verified profiles in the dating section
        query = query.eq('verification_status', 'verified');

        // Order by:
        // 1. Pinned position (1-10, ascending, nulls last)
        // 2. Active boost (boost_expires_at > NOW), then by remaining time
        // 3. Created at (newest first)
        const { data, error } = await query
            .order('pinned_position', { ascending: true, nullsFirst: false })
            .limit(50);

        if (error) throw error;

        // Post-process: sort by active boost status
        const now = new Date();
        const sorted = (data || []).sort((a, b) => {
            // First sort by pinned position
            const aPin = a.pinned_position ?? 999;
            const bPin = b.pinned_position ?? 999;
            if (aPin !== bPin) return aPin - bPin;

            // Then by active boost
            const aBoostActive = a.boost_expires_at && new Date(a.boost_expires_at) > now;
            const bBoostActive = b.boost_expires_at && new Date(b.boost_expires_at) > now;

            if (aBoostActive && !bBoostActive) return -1;
            if (!aBoostActive && bBoostActive) return 1;

            // If both boosted, sort by remaining time (longer first)
            if (aBoostActive && bBoostActive) {
                return new Date(b.boost_expires_at) - new Date(a.boost_expires_at);
            }

            // Finally by created_at (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return sorted;
    } catch (error) {
        console.error('❌ Error fetching profiles:', error);
        return [];
    }
}

/**
 * Get current user's profile
 * @returns {Promise<Object|null>} Current user's profile or null
 */
export async function getCurrentUserProfile() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

        return data || null;
    } catch (error) {
        console.error('❌ Error fetching current user profile:', error);
        return null;
    }
}

/**
 * Get public user profile by ID (no admin check required)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getPublicUserProfile(userId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

        console.log('✅ User profile data loaded:', data);
        return data || null;
    } catch (error) {
        console.error('❌ Error fetching user profile:', error);
        return null;
    }
}

/**
 * Update current user's profile
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} Updated profile
 */
export async function updateProfile(profileData) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('User not authenticated');

        console.log(`🔄 Updating profile for user ${user.id}...`, profileData);

        const { data, error } = await supabase
            .from('profiles')
            .update({
                name: profileData.name,
                dob: profileData.dob,
                city: profileData.city,
                bio: profileData.bio,
                height: profileData.height,
                weight: profileData.weight,
                body_type: profileData.bodyType,
                orientation: profileData.orientation,
                role: profileData.role,
                tribes: profileData.tribes,
                photos: profileData.photos,
                socials: profileData.socials,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) {
            console.error('❌ Supabase update error:', error);
            throw error;
        }

        console.log('✅ Profile updated in Supabase:', data);
        return data;
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        throw error;
    }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
    const supabase = getSupabase();

    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log('✅ User signed out');
    } catch (error) {
        console.error('❌ Error signing out:', error);
        throw error;
    }
}

/**
 * Save a like to the database
 * @param {string} likedUserId - ID of the user being liked
 * @returns {Promise<Object>} {success: boolean, isNew: boolean, data: Object|null}
 */
export async function saveLike(likedUserId) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('likes')
            .insert({
                user_id: user.id,
                liked_user_id: likedUserId
            })
            .select()
            .single();

        if (error) {
            // UNIQUE constraint violation means already liked this user
            if (error.code === '23505' || error.status === 409) {
                console.log('⚠️ Already liked this user');
                return { success: true, isNew: false, data: null };
            }
            throw error;
        }

        console.log('✅ Like saved');
        return { success: true, isNew: true, data };
    } catch (error) {
        console.error('❌ Error saving like:', error);
        return { success: false, isNew: false, data: null };
    }
}

/**
 * Check if a specific user already liked the current user
 * @param {string} otherUserId - ID of the user to check
 * @returns {Promise<boolean>} True if mutual match, false otherwise
 */
export async function checkMutualMatch(otherUserId) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('❌ No user logged in');
            return { isMutualMatch: false, matchId: null };
        }

        console.log(`🔍 Checking if user ${otherUserId} liked user ${user.id}`);

        const { data, error } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', otherUserId)
            .eq('liked_user_id', user.id)
            .limit(1);

        if (error) {
            console.error('❌ Error checking mutual match:', error);
            return { isMutualMatch: false, matchId: null };
        }

        const isMutual = data && data.length > 0;
        console.log(`📊 Mutual match result: ${isMutual ? 'YES ✅' : 'NO ❌'} (found ${data?.length || 0} records)`);

        if (isMutual) {
            // Get or create the match record
            const { data: matchData, error: matchError } = await supabase
                .from('matches')
                .select('id')
                .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
                .limit(1);

            if (!matchError && matchData && matchData.length > 0) {
                return { isMutualMatch: true, matchId: matchData[0].id };
            } else {
                // Create new match
                const { data: newMatch, error: createError } = await supabase
                    .from('matches')
                    .insert([
                        {
                            user1_id: user.id,
                            user2_id: otherUserId,
                            created_at: new Date().toISOString()
                        }
                    ])
                    .select('id');

                if (!createError && newMatch && newMatch.length > 0) {
                    return { isMutualMatch: true, matchId: newMatch[0].id };
                }
            }
        }

        return { isMutualMatch: isMutual, matchId: null };
    } catch (error) {
        console.error('❌ Error checking mutual match:', error);
        return { isMutualMatch: false, matchId: null };
    }
}

/**
 * Get all profiles that liked the current user
 * @returns {Promise<Array>} Array of user IDs that liked current user
 */
export async function getLikedByOthers() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const { data, error } = await supabase
            .from('likes')
            .select('user_id')
            .eq('liked_user_id', user.id);

        if (error) throw error;

        return data ? data.map(like => like.user_id) : [];
    } catch (error) {
        console.error('❌ Error fetching liked by others:', error);
        return [];
    }
}

/**
 * Debug: Get all likes (for debugging only)
 */
export async function debugGetAllLikes() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('❌ Not logged in');
            return;
        }

        // Get all likes FROM current user
        const { data: myLikes, error: error1 } = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', user.id);

        // Get all likes TO current user
        const { data: likesForMe, error: error2 } = await supabase
            .from('likes')
            .select('*')
            .eq('liked_user_id', user.id);

        console.log('═══════════════════════════════════════');
        console.log(`🔐 Current user ID: ${user.id}`);
        console.log('═══════════════════════════════════════');

        if (error1) {
            console.error('❌ Error fetching my likes:', error1);
        } else {
            console.log(`❤️ Likes I gave (${myLikes?.length || 0}):`);
            myLikes?.forEach((like, i) => {
                console.log(`   ${i + 1}. I liked: ${like.liked_user_id}`);
            });
        }

        console.log('───────────────────────────────────────');

        if (error2) {
            console.error('❌ Error fetching likes for me:', error2);
        } else {
            console.log(`💕 Likes I got (${likesForMe?.length || 0}):`);
            likesForMe?.forEach((like, i) => {
                console.log(`   ${i + 1}. Liked by: ${like.user_id}`);
            });
        }

        console.log('═══════════════════════════════════════');
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

/**
 * Check if Telegram user already exists
 * @param {number} telegramId - Telegram user ID
 * @returns {Promise<Object|null>} User profile if exists, null otherwise
 */
export async function checkTelegramUser(telegramId) {
    const supabase = getSupabase();

    try {
        console.log(`🔍 Checking if Telegram user ${telegramId} exists...`);

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('telegram_id', telegramId)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = not found (expected for new users)
            throw error;
        }

        if (data) {
            console.log(`✅ Found existing Telegram user: ${data.id}`);
            return data;
        }

        console.log(`ℹ️ Telegram user ${telegramId} not found in database`);
        return null;
    } catch (error) {
        console.error('❌ Error checking Telegram user:', error);
        return null;
    }
}

/**
 * Register new user with Telegram
 * @param {number} telegramId - Telegram user ID
 * @param {Object} telegramUser - Telegram user data
 * @param {Object} profileData - User profile data
 * @returns {Promise<Object>} {user, profile, credentials: {email, password}}
 */
export async function registerUserWithTelegram(telegramId, telegramUser, profileData, email) {
    const supabase = getSupabase();

    try {
        console.log(`📱 Registering Telegram user ${telegramId} with email ${email}...`);

        // Create auth user with Telegram data
        // We use a temporary password since authentication is via Telegram
        const tempPassword = Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);

        // Use provided email or fallback to dummy
        const userEmail = email || `telegram_${telegramId}@spark.local`;

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userEmail,
            password: tempPassword,
            options: {
                data: {
                    telegram_id: telegramId,
                    name: profileData.name,
                    telegram_user: JSON.stringify(telegramUser)
                }
            }
        });

        if (authError) throw authError;

        const userId = authData.user.id;
        console.log(`✅ Auth user created: ${userId}`);

        // Wait for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update profile with telegram ID and profile data
        const { data: profileRes, error: profileError } = await supabase
            .from('profiles')
            .update({
                name: profileData.name,
                dob: profileData.dob,
                city: profileData.city,
                bio: profileData.bio,
                height: profileData.height,
                weight: profileData.weight,
                body_type: profileData.bodyType,
                orientation: profileData.orientation,
                role: profileData.role,
                tribes: profileData.tribes,
                photos: profileData.photos,
                socials: profileData.socials,
                telegram_id: telegramId,
                verification_status: 'not_verified'
            })
            .eq('id', userId)
            .select()
            .single();

        if (profileError) throw profileError;

        console.log('✅ Telegram user profile saved successfully');

        // Sign in user immediately
        try {
            await supabase.auth.signInWithPassword({
                email: userEmail,
                password: tempPassword
            });
            console.log('✅ User signed in automatically');
        } catch (signInError) {
            console.warn('⚠️ Auto sign-in failed:', signInError.message);
        }

        // Return credentials for CloudStorage sync
        return {
            user: authData.user,
            profile: profileRes,
            credentials: {
                email: userEmail,
                password: tempPassword
            }
        };
    } catch (error) {
        console.error('❌ Error registering Telegram user:', error);
        throw error;
    }
}

/**
 * Upload photo to Supabase Storage
 * @param {string} userId - User ID
 * @param {File} file - Photo file
 * @param {number} photoIndex - Photo index (1-5)
 * @returns {Promise<string>} Public URL of uploaded photo
 */
export async function uploadPhoto(userId, file, photoIndex) {
    const supabase = getSupabase();

    try {
        console.log(`📸 Uploading photo ${photoIndex} for user ${userId}...`);

        // Generate unique filename
        const fileName = `${userId}/photo_${photoIndex}_${Date.now()}.jpg`;

        // Upload to storage
        const { data, error } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(fileName);

        console.log(`✅ Photo uploaded successfully: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('❌ Error uploading photo:', error);
        throw error;
    }
}

/**
 * Delete photo from Supabase Storage
 * @param {string} photoUrl - Full URL of the photo to delete
 * @returns {Promise<void>}
 */
export async function deletePhoto(photoUrl) {
    const supabase = getSupabase();

    try {
        console.log(`🗑️ Deleting photo: ${photoUrl}`);

        // Extract file path from URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/profile-photos/path
        const urlParts = photoUrl.split('/profile-photos/');
        if (urlParts.length !== 2) {
            throw new Error('Invalid photo URL format');
        }

        const filePath = urlParts[1];

        // Delete from storage
        const { error } = await supabase.storage
            .from('profile-photos')
            .remove([filePath]);

        if (error) throw error;

        console.log('✅ Photo deleted successfully');
    } catch (error) {
        console.error('❌ Error deleting photo:', error);
        throw error;
    }
}

/**
 * Delete multiple photos
 * @param {Array<string>} photoUrls - Array of photo URLs to delete
 * @returns {Promise<void>}
 */
export async function deletePhotos(photoUrls) {
    const supabase = getSupabase();

    try {
        console.log(`🗑️ Deleting ${photoUrls.length} photos...`);

        const filePaths = photoUrls
            .map(url => {
                const urlParts = url.split('/profile-photos/');
                return urlParts.length === 2 ? urlParts[1] : null;
            })
            .filter(path => path !== null);

        if (filePaths.length === 0) {
            throw new Error('No valid photo paths found');
        }

        const { error } = await supabase.storage
            .from('profile-photos')
            .remove(filePaths);

        if (error) throw error;

        console.log(`✅ ${filePaths.length} photos deleted successfully`);
    } catch (error) {
        console.error('❌ Error deleting photos:', error);
        throw error;
    }
}

/**
 * ADMIN PANEL FUNCTIONS
 */

/**
 * Check if current user is an admin
 * @returns {Promise<boolean>} True if user is admin, false otherwise
 */
export async function checkIsAdmin() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return false;

        const { data, error } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('❌ Error checking admin status:', error);
            return false;
        }

        return data?.is_admin === true;
    } catch (error) {
        console.error('❌ Error checking admin status:', error);
        return false;
    }
}

/**
 * Get all users with pagination and optional search
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Number of users per page
 * @param {string} searchQuery - Optional search query for name, email, or city
 * @returns {Promise<Object>} { users: Array, totalCount: number, totalPages: number }
 */
export async function getAllUsersWithPagination(page = 1, limit = 20, searchQuery = '') {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const offset = (page - 1) * limit;
        let query = supabase
            .from('profiles')
            .select('*', { count: 'exact' });

        // Apply search filter if provided
        if (searchQuery && searchQuery.trim()) {
            const search = `%${searchQuery.trim()}%`;
            query = query.or(`name.ilike.${search},email.ilike.${search},city.ilike.${search}`);
        }

        // Apply pagination and ordering
        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        const totalPages = Math.ceil((count || 0) / limit);

        console.log(`✅ Fetched ${data?.length || 0} users (page ${page}/${totalPages})`);
        return {
            users: data || [],
            totalCount: count || 0,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        throw error;
    }
}

/**
 * Get all transactions (VIP + Currency payments) with pagination
 * Admin only
 */
export async function getAllTransactions(page = 1, limit = 20, filterType = 'all') {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const offset = (page - 1) * limit;

        // Fetch VIP payments with profiles
        let vipQuery = supabase
            .from('vip_payments')
            .select(`
                *,
                profiles!vip_payments_user_id_fkey(name, email)
            `, { count: 'exact' });

        // Fetch currency payments (without profile join since it references auth.users)
        let currencyQuery = supabase
            .from('currency_payments')
            .select('*', { count: 'exact' });

        // Execute queries
        const [vipResult, currencyResult] = await Promise.all([
            vipQuery.order('created_at', { ascending: false }),
            currencyQuery.order('created_at', { ascending: false })
        ]);

        if (vipResult.error) throw vipResult.error;
        if (currencyResult.error) throw currencyResult.error;

        // Get unique user IDs from currency payments
        const currencyUserIds = [...new Set((currencyResult.data || []).map(p => p.user_id))];

        // Fetch profiles for currency payment users
        let currencyProfiles = {};
        if (currencyUserIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, name, email')
                .in('id', currencyUserIds);

            if (!profilesError && profilesData) {
                profilesData.forEach(profile => {
                    currencyProfiles[profile.id] = profile;
                });
            }
        }

        // Combine and format transactions
        const vipTransactions = (vipResult.data || []).map(payment => ({
            ...payment,
            transaction_type: 'vip',
            user_name: payment.profiles?.name || 'Unknown',
            user_email: payment.profiles?.email || 'N/A'
        }));

        const currencyTransactions = (currencyResult.data || []).map(payment => {
            const profile = currencyProfiles[payment.user_id];
            return {
                ...payment,
                transaction_type: 'currency',
                user_name: profile?.name || 'Unknown',
                user_email: profile?.email || 'N/A'
            };
        });

        // Combine all transactions
        let allTransactions = [...vipTransactions, ...currencyTransactions];

        // Filter by type if needed
        if (filterType !== 'all') {
            allTransactions = allTransactions.filter(t => t.transaction_type === filterType);
        }

        // Sort by date (newest first)
        allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Calculate total
        const totalCount = allTransactions.length;
        const totalPages = Math.ceil(totalCount / limit);

        // Apply pagination
        const paginatedTransactions = allTransactions.slice(offset, offset + limit);

        console.log(`✅ Fetched ${paginatedTransactions.length} transactions (page ${page}/${totalPages})`);

        return {
            transactions: paginatedTransactions,
            totalCount,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        throw error;
    }
}

/**
 * Get full details for a specific user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile data
 */
export async function getUserById(userId) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        console.log(`✅ Fetched user details for: ${data.name}`);
        return data;
    } catch (error) {
        console.error('❌ Error fetching user details:', error);
        throw error;
    }
}

/**
 * Ban a user (admin only)
 * @param {string} userId - User ID to ban
 * @returns {Promise<Object>} Updated profile data
 */
export async function banUser(userId) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('profiles')
            .update({
                is_banned: true,
                banned_at: new Date().toISOString(),
                banned_by: user.id
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ User banned: ${data.name}`);
        return data;
    } catch (error) {
        console.error('❌ Error banning user:', error);
        throw error;
    }
}

/**
 * Unban a user (admin only)
 * @param {string} userId - User ID to unban
 * @returns {Promise<Object>} Updated profile data
 */
export async function unbanUser(userId) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                is_banned: false,
                banned_at: null,
                banned_by: null
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ User unbanned: ${data.name}`);
        return data;
    } catch (error) {
        console.error('❌ Error unbanning user:', error);
        throw error;
    }
}

/**
 * Send verification code to email via Supabase Edge Function
 * SECURE: Code is stored in database, NOT returned to client
 * @param {string} email - User email
 * @returns {Promise<Object>} {success: true}
 */
export async function sendVerificationCode(email) {
    const supabase = getSupabase();
    console.log(`📧 Sending verification code to ${email}`);
    const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email }
    });
    if (error) {
        console.error('❌ Error sending code:', error);
        throw error;
    }
    console.log('✅ Code sent successfully (stored securely in database)');
    return { success: true };
}

            // If last attempt, throw error
            if (attempt === maxRetries) {
                console.error(`❌ All ${maxRetries} attempts failed`);
                throw lastError;
            }

            // Wait before retrying (exponential backoff: 500ms, 1s, etc.)
            const delayMs = 500 * attempt;
            console.log(`⏳ Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

/**
 * Store verification code temporarily (in memory)
 * @param {string} email - User email
 * @param {string} code - Verification code
 * @param {number} expiresInMinutes - Expiration time in minutes (default 10)
 */
export function storeVerificationCode(email, code, expiresInMinutes = 10) {
    if (!window.__verificationCodes) {
        window.__verificationCodes = {};
    }

    window.__verificationCodes[email] = {
        code,
        expiresAt: Date.now() + (expiresInMinutes * 60 * 1000)
    };

    console.log(`🔐 Verification code stored for ${email}`);
}

/**
 * Verify code via Supabase Edge Function
 * SECURE: Verification happens on server, code never exposed to client
 * @param {string} email - User email
 * @param {string} code - Verification code entered by user
 * @returns {Promise<boolean>} True if code is valid
 */
export async function verifyCode(email, code) {
    const supabase = getSupabase();
    console.log(`🔐 Verifying code for ${email}`);
    const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email, code }
    });
    if (error) {
        console.error('❌ Verification error:', error);
        return false;
    }
    if (!data?.success) {
        console.log('❌ Invalid or expired code');
        return false;
    }
    console.log('✅ Code verified successfully');
    return true;
}

    // Check if code matches (case-insensitive, numeric)
    const normalizedProvided = providedCode.toString().toUpperCase().trim();
    const normalizedStored = stored.code.toString().toUpperCase().trim();

    console.log(`🔐 Code verification: provided="${normalizedProvided}", stored="${normalizedStored}"`);

    if (normalizedStored === normalizedProvided) {
        console.log('✅ Verification code is valid for', email);
        delete window.__verificationCodes[email];
        return true;
    }

    console.warn('⚠️ Verification code mismatch for', email);
    return false;
}

/**
 * Clear verification code
 * @param {string} email - User email
 */
export function clearVerificationCode(email) {
    if (window.__verificationCodes && window.__verificationCodes[email]) {
        delete window.__verificationCodes[email];
        console.log(`🗑️ Verification code cleared for ${email}`);
    }
}

/**
 * VIP PRIVACY FUNCTIONS
 */

/**
 * Check if user has active VIP subscription
 * @param {string} userId - User ID (optional, uses current user if not provided)
 * @returns {Promise<boolean>} True if user has active VIP
 */
export async function hasActiveVIP(userId = null) {
    const supabase = getSupabase();

    try {
        let targetUserId = userId;

        if (!targetUserId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;
            targetUserId = user.id;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('has_vip, subscription_expires_at')
            .eq('id', targetUserId)
            .single();

        if (error) throw error;

        // Check if VIP is active
        if (!data?.has_vip) return false;

        // If no expiration date, it's lifetime VIP
        if (!data.subscription_expires_at) return true;

        // Check if subscription hasn't expired
        const expiresAt = new Date(data.subscription_expires_at);
        return expiresAt > new Date();
    } catch (error) {
        console.error('❌ Error checking VIP status:', error);
        return false;
    }
}

/**
 * Update VIP privacy settings
 * @param {Object} settings - Privacy settings {privacy_messages, hide_online_status, invisible_mode}
 * @returns {Promise<Object>} Updated profile
 */
export async function updateVIPPrivacySettings(settings) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Check if user has active VIP
        const hasVIP = await hasActiveVIP(user.id);
        if (!hasVIP) {
            throw new Error('VIP subscription required for privacy settings');
        }

        console.log('🔒 Updating VIP privacy settings for user', user.id, settings);

        const updateData = {};
        if (settings.privacy_messages !== undefined) {
            updateData.privacy_messages = settings.privacy_messages;
        }
        if (settings.hide_online_status !== undefined) {
            updateData.hide_online_status = settings.hide_online_status;
        }
        if (settings.invisible_mode !== undefined) {
            updateData.invisible_mode = settings.invisible_mode;
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ VIP privacy settings updated');
        return data;
    } catch (error) {
        console.error('❌ Error updating VIP privacy settings:', error);
        throw error;
    }
}

/**
 * Get user's VIP privacy settings
 * @param {string} userId - User ID (optional, uses current user if not provided)
 * @returns {Promise<Object>} Privacy settings
 */
export async function getVIPPrivacySettings(userId = null) {
    const supabase = getSupabase();

    try {
        let targetUserId = userId;

        if (!targetUserId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            targetUserId = user.id;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('has_vip, subscription_expires_at, privacy_messages, hide_online_status, invisible_mode')
            .eq('id', targetUserId)
            .single();

        if (error) throw error;

        return {
            hasVIP: await hasActiveVIP(targetUserId),
            privacy_messages: data.privacy_messages || 'all',
            hide_online_status: data.hide_online_status || false,
            invisible_mode: data.invisible_mode || false
        };
    } catch (error) {
        console.error('❌ Error getting VIP privacy settings:', error);
        return null;
    }
}

/**
 * Check if sender can message recipient
 * @param {string} senderId - Sender user ID
 * @param {string} recipientId - Recipient user ID
 * @returns {Promise<Object>} {canMessage: boolean, reason: string}
 */
export async function canSendMessage(senderId, recipientId) {
    const supabase = getSupabase();

    try {
        // Get recipient's privacy settings
        const { data: recipient, error } = await supabase
            .from('profiles')
            .select('has_vip, subscription_expires_at, privacy_messages')
            .eq('id', recipientId)
            .single();

        if (error) throw error;

        // Check if recipient has active VIP
        const hasVIP = await hasActiveVIP(recipientId);

        // If no VIP or privacy set to 'all', anyone can message
        if (!hasVIP || recipient.privacy_messages === 'all') {
            return { canMessage: true, reason: 'allowed' };
        }

        // If privacy set to 'none', nobody can message
        if (recipient.privacy_messages === 'none') {
            return { canMessage: false, reason: 'Пользователь отключил личные сообщения' };
        }

        // If privacy set to 'matched_only', check for mutual match
        if (recipient.privacy_messages === 'matched_only') {
            // Check if there's a mutual match
            const { data: matches, error: matchError } = await supabase
                .from('matches')
                .select('id')
                .or(`and(user1_id.eq.${senderId},user2_id.eq.${recipientId}),and(user1_id.eq.${recipientId},user2_id.eq.${senderId})`)
                .limit(1);

            if (matchError) throw matchError;

            if (matches && matches.length > 0) {
                return { canMessage: true, reason: 'mutual_match' };
            } else {
                return { canMessage: false, reason: 'Пользователь принимает сообщения только от взаимных лайков' };
            }
        }

        return { canMessage: true, reason: 'allowed' };
    } catch (error) {
        console.error('❌ Error checking message permissions:', error);
        return { canMessage: true, reason: 'error_fallback' };
    }
}

/**
 * Record a profile view (respects invisible_mode)
 * @param {string} viewedProfileId - ID of the profile being viewed
 * @returns {Promise<boolean>} True if view was recorded
 */
export async function recordProfileView(viewedProfileId) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Don't record if viewing own profile
        if (user.id === viewedProfileId) return false;

        // Check if viewer has invisible_mode enabled
        const viewerSettings = await getVIPPrivacySettings(user.id);
        if (viewerSettings && viewerSettings.invisible_mode && viewerSettings.hasVIP) {
            console.log('👻 Invisible mode active - not recording view');
            return false;
        }

        // Record the view (will update if already exists due to UNIQUE constraint)
        const { error } = await supabase
            .from('profile_views')
            .upsert({
                viewer_id: user.id,
                viewed_profile_id: viewedProfileId,
                viewed_at: new Date().toISOString()
            }, {
                onConflict: 'viewer_id,viewed_profile_id'
            });

        if (error) {
            console.error('❌ Error recording profile view:', error);
            return false;
        }

        console.log('👁️ Profile view recorded');
        return true;
    } catch (error) {
        console.error('❌ Error recording profile view:', error);
        return false;
    }
}

/**
 * Get who viewed my profile
 * @returns {Promise<Array>} Array of profile views with user info
 */
export async function getProfileViewers() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('profile_views')
            .select(`
                id,
                viewed_at,
                viewer:profiles!viewer_id(id, name, photos, verification_status)
            `)
            .eq('viewed_profile_id', user.id)
            .order('viewed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} profile viewers`);
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching profile viewers:', error);
        return [];
    }
}

/**
 * Get profiles I viewed
 * @returns {Promise<Array>} Array of viewed profiles
 */
export async function getViewedProfiles() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('profile_views')
            .select(`
                id,
                viewed_at,
                viewed_profile:profiles!viewed_profile_id(id, name, photos, verification_status)
            `)
            .eq('viewer_id', user.id)
            .order('viewed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} viewed profiles`);
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching viewed profiles:', error);
        return [];
    }
}

/**
 * Get user's online status (respects hide_online_status setting)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} {isOnline: boolean, lastSeen: timestamp, hidden: boolean}
 */
export async function getUserOnlineStatus(userId) {
    const supabase = getSupabase();

    try {
        // Check if user has hide_online_status enabled
        const settings = await getVIPPrivacySettings(userId);
        if (settings && settings.hide_online_status && settings.hasVIP) {
            return { isOnline: false, lastSeen: null, hidden: true };
        }

        // For now, we don't have a real-time online tracking
        // This would require adding last_seen_at field to profiles table
        // and updating it via heartbeat or Supabase presence
        return { isOnline: false, lastSeen: null, hidden: false };
    } catch (error) {
        console.error('❌ Error getting online status:', error);
        return { isOnline: false, lastSeen: null, hidden: false };
    }
}

/**
 * PROMOCODE SYSTEM FUNCTIONS
 */

/**
 * Create a new promocode (admin only)
 * @param {Object} promocodeData - {code, reward_type, reward_amount, max_uses, expires_at}
 * @returns {Promise<Object>} Created promocode
 */
export async function createPromocode(promocodeData) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('promocodes')
            .insert({
                code: promocodeData.code.toUpperCase(),
                reward_type: promocodeData.reward_type,
                reward_amount: promocodeData.reward_amount,
                max_uses: promocodeData.max_uses || null,
                expires_at: promocodeData.expires_at || null,
                created_by: user.id,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Promocode created:', data);
        return data;
    } catch (error) {
        console.error('❌ Error creating promocode:', error);
        throw error;
    }
}

/**
 * Get all promocodes (admin only)
 * @returns {Promise<Array>} Array of promocodes
 */
export async function getAllPromocodes() {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data, error } = await supabase
            .from('promocodes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} promocodes`);
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching promocodes:', error);
        throw error;
    }
}

/**
 * Deactivate a promocode (admin only)
 * @param {string} promocodeId - Promocode ID
 * @returns {Promise<Object>} Updated promocode
 */
export async function deactivatePromocode(promocodeId) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data, error } = await supabase
            .from('promocodes')
            .update({ is_active: false })
            .eq('id', promocodeId)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Promocode deactivated');
        return data;
    } catch (error) {
        console.error('❌ Error deactivating promocode:', error);
        throw error;
    }
}

/**
 * Redeem a promocode
 * @param {string} code - Promocode string
 * @returns {Promise<Object>} {success: boolean, message: string, reward: Object}
 */
export async function redeemPromocode(code) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get promocode
        const { data: promocode, error: promoError } = await supabase
            .from('promocodes')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (promoError || !promocode) {
            return { success: false, message: 'Промокод не найден' };
        }

        // Check if active
        if (!promocode.is_active) {
            return { success: false, message: 'Промокод неактивен' };
        }

        // Check if expired
        if (promocode.expires_at && new Date(promocode.expires_at) < new Date()) {
            return { success: false, message: 'Промокод истёк' };
        }

        // Check if max uses reached
        if (promocode.max_uses && promocode.current_uses >= promocode.max_uses) {
            return { success: false, message: 'Промокод уже использован максимальное количество раз' };
        }

        // Check if user already redeemed this code
        const { data: existingRedemption } = await supabase
            .from('promocode_redemptions')
            .select('id')
            .eq('promocode_id', promocode.id)
            .eq('user_id', user.id)
            .single();

        if (existingRedemption) {
            return { success: false, message: 'Вы уже использовали этот промокод' };
        }

        // Apply reward
        let rewardMessage = '';
        const updateData = {};

        if (promocode.reward_type === 'stars') {
            // Get current stars
            const { data: profile } = await supabase
                .from('profiles')
                .select('stars')
                .eq('id', user.id)
                .single();

            updateData.stars = (profile?.stars || 0) + promocode.reward_amount;
            rewardMessage = `+${promocode.reward_amount} ⭐ Звезд`;
        } else if (promocode.reward_type === 'boosts') {
            // Get current boosts
            const { data: profile } = await supabase
                .from('profiles')
                .select('boosts')
                .eq('id', user.id)
                .single();

            updateData.boosts = (profile?.boosts || 0) + promocode.reward_amount;
            rewardMessage = `+${promocode.reward_amount} 🚀 Бустов`;
        } else if (promocode.reward_type === 'vip') {
            // Get current VIP status
            const { data: profile } = await supabase
                .from('profiles')
                .select('has_vip, subscription_expires_at')
                .eq('id', user.id)
                .single();

            const now = new Date();
            let newExpiresAt;

            if (profile?.has_vip && profile.subscription_expires_at) {
                // Extend existing VIP
                const currentExpires = new Date(profile.subscription_expires_at);
                if (currentExpires > now) {
                    newExpiresAt = new Date(currentExpires.getTime() + promocode.reward_amount * 24 * 60 * 60 * 1000);
                } else {
                    newExpiresAt = new Date(now.getTime() + promocode.reward_amount * 24 * 60 * 60 * 1000);
                }
            } else {
                // New VIP subscription
                newExpiresAt = new Date(now.getTime() + promocode.reward_amount * 24 * 60 * 60 * 1000);
            }

            updateData.has_vip = true;
            updateData.subscription_expires_at = newExpiresAt.toISOString();
            rewardMessage = `+${promocode.reward_amount} дней 👑 VIP`;
        }

        // Update user profile with reward
        const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Record redemption
        const { error: redemptionError } = await supabase
            .from('promocode_redemptions')
            .insert({
                promocode_id: promocode.id,
                user_id: user.id,
                reward_type: promocode.reward_type,
                reward_amount: promocode.reward_amount
            });

        if (redemptionError) throw redemptionError;

        // Increment uses count
        const { error: incrementError } = await supabase
            .from('promocodes')
            .update({ current_uses: promocode.current_uses + 1 })
            .eq('id', promocode.id);

        if (incrementError) throw incrementError;

        console.log('✅ Promocode redeemed successfully');
        return {
            success: true,
            message: `Промокод активирован! ${rewardMessage}`,
            reward: {
                type: promocode.reward_type,
                amount: promocode.reward_amount
            }
        };
    } catch (error) {
        console.error('❌ Error redeeming promocode:', error);
        return { success: false, message: 'Ошибка активации промокода' };
    }
}

/**
 * Get user's currency balances
 * @returns {Promise<Object>} {stars: number, boosts: number}
 */
export async function getUserCurrency() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { stars: 0, boosts: 0 };

        const { data, error } = await supabase
            .from('profiles')
            .select('stars, boosts')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        return {
            stars: data?.stars || 0,
            boosts: data?.boosts || 0
        };
    } catch (error) {
        console.error('❌ Error getting user currency:', error);
        return { stars: 0, boosts: 0 };
    }
}

/**
 * Deduct stars from user balance
 * @param {number} amount - Amount of stars to deduct
 * @returns {Promise<{success: boolean, newBalance: number, message: string}>}
 */
export async function deductUserStars(amount = 1) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get current balance
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('stars')
            .eq('id', user.id)
            .single();

        if (fetchError) throw fetchError;

        if ((profile.stars || 0) < amount) {
            return { success: false, message: 'Недостаточно звёзд' };
        }

        // Update balance
        const newBalance = (profile.stars || 0) - amount;
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ stars: newBalance })
            .eq('id', user.id);

        if (updateError) throw updateError;

        return { success: true, newBalance };
    } catch (error) {
        console.error('❌ Error deducting stars:', error);
        return { success: false, message: 'Ошибка списания звёзд' };
    }
}

/**
 * Get user's redemption history
 * @returns {Promise<Array>} Array of redemptions
 */
export async function getUserRedemptions() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('promocode_redemptions')
            .select(`
                id,
                redeemed_at,
                reward_type,
                reward_amount,
                promocode:promocodes(code)
            `)
            .eq('user_id', user.id)
            .order('redeemed_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} redemptions`);
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching redemptions:', error);
        return [];
    }
}

/**
 * VERIFICATION SYSTEM FUNCTIONS
 */

/**
 * Generate random verification challenge (gesture + expression)
 * @returns {Object} {fingers: 1-5, expression: string, emoji: string}
 */
export function generateVerificationChallenge() {
    const fingers = Math.floor(Math.random() * 5) + 1; // 1-5

    const expressions = [
        { name: 'smile', text: 'Улыбка', emoji: '😊' },
        { name: 'wink', text: 'Подмигивание', emoji: '😉' },
        { name: 'sad', text: 'Грусть', emoji: '😢' },
        { name: 'angry', text: 'Злость', emoji: '😠' },
        { name: 'tongue', text: 'Язык', emoji: '😛' }
    ];

    const expression = expressions[Math.floor(Math.random() * expressions.length)];

    const fingerEmojis = ['☝️', '✌️', '🤟', '🖖', '✋'];

    return {
        fingers,
        fingerEmoji: fingerEmojis[fingers - 1],
        expression: expression.name,
        expressionText: expression.text,
        expressionEmoji: expression.emoji
    };
}

/**
 * Upload verification photo
 * @param {string} userId - User ID
 * @param {File} file - Photo file
 * @returns {Promise<string>} Public URL of uploaded photo
 */
export async function uploadVerificationPhoto(userId, file) {
    const supabase = getSupabase();

    try {
        console.log(`📸 Uploading verification photo for user ${userId}...`);

        // Generate unique filename
        const fileName = `${userId}/verification_${Date.now()}.jpg`;

        // Upload to storage
        const { data, error } = await supabase.storage
            .from('verification-photos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('verification-photos')
            .getPublicUrl(fileName);

        console.log(`✅ Verification photo uploaded successfully: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('❌ Error uploading verification photo:', error);
        throw error;
    }
}

/**
 * Submit verification request
 * @param {string} userId - User ID
 * @param {string} photoUrl - Verification photo URL
 * @param {Object} gestureData - Required gesture data
 * @returns {Promise<Object>} Updated profile
 */
export async function submitVerificationRequest(userId, photoUrl, gestureData) {
    const supabase = getSupabase();

    try {
        console.log(`📝 Submitting verification request for user ${userId}...`);

        const { data, error } = await supabase
            .from('profiles')
            .update({
                verification_status: 'pending',
                verification_photo: photoUrl,
                verification_gesture: gestureData,
                verification_submitted_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ Verification request submitted for user ${userId}`);
        return data;
    } catch (error) {
        console.error('❌ Error submitting verification request:', error);
        throw error;
    }
}

/**
 * Get verification status for current user
 * @returns {Promise<Object|null>} Verification status info
 */
export async function getVerificationStatus() {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('verification_status, verification_gesture, verification_submitted_at')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('❌ Error getting verification status:', error);
        return null;
    }
}

/**
 * Check if user is verified
 * @param {string} userId - User ID (optional, uses current user if not provided)
 * @returns {Promise<boolean>} True if user is verified
 */
export async function isUserVerified(userId = null) {
    const supabase = getSupabase();

    try {
        let targetUserId = userId;

        if (!targetUserId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;
            targetUserId = user.id;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('verification_status')
            .eq('id', targetUserId)
            .single();

        if (error) throw error;

        return data?.verification_status === 'verified';
    } catch (error) {
        console.error('❌ Error checking verification status:', error);
        return false;
    }
}

/**
 * Get all pending verification requests (admin only)
 * @returns {Promise<Array>} Array of users pending verification
 */
export async function getPendingVerifications() {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('verification_status', 'pending')
            .order('verification_submitted_at', { ascending: true });

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} pending verification requests`);
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching pending verifications:', error);
        throw error;
    }
}

/**
 * Approve user verification (admin only)
 * @param {string} userId - User ID to approve
 * @returns {Promise<Object>} Updated profile
 */
export async function approveVerification(userId) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('profiles')
            .update({
                verification_status: 'verified',
                verification_reviewed_at: new Date().toISOString(),
                verification_reviewed_by: user.id
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ Verification approved for user: ${userId}`);
        return data;
    } catch (error) {
        console.error('❌ Error approving verification:', error);
        throw error;
    }
}

/**
 * Reject user verification (admin only)
 * @param {string} userId - User ID to reject
 * @returns {Promise<Object>} Updated profile
 */
export async function rejectVerification(userId) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('profiles')
            .update({
                verification_status: 'rejected',
                verification_reviewed_at: new Date().toISOString(),
                verification_reviewed_by: user.id
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ Verification rejected for user: ${userId}`);
        return data;
    } catch (error) {
        console.error('❌ Error rejecting verification:', error);
        throw error;
    }
}

// ========================================
// VIP PAYMENT FUNCTIONS (NOWPayments Integration via Edge Functions)
// ========================================
// NOTE: All sensitive operations are handled by Supabase Edge Functions
// to keep API keys secure and prevent client-side manipulation


// VIP package configurations
const VIP_PACKAGES = {
    '7days': {
        name: '7 дней',
        days: 7,
        stars: 10,
        price: 10,
        description: '1 неделя VIP + 10 звезд'
    },
    '1month': {
        name: '1 месяц',
        days: 30,
        stars: 30,
        price: 30,
        description: '1 месяц VIP + 30 звезд'
    },
    '3months': {
        name: '3 месяца',
        days: 90,
        stars: 60,
        price: 60,
        description: '3 месяца VIP + 60 звезд'
    },
    '12months': {
        name: '12 месяцев',
        days: 365,
        stars: 200,
        price: 200,
        description: '1 год VIP + 200 звезд'
    },
    'lifetime': {
        name: 'Пожизненная',
        days: null, // null означает пожизненную подписку
        stars: 1000,
        price: 1000,
        description: 'Пожизненная VIP + 1000 звезд'
    }
};

/**
 * Create VIP payment invoice via Supabase Edge Function
 * This function calls the backend Edge Function to securely create payments
 * without exposing API keys to the client
 * @param {string} packageType - Type of VIP package (7days, 1month, etc.)
 * @returns {Object} Payment details with invoice URL
 */
export async function createVIPPayment(packageType) {
    try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Пользователь не авторизован');

        const package_info = VIP_PACKAGES[packageType];
        if (!package_info) throw new Error('Неверный тип пакета');

        console.log('📞 Calling Edge Function to create payment...');

        // Call Supabase Edge Function to create payment securely
        const { data, error } = await supabase.functions.invoke('create-vip-payment', {
            body: { packageType }
        });

        if (error) {
            console.error('❌ Edge Function error:', error);
            throw error;
        }

        if (!data || !data.success) {
            throw new Error(data?.error || 'Failed to create payment');
        }

        console.log('✅ Payment created via Edge Function:', data.orderId);

        return {
            success: true,
            orderId: data.orderId,
            invoiceUrl: data.invoiceUrl,
            invoiceId: data.invoiceId,
            package: data.package
        };

    } catch (error) {
        console.error('❌ Error creating VIP payment:', error);
        throw error;
    }
}

/**
 * Check payment status via Supabase Edge Function
 * @param {string} orderId - Order ID to check
 * @returns {Object} Payment status
 */
export async function checkPaymentStatus(orderId) {
    try {
        const supabase = getSupabase();

        console.log('📞 Calling Edge Function to check payment status...');

        // Call Supabase Edge Function to check status securely
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
            body: { orderId }
        });

        if (error) {
            console.error('❌ Edge Function error:', error);
            throw error;
        }

        if (!data || !data.success) {
            throw new Error(data?.error || 'Failed to check payment status');
        }

        return data.payment;

    } catch (error) {
        console.error('❌ Error checking payment status:', error);
        throw error;
    }
}

/**
 * Activate VIP subscription after successful payment
 * @param {string} orderId - Order ID
 * @param {Object} paymentData - Payment data from NOWPayments callback
 * @returns {Object} Updated profile
 */
export async function activateVIPSubscription(orderId, paymentData = {}) {
    try {
        // Get payment record
        const { data: payment, error: paymentError } = await supabase
            .from('vip_payments')
            .select('*')
            .eq('order_id', orderId)
            .single();

        if (paymentError) throw paymentError;
        if (!payment) throw new Error('Платеж не найден');

        // Check if already activated
        if (payment.activated_at) {
            console.log('⚠️ Payment already activated');
            return { success: false, message: 'Платеж уже активирован' };
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payment.user_id)
            .single();

        if (profileError) throw profileError;

        // Calculate new VIP expiration
        let newExpirationDate;
        if (payment.vip_days === 999999 || payment.package_type === 'lifetime') {
            // Lifetime subscription - set to null
            newExpirationDate = null;
        } else {
            // Add days to current subscription or start from now
            const currentExpiration = profile.subscription_expires_at
                ? new Date(profile.subscription_expires_at)
                : new Date();

            // If current subscription is expired, start from now
            const startDate = currentExpiration > new Date() ? currentExpiration : new Date();

            newExpirationDate = new Date(startDate);
            newExpirationDate.setDate(newExpirationDate.getDate() + payment.vip_days);
        }

        // Update profile with VIP status and bonus stars
        const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
                is_vip: true,
                subscription_expires_at: newExpirationDate ? newExpirationDate.toISOString() : null,
                stars: (profile.stars || 0) + payment.bonus_stars
            })
            .eq('id', payment.user_id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Mark payment as activated
        const { error: activateError } = await supabase
            .from('vip_payments')
            .update({
                payment_status: 'finished',
                payment_id: paymentData.payment_id,
                pay_amount: paymentData.pay_amount,
                pay_currency: paymentData.pay_currency,
                actually_paid: paymentData.actually_paid,
                paid_at: new Date().toISOString(),
                activated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

        if (activateError) console.error('Error updating payment status:', activateError);

        console.log(`✅ VIP subscription activated for user ${payment.user_id}`);

        return {
            success: true,
            message: `VIP активирован! +${payment.bonus_stars} звезд`,
            profile: updatedProfile
        };

    } catch (error) {
        console.error('❌ Error activating VIP subscription:', error);
        throw error;
    }
}

/**
 * Get user's payment history
 * @returns {Array} List of payments
 */
export async function getUserPayments() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Пользователь не авторизован');

        const { data, error } = await supabase
            .from('vip_payments')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];

    } catch (error) {
        console.error('❌ Error getting user payments:', error);
        throw error;
    }
}

/**
 * Get payment by order ID
 * @param {string} orderId - Order ID
 * @returns {Object} Payment details
 */
export async function getPaymentByOrderId(orderId) {
    try {
        const { data, error } = await supabase
            .from('vip_payments')
            .select('*')
            .eq('order_id', orderId)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('❌ Error getting payment:', error);
        throw error;
    }
}

/**
 * Get VIP packages configuration
 * @returns {Object} VIP packages
 */
export function getVIPPackages() {
    return VIP_PACKAGES;
}

// ========================================
// BOOST FUNCTIONALITY
// ========================================

/**
 * Boost a user (adds 10 minutes to their global top time)
 * Deducts 1 boost from current user's balance
 * @param {string} targetUserId - ID of user to boost
 * @returns {Promise<{success: boolean, message: string, boostExpiresAt: string|null, minutesAdded: number}>}
 */
export async function boostUser(targetUserId) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        if (user.id === targetUserId) {
            return { success: false, message: 'Нельзя забустить самого себя' };
        }

        // Get current user's boost balance
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('boosts')
            .eq('id', user.id)
            .single();

        if (fetchError) throw fetchError;

        if ((profile.boosts || 0) < 1) {
            return { success: false, message: 'Недостаточно бустов' };
        }

        // Get target user's current boost status
        const { data: targetProfile, error: targetError } = await supabase
            .from('profiles')
            .select('boost_expires_at')
            .eq('id', targetUserId)
            .single();

        if (targetError) throw targetError;

        // Calculate new boost expiration time
        const now = new Date();
        const currentExpires = targetProfile.boost_expires_at ? new Date(targetProfile.boost_expires_at) : null;

        let newExpiresAt;
        if (currentExpires && currentExpires > now) {
            // Boost is still active, add 10 minutes to existing time
            newExpiresAt = new Date(currentExpires.getTime() + 10 * 60 * 1000);
        } else {
            // No active boost or expired, set to now + 10 minutes
            newExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
        }

        // Update target user's boost_expires_at
        const { error: updateTargetError } = await supabase
            .from('profiles')
            .update({ boost_expires_at: newExpiresAt.toISOString() })
            .eq('id', targetUserId);

        if (updateTargetError) throw updateTargetError;

        // Deduct 1 boost from current user
        const newBalance = (profile.boosts || 0) - 1;
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ boosts: newBalance })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Record boost in history
        const { error: historyError } = await supabase
            .from('boost_history')
            .insert({
                booster_id: user.id,
                boosted_id: targetUserId,
                created_at: now.toISOString()
            });

        if (historyError) {
            console.warn('⚠️ Failed to record boost history:', historyError);
            // Don't fail the whole operation if history recording fails
        }

        console.log(`✅ User ${targetUserId} boosted until ${newExpiresAt.toISOString()}`);
        return {
            success: true,
            message: 'Пользователь забуст успешно!',
            boostExpiresAt: newExpiresAt.toISOString(),
            minutesAdded: 10,
            newBalance
        };

    } catch (error) {
        console.error('❌ Error boosting user:', error);
        return { success: false, message: 'Ошибка буста пользователя' };
    }
}

/**
 * Get boost status for a user
 * @param {string} userId - User ID to check
 * @returns {Promise<{isBoosted: boolean, expiresAt: string|null, minutesRemaining: number}>}
 */
export async function getBoostStatus(userId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('boost_expires_at')
            .eq('id', userId)
            .single();

        if (error) throw error;

        if (!data.boost_expires_at) {
            return { isBoosted: false, expiresAt: null, minutesRemaining: 0 };
        }

        const expiresAt = new Date(data.boost_expires_at);
        const now = new Date();

        if (expiresAt <= now) {
            return { isBoosted: false, expiresAt: null, minutesRemaining: 0 };
        }

        const minutesRemaining = Math.ceil((expiresAt - now) / (1000 * 60));

        return {
            isBoosted: true,
            expiresAt: data.boost_expires_at,
            minutesRemaining
        };

    } catch (error) {
        console.error('❌ Error getting boost status:', error);
        return { isBoosted: false, expiresAt: null, minutesRemaining: 0 };
    }
}

/**
 * Get all boost history (admin only)
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} Array of boost transactions with user details
 */
export async function getAllBoostHistory(limit = 100) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const { data, error } = await supabase
            .from('boost_history')
            .select(`
                *,
                booster:profiles!booster_id(id, name, email),
                boosted:profiles!boosted_id(id, name, email)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} boost history records`);
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching boost history:', error);
        throw error;
    }
}

// ========================================
// PINNED POSITION (ADMIN)
// ========================================

/**
 * Set pinned position for a user (admin only)
 * @param {string} userId - User ID to pin
 * @param {number|null} position - Position (1-10) or null to unpin
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function setPinnedPosition(userId, position) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        // Validate position
        if (position !== null && (position < 1 || position > 10)) {
            return { success: false, message: 'Позиция должна быть от 1 до 10' };
        }

        const { error } = await supabase
            .from('profiles')
            .update({ pinned_position: position })
            .eq('id', userId);

        if (error) throw error;

        const message = position
            ? `✅ Пользователь закреплен на позиции ${position}`
            : '✅ Пользователь откреплен';

        console.log(message);
        return { success: true, message };
    } catch (error) {
        console.error('❌ Error setting pinned position:', error);
        return { success: false, message: 'Ошибка установки позиции' };
    }
}

/**
 * Get pinned position for a user
 * @param {string} userId - User ID
 * @returns {Promise<number|null>} Position (1-10) or null if not pinned
 */
export async function getPinnedPosition(userId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('pinned_position')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return data?.pinned_position || null;
    } catch (error) {
        console.error('❌ Error getting pinned position:', error);
        return null;
    }
}

/**
 * Grant VIP subscription to a user (admin only)
 * @param {string} userId - User ID
 * @param {number} days - Number of days (999999 for lifetime)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function grantVIPSubscription(userId, days = 30) {
    const supabase = getSupabase();

    try {
        // Check if user is admin
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        // Calculate new VIP expiration
        let newExpirationDate;
        if (days === 999999) {
            // Lifetime subscription
            newExpirationDate = null;
        } else {
            // Add days to current subscription or start from now
            const currentExpiration = profile.subscription_expires_at
                ? new Date(profile.subscription_expires_at)
                : new Date();

            // If current subscription is expired, start from now
            const startDate = currentExpiration > new Date() ? currentExpiration : new Date();

            newExpirationDate = new Date(startDate);
            newExpirationDate.setDate(newExpirationDate.getDate() + days);
        }

        // Update profile with VIP status
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                has_vip: true,
                subscription_expires_at: newExpirationDate ? newExpirationDate.toISOString() : null
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        const message = days === 999999
            ? '✅ VIP навсегда выдан!'
            : `✅ VIP на ${days} дней выдан!`;

        console.log(message, 'User:', userId);
        return { success: true, message };
    } catch (error) {
        console.error('❌ Error granting VIP subscription:', error);
        return { success: false, message: 'Ошибка выдачи VIP' };
    }
}

