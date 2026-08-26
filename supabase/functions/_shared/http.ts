import { createClient, type User } from 'npm:@supabase/supabase-js@2.107.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const publishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
const secretKey =
  Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin':
    Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:8081',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

export function optionsResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: error.code, message: error.message },
      error.status,
    );
  }

  console.error(error);
  return jsonResponse(
    { error: 'INTERNAL_ERROR', message: 'サーバー処理に失敗しました。' },
    500,
  );
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name}がEdge Function環境に設定されていません。`);
  }
  return value;
}

export function createAdminClient() {
  return createClient(
    requireEnv(supabaseUrl, 'SUPABASE_URL'),
    requireEnv(secretKey, 'SB_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function requireUser(request: Request): Promise<User> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    throw new HttpError(401, 'UNAUTHORIZED', 'ログインが必要です。');
  }

  const authClient = createClient(
    requireEnv(supabaseUrl, 'SUPABASE_URL'),
    requireEnv(publishableKey, 'SB_PUBLISHABLE_KEY'),
    {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'ログイン状態を確認できません。');
  }
  return data.user;
}

export function stringField(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, 'INVALID_REQUEST', `${field}を指定してください。`);
  }
  return value.trim();
}

