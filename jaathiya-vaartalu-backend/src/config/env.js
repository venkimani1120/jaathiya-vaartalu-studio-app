// Loads environment variables for the current environment, before anything else reads process.env.
// APP_ENV comes from NODE_ENV; on Render (which sets RENDER=true) it defaults to production, elsewhere to development.
// Files, first match wins per variable: real environment (Render dashboard) > .env.<env> > .env
const path = require('path');
const dotenv = require('dotenv');

const APP_ENV = process.env.NODE_ENV || (process.env.RENDER ? 'production' : 'development');
process.env.NODE_ENV = APP_ENV;
const root = path.join(__dirname, '../..');
dotenv.config({ path: [path.join(root, `.env.${APP_ENV}`), path.join(root, '.env')], quiet: true });

module.exports = { APP_ENV, isProd: APP_ENV === 'production' };
