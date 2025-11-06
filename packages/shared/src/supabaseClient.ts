import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://uirdgypveetgohptzxiw.supabase.co'
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpcmRneXB2ZWV0Z29ocHR6eGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODkwNTMsImV4cCI6MjA3Nzk2NTA1M30.8-Wnslvj8erg1M5OLjsOc7FYQPY5YMFO5ycbLQI8DRs'
export const supabase = createClient(supabaseUrl, supabaseKey)

