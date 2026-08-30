export const actionRecipes = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60",
  secondary: "inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 font-medium text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60",
  destructive: "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60",
  clientsHeroPrimary: "inline-flex w-fit shrink-0 items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700",
  clientsHeroSecondary: "inline-flex w-fit shrink-0 items-center gap-2 rounded-2xl border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700",
  clientsFilterPrimary: "rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700",
  clientsFilterSecondary: "rounded-2xl border border-violet-100 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700",
  clientsRowAction: "inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700",
} as const;
