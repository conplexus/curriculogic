// src/lib/flowNav.ts
"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";


export function useFlowNav() {
const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();


const setNodeParam = useCallback(
(id: string | null, opts: { replace?: boolean } = {}) => {
const sp = new URLSearchParams(searchParams?.toString());
if (id) sp.set("node", id);
else sp.delete("node");
const url = `${pathname}?${sp.toString()}`;
if (opts.replace) router.replace(url as any);
else router.push(url as any);
},
[router, pathname, searchParams]
);


const getNodeParam = useCallback(() => searchParams?.get("node") ?? null, [searchParams]);


const copyLinkForNode = useCallback(async (id: string) => {
const sp = new URLSearchParams(searchParams?.toString());
sp.set("node", id);
const url = `${window.location.origin}${pathname}?${sp.toString()}`;
await navigator.clipboard.writeText(url);
return url;
}, [pathname, searchParams]);


return { setNodeParam, getNodeParam, copyLinkForNode };
}