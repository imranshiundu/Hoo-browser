import * as os from 'os';

export interface OSProfile {
    platform: NodeJS.Platform;
    release: string;
    arch: string;
    homedir: string;
    desktopHint: 'linux' | 'macos' | 'windows' | 'unknown';
    packagingTarget: 'AppImage/deb' | 'dmg' | 'nsis' | 'unknown';
    permissionModel: string;
}

export function getOSProfile(): OSProfile {
    const platform = process.platform;
    const desktopHint = platform === 'linux'
        ? 'linux'
        : platform === 'darwin'
            ? 'macos'
            : platform === 'win32'
                ? 'windows'
                : 'unknown';

    const packagingTarget = platform === 'linux'
        ? 'AppImage/deb'
        : platform === 'darwin'
            ? 'dmg'
            : platform === 'win32'
                ? 'nsis'
                : 'unknown';

    return {
        platform,
        release: os.release(),
        arch: os.arch(),
        homedir: os.homedir(),
        desktopHint,
        packagingTarget,
        permissionModel: platform === 'linux'
            ? 'Electron prompts plus Linux desktop portal behavior where available'
            : 'Electron permission prompts with operating-system mediation'
    };
}
