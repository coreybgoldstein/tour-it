"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /lists is deprecated — Lists now live inside the Profile page as the second tab.
// Anyone hitting an old bookmark or in-app link lands on /profile instead.
export default function ListsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return null;
}
