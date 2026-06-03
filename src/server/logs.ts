import fs from 'fs';

export interface ReadTextLogResult {
  offset: number;
  text: string;
  full_text: string;
  reset: boolean;
}

export function readTextLogFile(filePath: string, offset: number): ReadTextLogResult {
  if (!fs.existsSync(filePath)) {
    return { offset: 0, text: '', full_text: '', reset: offset !== 0 };
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  if (offset <= 0 || offset > data.length) {
    return {
      offset: data.length,
      text: data,
      full_text: data,
      reset: true,
    };
  }

  return {
    offset: data.length,
    text: data.slice(offset),
    full_text: data,
    reset: false,
  };
}
