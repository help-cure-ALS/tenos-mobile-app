export function baseUrlNoSlash(baseUrl: string) {
    return baseUrl.replace(/\/$/, "");
}

export async function safeText(res: Response): Promise<string> {
    try {
        return await res.text();
    }
    catch {
        return "";
    }
}

export function isUuid(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function isUnknownSubjectResponse(status: number, text: string): boolean {
    return status === 404 && text.includes(`"unknown_subject"`);
}

export function isDeviceLimitReached(status: number, text: string): boolean {
    return status === 403 && text.includes(`"device_limit_reached"`);
}

export function isRateLimited(status: number): boolean {
    return status === 429;
}

export function includesTokenRevoked(text: string): boolean {
    return text.includes("token_revoked");
}
