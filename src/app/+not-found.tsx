import { useRouter } from "expo-router";

import { StatusScreen } from "@/components/status-screen";
import { useMode } from "@/lib/mode";

/** Any address the app has no screen for: back to the home of the mode in use. */
export default function NotFound() {
  const router = useRouter();
  const { mode } = useMode();
  return <StatusScreen kind="notFound" onHome={() => router.replace(mode === "citizen" ? "/citoyen" : mode === "journalist" ? "/" : "/accueil")} />;
}
