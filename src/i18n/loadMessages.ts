import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { AppLocale, defaultLocale } from './config';

const messagesRoot = path.join(process.cwd(), 'src', 'i18n', 'messages');

export function loadMessages(locale: AppLocale) {
  const filePath = path.join(messagesRoot, `${locale}.yaml`);
  const fallbackPath = path.join(messagesRoot, `${defaultLocale}.yaml`);
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : fs.readFileSync(fallbackPath, 'utf-8');
  return YAML.parse(source) as Record<string, unknown>;
}
