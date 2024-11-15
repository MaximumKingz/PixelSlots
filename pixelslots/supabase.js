// Supabase configuration
const SUPABASE_URL = 'https://vcspybmymfmxhvqeehkp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjc3B5Ym15bWZteGh2cWVlaGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2OTU3NzEsImV4cCI6MjA0NzI3MTc3MX0.wyzWwNd5F0HDjKCRPnSZ7vXajh6XVa9t0TjU5PG6P7I';

// Initialize Supabase client
const initSupabase = () => {
    try {
        const { createClient } = supabase;
        const client = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase client created:', client);
        return client;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        return null;
    }
};

// Export for use in other files
window.initSupabase = initSupabase;
