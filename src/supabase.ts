import { createClient } from '@supabase/supabase-js';

// Public client credentials; database and Storage policies enforce authorization.
// This project is separate from Rebel Tech Portal.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://moqpjxzkhdmruqxpjvpz.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_So9dItpfMWoiN3MuUe7ANw_UVhcib5y',
);
export const PHOTO_BUCKET = 'story-photos';
