import { app } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

type UpdateResult = {
    ok: boolean;
    status: 'updated' | 'current' | 'unsupported' | 'busy' | 'failed';
    message: string;
    details?: string;
};

let updateInProgress = false;

function resolveAppRoot(): string {
    const appPath = app.getAppPath();
    if (fs.existsSync(path.join(appPath, '.git'))) return appPath;
    let current = appPath;
    for (let i = 0; i < 5; i += 1) {
        if (fs.existsSync(path.join(current, '.git'))) return current;
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return appPath;
}

function run(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, timeout: 1000 * 60 * 12 }, (error, stdout, stderr) => {
            if (error) return reject(new Error(`${error.message}\n${stderr || ''}`.trim()));
            resolve({ stdout, stderr });
        });
    });
}

function onlyGeneratedInstallChanges(status: string) {
    const lines = status.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return true;
    return lines.every(line => /^(M|A|\?\?)\s+package-lock\.json$/.test(line));
}

export async function checkForHooUpdates(): Promise<UpdateResult> {
    if (updateInProgress) {
        return { ok: false, status: 'busy', message: 'Hoo is already checking for updates.' };
    }

    updateInProgress = true;

    try {
        const appRoot = resolveAppRoot();
        const gitDir = path.join(appRoot, '.git');

        if (!fs.existsSync(gitDir)) {
            return {
                ok: false,
                status: 'unsupported',
                message: 'Manual GitHub updates work only for source installs. Packaged AppImage/deb updates need a signed release updater next.',
                details: `App path: ${appRoot}`
            };
        }

        const status = (await run('git', ['status', '--porcelain'], appRoot)).stdout.trim();
        if (status && !onlyGeneratedInstallChanges(status)) {
            return {
                ok: false,
                status: 'failed',
                message: 'Update skipped because this install has local changes. Hoo will not overwrite your work.',
                details: status
            };
        }

        if (status && onlyGeneratedInstallChanges(status)) {
            await run('git', ['checkout', '--', 'package-lock.json'], appRoot).catch(async () => {
                await run('rm', ['-f', 'package-lock.json'], appRoot).catch(() => ({ stdout: '', stderr: '' }));
            });
        }

        await run('git', ['fetch', 'origin', 'main'], appRoot);
        const local = (await run('git', ['rev-parse', 'HEAD'], appRoot)).stdout.trim();
        const remote = (await run('git', ['rev-parse', 'origin/main'], appRoot)).stdout.trim();

        if (local === remote) {
            return { ok: true, status: 'current', message: 'Hoo Browser is already up to date.' };
        }

        await run('git', ['pull', '--ff-only', 'origin', 'main'], appRoot);
        if (fs.existsSync(path.join(appRoot, 'package-lock.json'))) await run('npm', ['ci', '--no-audit', '--no-fund'], appRoot);
        else await run('npm', ['install', '--no-audit', '--no-fund'], appRoot);
        await run('npm', ['prune', '--omit=optional', '--no-audit', '--no-fund'], appRoot).catch(() => ({ stdout: '', stderr: '' }));
        await run('npm', ['run', 'build'], appRoot);

        return {
            ok: true,
            status: 'updated',
            message: 'Hoo Browser was updated from GitHub. Restart the browser to use the new version.'
        };
    } catch (error: any) {
        return {
            ok: false,
            status: 'failed',
            message: 'Hoo could not complete the update check.',
            details: error?.message || String(error)
        };
    } finally {
        updateInProgress = false;
    }
}
