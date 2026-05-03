import { app } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

type UpdateResult = {
    ok: boolean;
    status: 'updated' | 'current' | 'unsupported' | 'busy' | 'failed' | 'restart-required';
    message: string;
    details?: string;
    appRoot?: string;
    before?: string;
    after?: string;
    installRan?: boolean;
    buildRan?: boolean;
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
                details: `Detected app root: ${appRoot}\nRun this manually instead:\ncd ~/.local/share/hoo-browser && git pull origin main && npm install --no-audit --no-fund --prefer-offline && npm run build`,
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

        await run('git', ['fetch', '--prune', '--quiet', 'origin', 'main'], appRoot, 1000 * 60 * 3);
        const local = (await run('git', ['rev-parse', 'HEAD'], appRoot)).stdout.trim();
        const remote = (await run('git', ['rev-parse', 'origin/main'], appRoot)).stdout.trim();

        if (local === remote) {
            return { ok: true, status: 'current', message: 'Hoo Browser is already up to date.', details: `Checked: ${appRoot}`, appRoot, before: local, after: remote };
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
            appRoot,
            before: local,
            after: remote,
            installRan: needsInstall,
            buildRan: needsBuild
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
