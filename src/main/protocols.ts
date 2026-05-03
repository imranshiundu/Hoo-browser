import { shell } from 'electron';
import { isExternalProtocol } from './privacy-filters';

export type ExternalProtocolResult = {
    handled: boolean;
    reason?: string;
};

export function shouldOpenExternally(url: string): boolean {
    return isExternalProtocol(url);
}

export async function openExternalProtocol(url: string): Promise<ExternalProtocolResult> {
    if (!shouldOpenExternally(url)) return { handled: false };

    try {
        await shell.openExternal(url);
        return { handled: true, reason: 'opened-externally' };
    } catch (error) {
        console.error('[Protocols] Failed to open external protocol:', error);
        return { handled: true, reason: 'external-open-failed' };
    }
}

export function isNormalWebNavigation(url: string): boolean {
    const lower = (url || '').trim().toLowerCase();
    return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('about:') || lower.startsWith('data:') || lower.startsWith('file:') || lower.startsWith('hoo:');
}

export function normalizeUserNavigationInput(url: string): string {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'hoo://home';
    if (shouldOpenExternally(trimmed)) return trimmed;
    if (isNormalWebNavigation(trimmed)) return trimmed;
    return `https://${trimmed}`;
}
