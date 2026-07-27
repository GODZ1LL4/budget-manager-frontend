import { createClient } from "@supabase/supabase-js";
import { getItem, removeItem, setItem } from "./storage/kvStore";

const capacitorStorage = {
  getItem: async (key) => getItem(key),
  setItem: async (key, value) => setItem(key, value),
  removeItem: async (key) => removeItem(key),
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: capacitorStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabase;
