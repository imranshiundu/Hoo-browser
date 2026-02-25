import { BrowserWindow, ipcMain, safeStorage } from 'electron';
import { StorageService } from './storage';

// Placeholder Client ID - User needs to replace this
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REDIRECT_URI = 'http://localhost:1234'; // We'll intercept this

export class AuthService {
    static async login(parentWindow: BrowserWindow) {
        return new Promise((resolve, reject) => {
            const authWindow = new BrowserWindow({
                width: 500,
                height: 600,
                show: false,
                parent: parentWindow,
                modal: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            const authUrl = `${GOOGLE_AUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile email`;

            authWindow.loadURL(authUrl);
            authWindow.show();

            const handleNavigation = (url: string) => {
                if (url.startsWith(REDIRECT_URI)) {
                    const urlParams = new URL(url);
                    const code = urlParams.searchParams.get('code');
                    if (code) {
                        authWindow.close();
                        resolve(code);
                    }
                }
            };

            authWindow.webContents.on('will-navigate', (event, url) => handleNavigation(url));
            authWindow.webContents.on('will-redirect', (event, url) => handleNavigation(url));

            authWindow.on('closed', () => {
                reject(new Error('Login cancelled by user'));
            });
        });
    }

    static async getProfile(token: string) {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        return await response.json();
    }
}

export function setupAuthHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('google-login', async () => {
        try {
            // In a real app, you'd exchange the code for a token here
            // For now, we'll simulate the successful login and save to storage
            // This is a placeholder for the actual OAuth exchange logic
            const userProfile = {
                name: 'Imran Shiundu',
                email: 'imran@example.com',
                picture: 'https://lh3.googleusercontent.com/a/ACg8ocL...'
            };

            const currentData = StorageService.load();
            StorageService.save({
                settings: {
                    ...currentData.settings,
                    user: userProfile,
                    isLoggedIn: true
                }
            });

            return userProfile;
        } catch (error) {
            console.error('[Auth] Login failed:', error);
            throw error;
        }
    });

    ipcMain.handle('google-logout', async () => {
        const currentData = StorageService.load();
        StorageService.save({
            settings: {
                ...currentData.settings,
                user: null,
                isLoggedIn: false
            }
        });
        return true;
    });
}
