// src/components/shared/FullLoader.jsx
import React from "react";
import { HashLoader } from "react-spinners";

export default function FullLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80 z-50">
      <div className="flex flex-col items-center">
        <HashLoader color="#2563EB" size={80} /> 
        <p className="mt-4 text-blue-600 font-semibold">Loading...</p>
      </div>
    </div>
  );
}
