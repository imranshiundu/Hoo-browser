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

    // Development / source install launched through npm from the repo root.
    if (fs.existsSync(path.join(appPath, '.git'))) {
        return appPath;
    }

    // Packaged Electron apps can point at resources/app or app.asar.
    // Walk up a few levels to find a source-style install created by scripts/install-hoo.sh.
    let current = appPath;
    for (let i = 0; i < 5; i += 1) {
        if (fs.existsSync(path.join(current, '.git'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    return appPath;
}

function run(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, timeout: 1000 * 60 * 8 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`${error.message}\n${stderr || ''}`.trim()));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

export async function checkForHooUpdates(): Promise<UpdateResult> {
    if (updateInProgress) {
        return {
            ok: false,
            status: 'busy',
            message: 'Hoo is already checking for updates.'
        };
    }

    updateInProgress = true;

    try {
        const appRoot = resolveAppRoot();
        const gitDir = path.join(appRoot, '.git');

        if (!fs.existsSync(gitDir)) {
            return {
                ok: false,
                status: 'unsupported',
                message: 'Manual GitHub updates work only for source installs created from the GitHub repo. Packaged AppImage/deb updates need a signed release updater next.',
                details: `App path: ${appRoot}`
            };
        }

        const status = await run('git', ['status', '--porcelain'], appRoot);
        if (status.stdout.trim()) {
            return {
                ok: false,
                status: 'failed',
                message: 'Update skipped because this install has local changes. Hoo will not overwrite your work.',
                details: status.stdout.trim()
            };
        }

        await run('git', ['fetch', 'origin', 'main'], appRoot);

        const local = (await run('git', ['rev-parse', 'HEAD'], appRoot)).stdout.trim();
        const remote = (await run('git', ['rev-parse', 'origin/main'], appRoot)).stdout.trim();

        if (local === remote) {
            return {
                ok: true,
                status: 'current',
                message: 'Hoo Browser is already up to date.'
            };
        }

        await run('git', ['pull', '--ff-only', 'origin', 'main'], appRoot);
        await run('npm', ['install'], appRoot);
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
