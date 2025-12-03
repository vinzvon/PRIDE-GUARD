import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            status: 200,
            headers: corsHeaders
        });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Only POST allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    try {
        const { email, code } = await req.json();
        if (!email || !code) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Email and code required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        console.log(`🔐 Verifying code for: ${email}`);
        // Получаем код из базы данных
        const { data, error: dbError } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();
        if (dbError || !data) {
            console.log('❌ Code not found');
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid or expired code'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        // Проверяем срок действия
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
            console.log('❌ Code expired');
            // Удаляем истекший код
            await supabase
                .from('verification_codes')
                .delete()
                .eq('email', email.toLowerCase());
            return new Response(JSON.stringify({
                success: false,
                error: 'Code expired'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        // Проверяем код (регистронезависимо)
        if (data.code.toUpperCase() !== code.toUpperCase()) {
            console.log('❌ Code mismatch');
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid code'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        console.log('✅ Code verified successfully');
        // Удаляем использованный код
        await supabase
            .from('verification_codes')
            .delete()
            .eq('email', email.toLowerCase());
        return new Response(JSON.stringify({
            success: true,
            message: 'Code verified successfully'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error(`💥 Error: ${error.message}`);
        return new Response(JSON.stringify({
            success: false,
            error: 'Verification failed'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
