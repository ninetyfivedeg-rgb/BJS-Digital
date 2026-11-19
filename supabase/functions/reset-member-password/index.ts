import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(
        { success: false, message: 'Konfigurasi environment Supabase Edge Function belum lengkap.' },
        500
      );
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
    if (!token) {
      return jsonResponse(
        { success: false, message: 'Token autentikasi tidak ditemukan. Silakan login ulang.' },
        401
      );
    }

    // Admin client dengan service_role khusus di sisi server Supabase
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verifikasi identitas pemanggil menggunakan JWT user aktif
    const {
      data: { user: caller },
      error: callerError,
    } = await adminClient.auth.getUser(token);

    if (callerError || !caller) {
      return jsonResponse(
        { success: false, message: 'Sesi pengguna tidak valid atau sudah berakhir.' },
        401
      );
    }

    // Pastikan pemanggil berstatus aktif dan memiliki role super_admin / pengurus
    const { data: callerProfile, error: callerProfileErr } = await adminClient
      .from('profiles')
      .select('id, role, name, is_active')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfileErr || !callerProfile) {
      return jsonResponse(
        { success: false, message: 'Profil pemanggil tidak ditemukan.' },
        403
      );
    }

    const normalizedRole = String(callerProfile.role || '').trim().toLowerCase();
    const isAllowedAdmin =
      callerProfile.is_active !== false &&
      (normalizedRole === 'super_admin' || normalizedRole === 'pengurus');

    if (!isAllowedAdmin) {
      return jsonResponse(
        {
          success: false,
          message: 'Akses ditolak: Hanya Super Admin aktif yang dapat mereset kata sandi anggota.',
        },
        403
      );
    }

    const body = await req.json();
    const targetUserId = String(body?.targetUserId || '').trim();
    const temporaryPassword = String(body?.temporaryPassword || '');
    const mustChangePassword = body?.mustChangePassword !== false;

    if (!targetUserId) {
      return jsonResponse(
        { success: false, message: 'ID pengguna tujuan wajib diisi.' },
        400
      );
    }

    if (targetUserId === caller.id) {
      return jsonResponse(
        {
          success: false,
          message: 'Gunakan menu Ganti Sandi di pojok kanan atas untuk mengubah sandi akun Anda sendiri.',
        },
        400
      );
    }

    if (temporaryPassword.length < 6) {
      return jsonResponse(
        { success: false, message: 'Kata sandi sementara minimal 6 karakter.' },
        400
      );
    }

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('id, name, member_id, role')
      .eq('id', targetUserId)
      .maybeSingle();

    // Update password di Supabase Auth
    const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: temporaryPassword,
    });

    if (updateAuthErr) {
      return jsonResponse(
        {
          success: false,
          message: `Gagal memperbarui kata sandi di Supabase Auth: ${updateAuthErr.message}`,
        },
        400
      );
    }

    // Set flag must_change_password pada tabel profiles
    const { error: updateProfileErr } = await adminClient
      .from('profiles')
      .update({ must_change_password: mustChangePassword })
      .eq('id', targetUserId);

    if (updateProfileErr) {
      console.warn('Password auth berhasil diubah, namun gagal update must_change_password:', updateProfileErr.message);
    }

    // Catat rekam jejak audit tanpa menyimpan plaintext password
    try {
      const targetLabel = targetProfile?.name || targetProfile?.member_id || targetUserId;
      await adminClient.from('audit_logs').insert([
        {
          user_id: caller.id,
          actor_name: callerProfile.name || 'Super Admin',
          actor_role: callerProfile.role || 'super_admin',
          action: 'RESET_USER_PASSWORD',
          entity_type: 'profiles',
          entity_id: targetUserId,
          description: `Mereset kata sandi sementara untuk akun ${targetLabel} (${targetProfile?.member_id || '-'}), wajib ganti sandi: ${mustChangePassword}`,
          new_data: { must_change_password: mustChangePassword },
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log reset password:', auditErr);
    }

    return jsonResponse({
      success: true,
      message: `Kata sandi sementara untuk "${targetProfile?.name || targetProfile?.member_id || 'pengguna'}" berhasil diperbarui.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server.';
    return jsonResponse({ success: false, message }, 500);
  }
});
