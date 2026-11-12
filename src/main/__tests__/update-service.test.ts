import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// update-service.ts imports `app` from electron at module load. Swap it for a
// deterministic fake so the channel/decision logic runs in plain Node.
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getAppPath: () => path.join(os.tmpdir(), 'hoo-update-test-app'),
        getPath: (_name: string) => os.tmpdir(),
        getVersion: () => '0.6.0',
        relaunch: vi.fn(),
        exit: vi.fn(),
    },
}));

import {
    resolveUpdateChannel,
    shouldAutoCheckOnStartup,
    formatDownloadProgress,
    friendlyUpdaterError,
} from '../update-service';

describe('resolveUpdateChannel', () => {
    it('prefers electron-updater for packaged installs even beside a source checkout', () => {
        expect(resolveUpdateChannel({ isPackaged: true, hasGitRepo: true })).toBe('electron-updater');
        expect(resolveUpdateChannel({ isPackaged: true, hasGitRepo: false })).toBe('electron-updater');
    });

    it('falls back to the git updater for source checkouts', () => {
        expect(resolveUpdateChannel({ isPackaged: false, hasGitRepo: true })).toBe('git-source');
    });

    it('reports none when neither channel exists', () => {
        expect(resolveUpdateChannel({ isPackaged: false, hasGitRepo: false })).toBe('none');
    });
});

describe('shouldAutoCheckOnStartup', () => {
    it('packaged installs auto-check unless explicitly disabled', () => {
        expect(shouldAutoCheckOnStartup({ isPackaged: true })).toBe(true);
        expect(shouldAutoCheckOnStartup({ isPackaged: true, disabledEnv: '0' })).toBe(true);
        expect(shouldAutoCheckOnStartup({ isPackaged: true, disabledEnv: '1' })).toBe(false);
    });

    it('source checkouts never phone out on startup', () => {
        expect(shouldAutoCheckOnStartup({ isPackaged: false })).toBe(false);
        expect(shouldAutoCheckOnStartup({ isPackaged: false, disabledEnv: undefined })).toBe(false);
    });
});

describe('formatDownloadProgress', () => {
    it('renders percent with transfer sizes when both are known', () => {
        const text = formatDownloadProgress({
            percent: 42.34,
            transferred: 15.1 * 1024 * 1024,
            total: 35.6 * 1024 * 1024,
        });
        expect(text).toBe('42.3% (15.1 MB of 35.6 MB)');
    });

    it('falls back to percent only when sizes are missing', () => {
        expect(formatDownloadProgress({ percent: 7.5, total: null, transferred: null })).toBe('7.5%');
        expect(formatDownloadProgress({ percent: 100, transferred: 0, total: 0 })).toBe('100.0%');
    });

    it('stays calm when the updater has no numbers yet', () => {
        expect(formatDownloadProgress({})).toBe('Downloading update…');
        expect(formatDownloadProgress({ percent: Number.NaN })).toBe('Downloading update…');
    });

    it('clamps runaway percent values into 0-100', () => {
        expect(formatDownloadProgress({ percent: 187.2 })).toBe('100.0%');
        expect(formatDownloadProgress({ percent: -12 })).toBe('0.0%');
    });
});

describe('friendlyUpdaterError', () => {
    it('translates network failures into a retry promise', () => {
        const text = friendlyUpdaterError(new Error('network: ERR_INTERNET_DISCONNECTED\n    at ...'));
        expect(text).toBe('Hoo could not reach GitHub. Updates will retry the next time Hoo starts.');
    });

    it('points unsigned platforms at GitHub Releases', () => {
        const text = friendlyUpdaterError(new Error('Could not verify code signature of the downloaded update'));
        expect(text).toContain('GitHub Releases');
    });

    it('keeps the first readable line and trims noise', () => {
        const text = friendlyUpdaterError(new Error('Something odd happened\nstack line 1\nstack line 2'));
        expect(text).toBe('Something odd happened');
    });

    it('caps absurdly long single-line errors', () => {
        const long = 'x'.repeat(400);
        const text = friendlyUpdaterError(long);
        expect(text.length).toBeLessThanOrEqual(178);
        expect(text.endsWith('…')).toBe(true);
    });

    it('survives null-ish input', () => {
        expect(typeof friendlyUpdaterError(undefined)).toBe('string');
        expect(typeof friendlyUpdaterError(null)).toBe('string');
    });
});
