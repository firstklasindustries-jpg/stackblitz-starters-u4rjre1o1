import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uylyskfsylmfwxfvurdo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bHlza2ZzeWxtZnd4ZnZ1cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTEwMDIsImV4cCI6MjA3OTcyNzAwMn0.bqO7MFa3G87tB9E9GKdY1THjQFlP2napJjNLl4BHDL0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
