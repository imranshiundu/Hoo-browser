import 'electron';

declare module 'electron' {
    interface HandlerDetails {
        action: 'allow' | 'deny';
        overrideBrowserWindowOptions?: BrowserWindowConstructorOptions;
        outlivesOpener?: boolean;
    }
}
