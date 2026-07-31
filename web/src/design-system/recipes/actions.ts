export const actionRecipes = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60",
  secondary: "inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 font-medium text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60",
  destructive: "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60",
} as const;
