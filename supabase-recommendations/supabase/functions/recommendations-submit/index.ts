import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  name?: string;
  rating: number;
  comment: string;
  turnstileToken: string;
};

async function verifyTurnstile(secretKey: string, token: string, ip?: string) {
  const body = new URLSearchParams();
  body.set("secret", secretKey);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return await res.json(); // { success: boolean, ... }
}

function getClientIp(req: Request) {
  // depende del proxy, mejor no confiar demasiado; lo usamos solo para rate-limit light
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? undefined;
}

function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", data).then((hash) => {
    const bytes = new Uint8Array(hash);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = (await req.json()) as Payload;

    const name = (payload.name ?? "").toString().trim().slice(0, 60);
    const rating = Number(payload.rating);
    const comment = (payload.comment ?? "").toString().trim();
    const token = (payload.turnstileToken ?? "").toString();

    if (!token) {
      return new Response(JSON.stringify({ error: "captcha_required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "invalid_rating" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (comment.length < 20 || comment.length > 800) {
      return new Response(JSON.stringify({ error: "invalid_comment_length" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    // Verificar Turnstile
    const verify = await verifyTurnstile(turnstileSecret, token, ip);
    if (!verify?.success) {
      return new Response(JSON.stringify({ error: "captcha_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Rate limit básico: max 3 submissions / 24h por ip_hash
    // (lo hacemos consultando recommendations por ip_hash)
    const ipHash = ip ? await sha256Hex(`ip:${ip}`) : null;

    if (ipHash) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from("recommendations")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);

      if (countError) throw countError;

      if ((count ?? 0) >= 3) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }
    }

    const { error } = await supabase.from("recommendations").insert({
      name: name.length ? name : null,
      rating,
      comment,
      status: "pending",
      ip_hash: ipHash,
      user_agent: ua.slice(0, 200),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});