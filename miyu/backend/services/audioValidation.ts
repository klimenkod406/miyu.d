import fsp from 'fs/promises';

export async function isProbablyMp3File(filePath: string): Promise<boolean> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < 3) return false;

    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return true;
    }

    return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  } finally {
    await handle.close();
  }
}
