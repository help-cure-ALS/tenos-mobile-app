// src/hooks/useFhirQuery.ts
import { useCallback, useEffect, useState } from "react";
import { on } from "@/src/lib/bus";
import { useFhirRepo } from "@/src/hooks/useFhirRepo";

export function useFhirQuery<T = any>(
    resourceType: string,
    opts?: { includeDeleted?: boolean; limit?: number; filter?: (r: any) => boolean }
) {
    const repo = useFhirRepo();
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        const list = await repo.list(resourceType, {
            includeDeleted: !!opts?.includeDeleted,
            limit: opts?.limit ?? 500,
        });
        const rows = list.map((x: any) => x.resource);
        const filtered = opts?.filter ? rows.filter(opts.filter) : rows;
        setData(filtered);
        setLoading(false);
    }, [repo, resourceType, opts?.includeDeleted, opts?.limit, opts?.filter]);

    useEffect(() => {
        reload();
        const unsubscribe = on("fhir:changed", reload);
        return unsubscribe;
    }, [reload]);

    return { data, loading, reload };
}
