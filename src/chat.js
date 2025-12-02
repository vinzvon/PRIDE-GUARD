/**
 * SPARK DATING APP - CHAT SYSTEM
 * Real-time messaging with Supabase
 */

import { getSupabase, canSendMessage } from './supabase.js';
import { showNotification, containsURL } from './utils.js';

// Chat state
export const chatState = {
    activeMatchId: null,
    messages: [],
    isLoading: false,
    isSending: false,
    realtimeUnsubscribe: null
};

/**
 * Initialize chat for a match
 * @param {string} matchId - Match ID
 * @param {Object} match - Match object with user info
 */
export async function initializeChat(matchId, match) {
    console.log('💬 Initializing chat for match:', matchId);

    const supabase = getSupabase();
    chatState.activeMatchId = matchId;
    chatState.isLoading = true;

    try {
        // Unsubscribe from previous realtime subscription
        if (chatState.realtimeUnsubscribe) {
            chatState.realtimeUnsubscribe();
        }

        // Load messages
        await loadMessages(matchId);

        // Subscribe to real-time updates
        subscribeToMessages(matchId);

        // Mark match messages as read
        await markMessagesAsRead(matchId);

        console.log('✅ Chat initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing chat:', error);
        showNotification('Ошибка загрузки чата', 'error');
    } finally {
        chatState.isLoading = false;
    }
}

/**
 * Load messages for a match
 * @param {string} matchId - Match ID
 */
export async function loadMessages(matchId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('match_id', matchId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        chatState.messages = data || [];
        console.log(`✅ Loaded ${chatState.messages.length} messages`);
    } catch (error) {
        console.error('❌ Error loading messages:', error);
        throw error;
    }
}

/**
 * Subscribe to real-time message updates
 * @param {string} matchId - Match ID
 */
export function subscribeToMessages(matchId) {
    const supabase = getSupabase();

    // Subscribe to new messages
    const subscription = supabase
        .channel(`messages-${matchId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `match_id=eq.${matchId}`
            },
            async (payload) => {
                console.log('📨 New message event:', payload);

                if (payload.eventType === 'INSERT') {
                    // Add new message to state
                    chatState.messages.push(payload.new);
                    // Render new message
                    await renderNewMessage(payload.new);
                    // Scroll to bottom
                    scrollToBottom();
                } else if (payload.eventType === 'UPDATE') {
                    // Update message (e.g., read status)
                    const index = chatState.messages.findIndex(m => m.id === payload.new.id);
                    if (index !== -1) {
                        chatState.messages[index] = payload.new;
                    }
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Realtime subscription status:', status);
        });

    chatState.realtimeUnsubscribe = () => {
        subscription.unsubscribe();
    };
}

/**
 * Send a message
 * @param {string} matchId - Match ID
 * @param {string} text - Message text
 * @param {string} recipientId - Recipient user ID (for permission check)
 */
export async function sendMessage(matchId, text, recipientId = null) {
    if (!text.trim()) {
        showNotification('Сообщение не может быть пустым', 'error');
        return;
    }

    // Check for URLs
    if (containsURL(text)) {
        showNotification('❌ Ссылки в сообщениях запрещены', 'error');
        return;
    }

    if (chatState.isSending) return;
    chatState.isSending = true;

    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Check message permissions if recipientId provided
        if (recipientId) {
            const permission = await canSendMessage(user.id, recipientId);
            if (!permission.canMessage) {
                showNotification(permission.reason, 'error');
                return null;
            }
        }

        const { data, error } = await supabase
            .from('messages')
            .insert([
                {
                    match_id: matchId,
                    sender_id: user.id,
                    content: text.trim(),
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) throw error;

        console.log('✅ Message sent:', data);
        return data[0];
    } catch (error) {
        console.error('❌ Error sending message:', error);
        showNotification('Ошибка отправки сообщения', 'error');
        throw error;
    } finally {
        chatState.isSending = false;
    }
}

/**
 * Mark messages as read
 * @param {string} matchId - Match ID
 */
export async function markMessagesAsRead(matchId) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get current user's ID
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('match_id', matchId)
            .eq('read', false)
            .neq('sender_id', user.id);

        if (error) throw error;

        if (messages && messages.length > 0) {
            const { error: updateError } = await supabase
                .from('messages')
                .update({ read: true })
                .eq('match_id', matchId)
                .eq('read', false)
                .neq('sender_id', user.id);

            if (updateError) throw updateError;
            console.log('✅ Messages marked as read');
        }
    } catch (error) {
        console.error('⚠️ Error marking messages as read:', error);
    }
}

/**
 * Render a single new message
 * @param {Object} message - Message object
 */
export async function renderNewMessage(message) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const messageEl = await createMessageElement(message);
    container.appendChild(messageEl);
}

/**
 * Create message DOM element
 * @param {Object} message - Message object
 * @returns {HTMLElement}
 */
export async function createMessageElement(message) {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    const isOwn = message.sender_id === user?.id;

    const div = document.createElement('div');
    div.className = `flex gap-3 mb-4 ${isOwn ? 'justify-end' : 'justify-start'} message-item`;
    div.id = `message-${message.id}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = `max-w-xs lg:max-w-md px-4 py-3 rounded-2xl word-break ${isOwn
        ? 'bg-red-500 text-white rounded-br-none'
        : 'bg-gray-700 text-white rounded-bl-none'
        }`;

    const time = new Date(message.created_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <p class="text-sm leading-relaxed">${escapeHtml(message.content)}</p>
        <p class="text-xs opacity-70 mt-1">${time}</p>
    `;

    div.appendChild(messageDiv);
    return div;
}

/**
 * Render all messages in chat
 * @param {Array} messages - Messages array
 */
export async function renderAllMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    container.innerHTML = '';

    for (const message of messages) {
        const messageEl = await createMessageElement(message);
        container.appendChild(messageEl);
    }

    scrollToBottom();
}

/**
 * Scroll to bottom of messages
 */
export function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 0);
    }
}

/**
 * Close chat
 */
export function closeChat() {
    console.log('🔌 Closing chat');

    if (chatState.realtimeUnsubscribe) {
        chatState.realtimeUnsubscribe();
    }

    chatState.activeMatchId = null;
    chatState.messages = [];
}

/**
 * Get unread count for a match
 * @param {string} matchId - Match ID
 */
export async function getUnreadCount(matchId) {
    const supabase = getSupabase();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;

        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('match_id', matchId)
            .eq('read', false)
            .neq('sender_id', user.id);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

/**
 * Get all matches with last message
 */
export async function getMatchesWithMessages(userId) {
    const supabase = getSupabase();

    try {
        // Get matches where user is either user1 or user2
        const { data, error } = await supabase
            .from('matches')
            .select(`
                id,
                user1_id,
                user2_id,
                user1:profiles!user1_id(id, name, photos),
                user2:profiles!user2_id(id, name, photos),
                last_message_at
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('❌ Error getting matches:', error);
        console.error('Error details:', error);
        return [];
    }
}

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

console.log('✅ Chat module loaded');
