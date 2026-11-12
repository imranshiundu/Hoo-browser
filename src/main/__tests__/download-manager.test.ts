import { describe, expect, it, vi } from 'vitest';

// download-manager.ts pulls electron APIs at module load; only the two pure
// helpers are under test here, so give electron a minimal stub.
vi.mock('electron', () => ({
    app: { getPath: () => '/tmp/hoo-download-test' },
    BrowserWindow: vi.fn(),
    DownloadItem: vi.fn(),
    session: {},
    shell: {},
}));

import { riskyFileHint, sanitizeFilename } from '../download-manager';

describe('sanitizeFilename', () => {
    it('replaces filesystem-hostile characters with underscores', () => {
        expect(sanitizeFilename('my report: final?.pdf')).toBe('my report_ final_.pdf');
        expect(sanitizeFilename('path/to/file.exe')).toBe('path_to_file.exe');
    });

    it('falls back to a hoo-prefixed name for empty input', () => {
        expect(sanitizeFilename('')).toMatch(/^hoo-download-\d+$/);
        expect(sanitizeFilename('///')).toMatch(/^hoo-download-\d+$/);
    });

    it('keeps normal filenames untouched', () => {
        expect(sanitizeFilename('duckduckgo-privacy.pdf')).toBe('duckduckgo-privacy.pdf');
    });
});

describe('riskyFileHint', () => {
    it('warns about executable and installer extensions', () => {
        for (const name of ['setup.exe', 'installer.msi', 'run.bat', 'job.ps1', 'trick.scr', 'app.apk', 'pkg.deb']) {
            expect(riskyFileHint(name)).toContain('Executable or installer file');
        }
    });

    it('stays silent for ordinary files', () => {
        expect(riskyFileHint('photo.jpg')).toBeUndefined();
        expect(riskyFileHint('report.pdf')).toBeUndefined();
        expect(riskyFileHint('archive.zip')).toBeUndefined();
        expect(riskyFileHint('no-extension')).toBeUndefined();
    });
});
