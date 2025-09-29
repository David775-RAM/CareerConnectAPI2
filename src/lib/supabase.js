const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	// Do not throw at import time in case of tooling; surface clear error at runtime
	console.warn('Supabase env vars missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
	auth: { persistSession: false },
});

module.exports = { supabase };



