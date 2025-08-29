// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data?.session);
      setLoading(false);
    }
    check();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!authed) return <Navigate to="/auth" replace />;
  return children;
}
