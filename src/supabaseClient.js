import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://cicienznjufmozaczqay.supabase.co/rest/v1/';
export const SUPABASE_PUBLIC_KEY = 'sb_publishable_vjsmb2bOIGR88jiGKuKBng_G8LqON51';

// Supabase client expects the project base URL (without /rest/v1/)
const projectUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(projectUrl, SUPABASE_PUBLIC_KEY);

export default supabase;
