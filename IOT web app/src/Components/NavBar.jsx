import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import FullLoader from "../pages/FullLoader";

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    setLoading(true); // 1. Start loading
    await supabase.auth.signOut(); // 2. Sign out from Supabase
    
    // 3. Wait for the state to update, then navigate
    // We can use a small delay or a simple trick to ensure
    // the UI has a chance to update before we navigate.
    setTimeout(() => {
      setLoading(false); // 4. Hide the loader first
      navigate("/login"); // 5. Then navigate
    }, 500); // Wait for half a second
  }

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {loading && <FullLoader />}
      <nav className="bg-white text-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link to="/" className="text-2xl font-extrabold text-blue-600 transition-colors duration-200 hover:text-blue-800">
              IoT Door
            </Link>

            {/* Links */}
            <div className="flex items-center space-x-6">
              {!user ? (
                <>
                  <Link
                    to="/login"
                    className={`font-medium transition-colors duration-200 ${
                      isActive("/login")
                        ? "text-blue-600 font-bold"
                        : "text-gray-600 hover:text-blue-600"
                    }`}
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className={`px-4 py-2 rounded-lg font-semibold shadow-md transition-colors duration-200 ${
                      isActive("/signup")
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/"
                    className={`font-medium transition-colors duration-200 ${
                      isActive("/")
                        ? "text-blue-600 font-bold"
                        : "text-gray-600 hover:text-blue-600"
                    }`}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-red-600 transition-colors duration-200"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}