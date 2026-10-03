"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
export function useQueryState() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  return {
    params,
    setQuery: (values: Record<string, string | null>, replace = false) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(values).forEach(([key, value]) =>
        value === null ? next.delete(key) : next.set(key, value),
      );
      const url = `${path}?${next}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
  };
}
