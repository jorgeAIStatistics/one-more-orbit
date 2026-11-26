// The public build (the release pass, 2026-11-26). Developer tools (the testing rows in Settings, the test chambers,
// Record Mode, the phone check, the tap log, the debug hooks on window, the URL options) exist only in the dev server
// and in the checks' build (`vite build --mode checks`); the build friends play has none of them.
export const TOOLS: boolean = import.meta.env.DEV || import.meta.env.MODE === 'checks';
/** the version shown in Settings: package.json's, and the day it was built */
export const VERSION: string = `${__APP_VERSION__} · ${__BUILD_DATE__}`;
/** where "Send feedback" goes (a mailto: or a form's link), from VITE_FEEDBACK_URL in .env; none: the row is hidden */
export const FEEDBACK: string = (import.meta.env.VITE_FEEDBACK_URL as string | undefined) ?? '';
