import { app } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Hoo ships with two update channels:
//
//  1. Packaged installs (AppImage, deb, NSIS, DMG) use electron-updater against
//     GitHub Releases. Hoo checks on startup, downloads the new build in the
//     background, and offers a "Restart to update" action — the way a real
//     browser updates itself.
//  2. Source checkouts keep the git-based updater: pull main, install deps only
//     when package files changed, rebuild only when build inputs changed.
//
// Everything else (a plain folder without .git, an exotic target) gets an
// honest "unsupported" answer with manual instructions instead of a fake check.

export type UpdateChannel = 'electron-updater' | 'git-source' | 'none';

export type AppUpdatePhase = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'current' | 'error';

export interface AppUpdateStatus {
    phase: AppUpdatePhase;
    message: string;
    channel: UpdateChannel;
    version?: string;
    percent?: number;
}

export interface AppUpdateResult {
    ok: boolean;
    status: 'updated' | 'current' | 'unsupported' | 'busy' | 'failed' | 'restart-required' | 'downloading';
    message: string;
    details?: string;
    channel: UpdateChannel;
    version?: string;
}

const RELEASES_URL = 'https://github.com/imranshiundu/Hoo-browser/releases';
const MB = 1024 * 1024;

let broadcastStatus: ((status: AppUpdateStatus) => void) | null = null;
let activeChannel: UpdateChannel = 'none';
let availableVersion: string | null = null;
let downloadedVersion: string | null = null;
let updateInProgress = false;

// ---- Pure helpers (unit-tested) -------------------------------------------

export function resolveUpdateChannel(input: { isPackaged: boolean; hasGitRepo: boolean }): UpdateChannel {
    if (input.isPackaged) return 'electron-updater';
    if (input.hasGitRepo) return 'git-source';
    return 'none';
}

export function shouldAutoCheckOnStartup(input: { isPackaged: boolean; disabledEnv?: string }): boolean {
    if (!input.isPackaged) return false;
    return input.disabledEnv !== '1';
}

export function formatDownloadProgress(progress: { percent?: number | null; transferred?: number | null; total?: number | null }): string {
    const percent = typeof progress.percent === 'number' && Number.isFinite(progress.percent)
        ? Math.min(100, Math.max(0, progress.percent))
        : null;
    if (percent === null) return 'Downloading update…';
    const percentText = `${percent.toFixed(1)}%`;
    const { transferred, total } = progress;
    if (typeof total === 'number' && total > 0 && typeof transferred === 'number' && transferred >= 0) {
        return `${percentText} (${(transferred / MB).toFixed(1)} MB of ${(total / MB).toFixed(1)} MB)`;
    }
    return percentText;
}

export function friendlyUpdaterError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? 'Unknown updater error');
    const firstLine = raw.split('\n').map(line => line.trim()).filter(Boolean)[0] || 'Unknown updater error';
    const lowered = firstLine.toLowerCase();
    if (/(err_internet_disconnected|enotfound|econnrefused|etimedout|eai_again)/.test(lowered)) {
        return 'Hoo could not reach GitHub. Updates will retry the next time Hoo starts.';
    }
    if (lowered.includes('signature') || lowered.includes('code sign')) {
        return 'Auto-update needs a signed build on this platform. Download the latest installer from GitHub Releases instead.';
    }
    if (lowered.includes('404') || lowered.includes('latest.yml') || lowered.includes('latest-mac.yml')) {
        return `No published release was found for this channel yet. Grab installers from ${RELEASES_URL}.`;
    }
    return firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine;
}

// ---- electron-updater bridge ----------------------------------------------

// electron-updater is require()d lazily: only packaged builds ever load it,
// and keeping it out of the module graph lets vitest run the pure logic
// without dragging the whole updater tree in.
interface AutoUpdaterLike {
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;
    allowPrerelease: boolean;
    logger: unknown;
    on(event: string, listener: (...args: any[]) => void): unknown;
    checkForUpdates(): Promise<any>;
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

let autoUpdaterInstance: AutoUpdaterLike | null = null;

function loadAutoUpdater(): AutoUpdaterLike | null {
    if (autoUpdaterInstance) return autoUpdaterInstance;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        autoUpdaterInstance = require('electron-updater').autoUpdater as AutoUpdaterLike;
        return autoUpdaterInstance;
    } catch {
        return null;
    }
}

export function hasSourceGitRepo(): boolean {
    try {
        return fs.existsSync(path.join(app.getAppPath(), '.git'));
    } catch {
        return false;
    }
}

function currentVersion(): string {
    try { return app.getVersion(); } catch { return 'unknown'; }
}

function emit(status: Omit<AppUpdateStatus, 'channel'>): void {
    if (broadcastStatus) broadcastStatus({ ...status, channel: activeChannel });
}

function initPackagedUpdater(): boolean {
    const updater = loadAutoUpdater();
    if (!updater) {
        activeChannel = 'none';
        return false;
    }
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.logger = console;
    updater.on('checking-for-update', (): void => {
        emit({ phase: 'checking', message: 'Checking for Hoo updates…' });
    });
    updater.on('update-available', (info: any): void => {
        availableVersion = typeof info?.version === 'string' ? info.version : null;
        emit({
            phase: 'downloading',
            message: `Hoo ${availableVersion || 'update'} found — downloading in the background…`,
            version: availableVersion || undefined
        });
    });
    updater.on('update-not-available', (info: any): void => {
        emit({ phase: 'current', message: `Hoo ${info?.version || currentVersion()} is up to date.` });
    });
    updater.on('download-progress', (progress: any): void => {
        const percent = typeof progress?.percent === 'number' && Number.isFinite(progress.percent)
            ? Math.min(100, Math.max(0, progress.percent))
            : undefined;
        emit({
            phase: 'downloading',
            message: formatDownloadProgress(progress),
            percent
        });
    });
    updater.on('update-downloaded', (info: any): void => {
        downloadedVersion = typeof info?.version === 'string' ? info.version : downloadedVersion;
        emit({
            phase: 'downloaded',
            message: `Hoo ${downloadedVersion || 'update'} is ready. Restart to finish the update.`,
            version: downloadedVersion || undefined
        });
    });
    updater.on('error', (error: unknown): void => {
        emit({ phase: 'error', message: friendlyUpdaterError(error) });
    });
    return true;
}

export function initAutoUpdater(broadcast: (status: AppUpdateStatus) => void): void {
    broadcastStatus = broadcast;
    activeChannel = resolveUpdateChannel({ isPackaged: app.isPackaged, hasGitRepo: hasSourceGitRepo() });
    availableVersion = null;
    downloadedVersion = null;
    if (activeChannel === 'electron-updater') initPackagedUpdater();
}

// ---- Git source updater ----------------------------------------------------

function resolveAppRoot(): string {
    const candidates = [
        process.env.HOO_APP_ROOT,
        process.cwd(),
        app.getAppPath(),
        path.dirname(app.getAppPath()),
        path.join(app.getPath('home'), '.local/share/hoo-browser')
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        let current = path.resolve(candidate);
        for (let i = 0; i < 8; i += 1) {
            if (fs.existsSync(path.join(current, '.git')) && fs.existsSync(path.join(current, 'package.json'))) return current;
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
    }

    return app.getAppPath();
}

function run(command: string, args: string[], cwd: string, timeoutMs = 1000 * 60 * 10): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            cwd,
            timeout: timeoutMs,
            env: {
                ...process.env,
                CI: '1',
                npm_config_audit: 'false',
                npm_config_fund: 'false',
                npm_config_update_notifier: 'false',
                npm_config_progress: 'false',
                npm_config_prefer_offline: 'true'
            }
        }, (error, stdout, stderr) => {
            if (error) return reject(new Error(`${command} ${args.join(' ')} failed\n${error.message}\n${stderr || ''}`.trim()));
            resolve({ stdout, stderr });
        });
    });
}

function onlyGeneratedInstallChanges(status: string): boolean {
    const lines = status.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return true;
    return lines.every(line => /^(M|A|\?\?)\s+(package-lock\.json|dist\/|\.cache\/)/.test(line));
}

async function cleanGeneratedChanges(appRoot: string, status: string): Promise<void> {
    const lines = status.split('\n').map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
        const file = line.replace(/^(M|A|\?\?)\s+/, '');
        if (file === 'package-lock.json') await run('git', ['checkout', '--', file], appRoot).catch(() => ({ stdout: '', stderr: '' }));
        if (file.startsWith('dist/') || file.startsWith('.cache/')) await run('rm', ['-rf', file], appRoot).catch(() => ({ stdout: '', stderr: '' }));
    }
}

async function changedFilesBetween(appRoot: string, before: string, after: string): Promise<string[]> {
    const diff = (await run('git', ['diff', '--name-only', before, after], appRoot)).stdout.trim();
    return diff ? diff.split('\n').map(line => line.trim()).filter(Boolean) : [];
}

function dependencyFilesChanged(files: string[]): boolean {
    return files.some(file => file === 'package.json' || file === 'package-lock.json' || file === 'npm-shrinkwrap.json');
}

function buildRelevantFilesChanged(files: string[]): boolean {
    if (!files.length) return false;
    return files.some(file =>
        file.startsWith('src/') ||
        file.startsWith('public/') ||
        file.startsWith('assets/') ||
        file === 'package.json' ||
        file === 'package-lock.json' ||
        file === 'tsconfig.json' ||
        file === 'vite.config.ts' ||
        file === 'webpack.config.js' ||
        file.endsWith('.html')
    );
}

function summarizeFiles(files: string[]): string {
    if (!files.length) return 'No changed files detected.';
    const shown = files.slice(0, 18).join('\n');
    const extra = files.length > 18 ? `\n…plus ${files.length - 18} more file(s)` : '';
    return `${shown}${extra}`;
}

async function checkForSourceUpdates(): Promise<AppUpdateResult> {
    const channel: UpdateChannel = 'git-source';
    if (updateInProgress) {
        return { ok: false, status: 'busy', message: 'Hoo is already checking for updates.', channel };
    }

    updateInProgress = true;

    try {
        const appRoot = resolveAppRoot();
        const gitDir = path.join(appRoot, '.git');

        if (!fs.existsSync(gitDir)) {
            return {
                ok: false,
                status: 'unsupported',
                message: 'This copy is not running from the source repo, so Hoo cannot safely pull GitHub updates from inside the app.',
                details: `Detected app root: ${appRoot}\nRun this manually instead:\ncd ~/.local/share/hoo-browser && git pull origin main && npm install --no-audit --no-fund --prefer-offline && npm run build`,
                channel
            };
        }

        let status = (await run('git', ['status', '--porcelain'], appRoot)).stdout.trim();
        if (status && onlyGeneratedInstallChanges(status)) {
            await cleanGeneratedChanges(appRoot, status);
            status = (await run('git', ['status', '--porcelain'], appRoot)).stdout.trim();
        }

        if (status) {
            return {
                ok: false,
                status: 'failed',
                message: 'Update paused because this install has local edits. Hoo will not overwrite your work.',
                details: `Detected app root: ${appRoot}\nLocal changes:\n${status}\n\nCommit, stash, or remove those changes, then check again.`,
                channel
            };
        }

        await run('git', ['fetch', '--prune', '--quiet', 'origin', 'main'], appRoot, 1000 * 60 * 3);
        const local = (await run('git', ['rev-parse', 'HEAD'], appRoot)).stdout.trim();
        const remote = (await run('git', ['rev-parse', 'origin/main'], appRoot)).stdout.trim();

        if (local === remote) {
            return { ok: true, status: 'current', message: 'Hoo Browser is already up to date.', details: `Checked: ${appRoot}\nCommit: ${local}`, channel };
        }

        const changedFiles = await changedFilesBetween(appRoot, local, remote);
        const needsInstall = dependencyFilesChanged(changedFiles) || !fs.existsSync(path.join(appRoot, 'node_modules'));
        const needsBuild = buildRelevantFilesChanged(changedFiles);

        await run('git', ['pull', '--ff-only', '--quiet', 'origin', 'main'], appRoot, 1000 * 60 * 3);

        if (needsInstall) {
            if (fs.existsSync(path.join(appRoot, 'package-lock.json'))) {
                await run('npm', ['ci', '--no-audit', '--no-fund', '--prefer-offline'], appRoot, 1000 * 60 * 10);
            } else {
                await run('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], appRoot, 1000 * 60 * 10);
            }
        }

        if (needsBuild) {
            await run('npm', ['run', 'build'], appRoot, 1000 * 60 * 6);
        }

        return {
            ok: true,
            status: 'updated',
            message: needsBuild
                ? 'Hoo Browser updated and rebuilt. Restart Hoo to use the new version.'
                : 'Hoo Browser updated. Restart Hoo to use the new version.',
            details: `Updated: ${appRoot}\nFrom: ${local}\nTo: ${remote}\nInstall: ${needsInstall ? 'yes' : 'skipped'}\nBuild: ${needsBuild ? 'yes' : 'skipped'}\n\nChanged files:\n${summarizeFiles(changedFiles)}`,
            channel
        };
    } catch (error: any) {
        return {
            ok: false,
            status: 'failed',
            message: 'Hoo could not complete the update check.',
            details: error?.message || String(error),
            channel
        };
    } finally {
        updateInProgress = false;
    }
}

// ---- Unified entry points used by main.ts ----------------------------------

export async function checkForAppUpdates(): Promise<AppUpdateResult> {
    const channel = resolveUpdateChannel({ isPackaged: app.isPackaged, hasGitRepo: hasSourceGitRepo() });
    activeChannel = channel;

    if (channel === 'git-source') return checkForSourceUpdates();

    if (channel !== 'electron-updater') {
        return {
            ok: false,
            status: 'unsupported',
            message: 'This copy cannot self-update. Download the latest Hoo installer from GitHub Releases.',
            details: RELEASES_URL,
            channel
        };
    }

    if (updateInProgress) {
        return { ok: false, status: 'busy', message: 'Hoo is already checking for updates.', channel };
    }

    if (downloadedVersion) {
        return {
            ok: true,
            status: 'restart-required',
            message: `Hoo ${downloadedVersion} is downloaded. Restart to finish the update.`,
            channel,
            version: downloadedVersion
        };
    }

    const updater = loadAutoUpdater();
    if (!updater || !initPackagedUpdater()) {
        return {
            ok: false,
            status: 'unsupported',
            message: 'The auto-updater is unavailable in this build. Download installers from GitHub Releases.',
            details: RELEASES_URL,
            channel
        };
    }

    updateInProgress = true;
    availableVersion = null;
    emit({ phase: 'checking', message: 'Checking for Hoo updates…' });
    try {
        await updater.checkForUpdates();
        if (downloadedVersion) {
            return {
                ok: true,
                status: 'restart-required',
                message: `Hoo ${downloadedVersion} is downloaded. Restart to finish the update.`,
                channel,
                version: downloadedVersion
            };
        }
        if (availableVersion) {
            return {
                ok: true,
                status: 'downloading',
                message: `Hoo ${availableVersion} is downloading in the background. Hoo will prompt when it is ready.`,
                channel,
                version: availableVersion
            };
        }
        return { ok: true, status: 'current', message: `Hoo ${currentVersion()} is up to date.`, channel };
    } catch (error: unknown) {
        const message = friendlyUpdaterError(error);
        emit({ phase: 'error', message });
        return { ok: false, status: 'failed', message, channel };
    } finally {
        updateInProgress = false;
    }
}

export async function installAppUpdate(): Promise<{ ok: boolean; message: string }> {
    const channel = activeChannel;
    if (channel === 'electron-updater') {
        const updater = loadAutoUpdater();
        if (!updater) return { ok: false, message: 'The auto-updater is unavailable in this build.' };
        if (!downloadedVersion) {
            return { ok: false, message: 'No downloaded update is ready yet. Check for updates first.' };
        }
        updater.quitAndInstall(false, true);
        return { ok: true, message: `Restarting Hoo to install ${downloadedVersion}…` };
    }
    if (channel === 'git-source') {
        // The source updater already pulled and rebuilt dist; a relaunch is
        // all that is left to run the new build.
        try {
            app.relaunch();
            app.exit(0);
            return { ok: true, message: 'Restarting Hoo…' };
        } catch (error: unknown) {
            return { ok: false, message: error instanceof Error ? error.message : 'Could not relaunch Hoo.' };
        }
    }
    return { ok: false, message: 'This copy cannot self-update. Download the latest installer from GitHub Releases.' };
}
