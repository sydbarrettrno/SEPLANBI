import { useEffect } from "react";
import RootV2 from "./RootV2";

export default function RootV3() {
  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const previousHash = window.location.hash;
      originalPushState(data, unused, url);
      if (window.location.hash !== previousHash) window.dispatchEvent(new Event("hashchange"));
    }) as History["pushState"];

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const previousHash = window.location.hash;
      originalReplaceState(data, unused, url);
      if (window.location.hash !== previousHash) window.dispatchEvent(new Event("hashchange"));
    }) as History["replaceState"];

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return <RootV2 />;
}
