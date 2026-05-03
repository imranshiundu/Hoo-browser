import { app } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

type UpdateResult = {
    ok: boolean;
    status: 'updated' | 'current' | 'unsupported' | 'busy' | 'failed';
    message: string;
    details?: string;
    appRoot?: string;
};

let updateInProgress = false;

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

function run(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, timeout: 1000 * 60 * 15, env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } }, (error, stdout, stderr) => {
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
                message: 'This copy is not running from the source repo, so Hoo cannot safely pull GitHub updates from inside the app.',
                details: `Detected app root: ${appRoot}\nRun this manually instead:\ncd ~/.local/share/hoo-browser && git pull origin main && npm install --no-audit --no-fund && npm run build`,
                appRoot
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
                appRoot
            };
        }

        await run('git', ['fetch', '--prune', 'origin', 'main'], appRoot);
        const local = (await run('git', ['rev-parse', 'HEAD'], appRoot)).stdout.trim();
        const remote = (await run('git', ['rev-parse', 'origin/main'], appRoot)).stdout.trim();

        if (local === remote) {
            return { ok: true, status: 'current', message: 'Hoo Browser is already up to date.', details: `Checked: ${appRoot}`, appRoot };
        }

        await run('git', ['pull', '--ff-only', 'origin', 'main'], appRoot);
        if (fs.existsSync(path.join(appRoot, 'package-lock.json'))) await run('npm', ['install', '--no-audit', '--no-fund'], appRoot);
        else await run('npm', ['install', '--no-audit', '--no-fund'], appRoot);
        await run('npm', ['run', 'build'], appRoot);

        return {
            ok: true,
            status: 'updated',
            message: 'Hoo Browser was updated from GitHub. Restart the browser to use the new version.',
            details: `Updated: ${appRoot}`,
            appRoot
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
