-- Create users table if not exists
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    balance DECIMAL(10,2) DEFAULT 10.00,
    total_spins BIGINT DEFAULT 0,
    total_wins BIGINT DEFAULT 0,
    total_losses BIGINT DEFAULT 0,
    biggest_win DECIMAL(10,2) DEFAULT 0,
    total_win_amount DECIMAL(10,2) DEFAULT 0,
    total_loss_amount DECIMAL(10,2) DEFAULT 0,
    jackpots_won BIGINT DEFAULT 0,
    last_spin TIMESTAMPTZ DEFAULT NOW(),
    last_win TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for insert
CREATE POLICY "Allow anonymous insert" ON public.users
    FOR INSERT 
    WITH CHECK (true);

-- Allow anonymous select for own data
CREATE POLICY "Allow anonymous select own data" ON public.users
    FOR SELECT 
    USING (true);

-- Allow anonymous update own data
CREATE POLICY "Allow anonymous update own data" ON public.users
    FOR UPDATE 
    USING (true);

-- Add index on telegram_id
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON public.users (telegram_id);
