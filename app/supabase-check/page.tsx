import { createClient } from "@/lib/supabase/server";

export default async function SupabaseCheckPage() {
  const supabase = await createClient();
  const { error } = await supabase.auth.getSession();

  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      {error ? (
        <p>❌ Conexión con Supabase: ERROR — {error.message}</p>
      ) : (
        <p>✅ Conexión con Supabase: OK</p>
      )}
    </main>
  );
}
