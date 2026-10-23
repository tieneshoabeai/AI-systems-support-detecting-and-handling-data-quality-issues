import { config } from 'dotenv';
import { resolve } from 'path';

const configPath = process.env.DOTENV_CONFIG_PATH ?? '.env';
config({ path: resolve(process.cwd(), configPath), override: true });
