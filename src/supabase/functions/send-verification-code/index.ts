import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const MAILERSEND_API_KEY = Deno.env.get("MAILERSEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
serve(async (req) => {
    console.log("🏳️‍🌈 Pride Guard: Function is running! Required method:", req.method);
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
        const { email } = await req.json();
        console.log(`📧 Requesting code for: ${email}`);
        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ error: 'Invalid email' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        // Генерируем код
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
        console.log(`✨ Code generated for ${email}`);
        // БЕЗОПАСНО: Сохраняем код в базе данных (НЕ возвращаем клиенту!)
        const { error: dbError } = await supabase
            .from('verification_codes')
            .upsert({
                email: email.toLowerCase(),
                code: code,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email'
            });
        if (dbError) {
            console.error('❌ Database error:', dbError);
            throw new Error('Failed to store verification code');
        }
        // Отправляем email
        await fetch('https://api.mailersend.com/v1/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MAILERSEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: {
                    email: 'no-reply@test-zxk54v8v5mzljy6v.mlsender.net',
                    name: 'Pride Guard — Registration 🏳️‍🌈',
                },
                to: [{ email }],
                subject: 'Your personal code - Pride Guard ✨',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(255,0,102,0.3);">
            <div style="background: linear-gradient(135deg, #ff0066 0%, #ff66cc 50%, #cc33ff 100%); padding: 50px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 42px; font-weight: bold; text-shadow: 0 4px 10px rgba(0,0,0,0.3);">Pride Guard</h1>
              <p style="color: white; font-size: 20px; margin: 15px 0 0;">Welcome to our safety place ! ❤️</p>
            </div>
            <div style="background: #ffffff; padding: 50px 40px; text-align: center;">
              <h2 style="color: #333; margin-top: 0; font-size: 28px;">Your access code</h2>
              <div style="background: linear-gradient(135deg, #ff0066, #ff66cc); padding: 40px; border-radius: 20px; margin: 40px 0; box-shadow: 0 15px 30px rgba(255,0,102,0.4);">
                <h1 style="color: white; font-size: 72px; margin: 0; letter-spacing: 12px; font-weight: bold; text-shadow: 0 6px 15px rgba(0,0,0,0.4);">
                  ${code}
                </h1>
              </div>
              <p style="color: #666; font-size: 18px; line-height: 1.8;">
                The code is valid for <strong style="color: #ff0066;">10 minutes</strong><br>
                Do not share it, please 😘
              </p>
            </div>
            <div style="background: #1a1a1a; color: #ccc; padding: 30px; text-align: center; font-size: 14px;">
              <p style="margin: 0;">© 2025 <strong style="color: #ff66cc;">Pride Guard</strong> — with love and protection<br>You are safe in our house. 🏠</p>
            </div>
          </div>
        `,
                text: `Pride Guard\n\nYour Access Code: ${code}\nExpires in 10 minutes.\n\nYou are safe ❤️`,
            }),
        });
        console.log(`🚀 Code sent to ${email}`);
        // БЕЗОПАСНО: НЕ возвращаем код клиенту!
        return new Response(JSON.stringify({
            success: true,
            message: 'Verification code sent to your email ✨'
            // НЕТ поля "code"!
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error(`💥 Error: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message || 'Something went wrong' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
