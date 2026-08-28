// src/lib/supabase.ts throws at import time if these aren't set, and most modules pull it in
// transitively. Give the tests harmless placeholder values -- nothing here makes a real
// network call.
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'test-anon-key';
