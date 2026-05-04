export type HooWallpaper = {
    id: string;
    name: string;
    kind: 'image' | 'gradient';
    value: string;
    position?: string;
};

export const HOO_WALLPAPER_STORAGE_KEY = 'hoo:home-wallpaper';

// Keep wallpapers lightweight. The first item points to the branded owl wallpaper file.
// If the file is unavailable in a local build, Home.tsx falls back to the SVG wallpaper.
export const HOO_WALLPAPERS: HooWallpaper[] = [
    {
        id: 'owl-night',
        name: 'Owl Night',
        kind: 'image',
        value: 'assets/branding/hoo-owl-wallpaper.png',
        position: 'center'
    },
    {
        id: 'forest-dusk',
        name: 'Forest Dusk',
        kind: 'gradient',
        value: 'radial-gradient(circle at 22% 38%, rgba(255,106,0,.24), transparent 28%), radial-gradient(circle at 76% 78%, rgba(0,90,58,.26), transparent 31%), linear-gradient(135deg, #020504 0%, #07100d 44%, #120903 100%)'
    },
    {
        id: 'midnight',
        name: 'Midnight',
        kind: 'gradient',
        value: 'radial-gradient(circle at 72% 18%, rgba(255,255,255,.08), transparent 26%), radial-gradient(circle at 18% 82%, rgba(255,106,0,.18), transparent 34%), linear-gradient(135deg, #030303 0%, #081116 54%, #030303 100%)'
    },
    {
        id: 'plain-black',
        name: 'Plain Black',
        kind: 'gradient',
        value: 'linear-gradient(135deg, #050505 0%, #090909 50%, #030303 100%)'
    },
    {
        id: 'amber-low-data',
        name: 'Amber Low Data',
        kind: 'gradient',
        value: 'linear-gradient(135deg, #050505 0%, #120802 48%, #050505 100%)'
    }
];

export function getWallpaperById(id?: string | null): HooWallpaper {
    return HOO_WALLPAPERS.find(wallpaper => wallpaper.id === id) || HOO_WALLPAPERS[0];
}
