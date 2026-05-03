type NetworkPolicySettings = {
    lowDataMode?: boolean;
    blockThirdPartyFonts?: boolean;
    blockAutoplayMedia?: boolean;
};

const fontExtensions = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
const mediaExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.ogg'];

function hasAnyExtension(url: string, extensions: string[]) {
    const clean = url.split('?')[0].toLowerCase();
    return extensions.some(ext => clean.endsWith(ext));
}

export function shouldBlockForLowData(url: string, resourceType: string, settings: NetworkPolicySettings): { block: boolean; reason?: string } {
    if (!settings.lowDataMode) return { block: false };

    if (settings.blockThirdPartyFonts && (resourceType === 'font' || hasAnyExtension(url, fontExtensions))) {
        return { block: true, reason: 'font' };
    }

    if (settings.blockAutoplayMedia && (resourceType === 'media' || hasAnyExtension(url, mediaExtensions))) {
        return { block: true, reason: 'media' };
    }

    return { block: false };
}
