import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("recommendations")
      .select("rating")
      .eq("status", "approved");

    if (error) throw error;

    const items = data ?? [];
    const total = items.length;

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const r of items) {
      const n = Number(r.rating) as 1|2|3|4|5;
      if (n >= 1 && n <= 5) {
        dist[n] += 1;
        sum += n;
      }
    }

    const avg = total ? sum / total : 0;

    return new Response(JSON.stringify({ total, avg, dist }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});