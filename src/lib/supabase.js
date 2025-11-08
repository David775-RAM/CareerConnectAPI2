const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// For testing purposes, use placeholder values if env vars are missing
const defaultSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const defaultServiceKey = supabaseServiceKey || 'placeholder-key';

let supabase;
try {
	supabase = createClient(defaultSupabaseUrl, defaultServiceKey, {
		auth: { persistSession: false },
	});

	if (!supabaseUrl || !supabaseServiceKey) {
		console.log('🔶 Supabase environment variables not found. Using placeholder values.');
		console.log('🔶 Server will run but database operations will fail.');
		console.log('🔶 Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for full functionality.');
	} else {
		console.log('✅ Supabase initialized successfully');
	}
} catch (error) {
	console.error('❌ Failed to initialize Supabase:', error.message);
	console.log('🔶 Server will run without database functionality');
	supabase = null;
}

module.exports = { supabase };



