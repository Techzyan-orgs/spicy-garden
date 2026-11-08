"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="relative p-2.5 rounded-full transition-all duration-300 bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 hover:text-chili-600 dark:hover:text-chili-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-chili-500"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <Sun className="w-5 h-5 transition-transform duration-300 transform rotate-0 scale-100 dark:-rotate-90 dark:scale-0 text-amber-500" />
        <Moon className="w-5 h-5 absolute transition-transform duration-300 transform rotate-90 scale-0 dark:rotate-0 dark:scale-100 text-bistro-300" />
      </div>
    </button>
  );
}
