// Receives batches of commands from signed-in players. Not used by the game until
// cloud saves arrive in Stage 3. Run `npm run build:server` before deploying: it
// bundles the game rules into ../_shared/game-server.js.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createSupabaseSyncStore, handleSync } from "../_shared/game-server.js";

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return new Response(null, { status: 401 });

  // The service-role key exists only in this function's server environment.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const result = await handleSync(
    createSupabaseSyncStore(admin),
    data.user.id,
    body,
    Date.now(),
  );
  return Response.json(result);
});
