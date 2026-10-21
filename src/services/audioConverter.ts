import { Mp3Encoder } from '@breezystack/lamejs';
import ID3Writer from 'browser-id3-writer';

export interface Mp3Metadata {
  title: string;
  artist: string;
  album?: string;
  coverImageBuffer?: ArrayBuffer;
  coverMimeType?: string;
}

/**
 * Service untuk mengonversi audio format apa pun (AAC, WebM, WAV, OGG)
 * menjadi MP3 standar menggunakan Web Audio API dan Mp3Encoder,
 * serta menyematkan metadata ID3v2 (cover art, judul, artis).
 */
export class AudioConverterService {
  /**
   * Konversi AudioBuffer mentah ke MP3 Uint8Array
   * @param audioBuffer - AudioBuffer yang didapat dari AudioContext
   * @param kbps - Bitrate output MP3 (default 192 kbps)
   * @param onProgress - Callback persentase konversi (0-100)
   * @returns Uint8Array berisi data MP3
   */
  static async audioBufferToMp3(
    audioBuffer: AudioBuffer,
    kbps: 128 | 192 | 320 = 192,
    onProgress?: (percent: number) => void
  ): Promise<Uint8Array> {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numSamples = audioBuffer.length;

    // Inisialisasi LAME MP3 Encoder
    const mp3Encoder = new Mp3Encoder(channels, sampleRate, kbps);
    const mp3Chunks: Uint8Array[] = [];

    // Ambil data float32 dari setiap channel
    const leftFloat = audioBuffer.getChannelData(0);
    const rightFloat = channels > 1 ? audioBuffer.getChannelData(1) : leftFloat;

    // Konversi dalam blok (sample chunk) agar tidak membebani memori
    const sampleBlockSize = 1152;
    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const blockLength = Math.min(sampleBlockSize, numSamples - i);
      
      const leftChunk = new Int16Array(blockLength);
      const rightChunk = new Int16Array(blockLength);

      for (let j = 0; j < blockLength; j++) {
        const leftVal = Math.max(-1, Math.min(1, leftFloat[i + j]));
        leftChunk[j] = leftVal < 0 ? leftVal * 0x8000 : leftVal * 0x7FFF;

        if (channels > 1) {
          const rightVal = Math.max(-1, Math.min(1, rightFloat[i + j]));
          rightChunk[j] = rightVal < 0 ? rightVal * 0x8000 : rightVal * 0x7FFF;
        } else {
          rightChunk[j] = leftChunk[j];
        }
      }

      let mp3buf: Uint8Array;
      if (channels === 1) {
        mp3buf = new Uint8Array(mp3Encoder.encodeBuffer(leftChunk));
      } else {
        mp3buf = new Uint8Array(mp3Encoder.encodeBuffer(leftChunk, rightChunk));
      }

      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf);
      }

      if (onProgress && i % (sampleBlockSize * 10) === 0) {
        onProgress(Math.floor((i / numSamples) * 100));
      }
    }

    // Flush sisa buffer encoder
    const finalBuf = new Uint8Array(mp3Encoder.flush());
    if (finalBuf.length > 0) {
      mp3Chunks.push(finalBuf);
    }

    if (onProgress) onProgress(100);

    // Gabungkan seluruh chunk MP3
    const totalLength = mp3Chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Menyematkan ID3 tag (Judul, Artis, Cover Art) ke file MP3
   * @param mp3Data - Uint8Array MP3
   * @param metadata - Data tag ID3
   * @returns ArrayBuffer MP3 dengan ID3 tag lengkap
   */
  static writeId3Tags(mp3Data: Uint8Array, metadata: Mp3Metadata): ArrayBuffer {
    try {
      const buffer = mp3Data.buffer.slice(0) as ArrayBuffer;
      const writer = new ID3Writer(buffer);
      writer.setFrame('TIT2', metadata.title)
            .setFrame('TPE1', [metadata.artist]);

      if (metadata.album) {
        writer.setFrame('TALB', metadata.album);
      }

      if (metadata.coverImageBuffer) {
        writer.setFrame('APIC', {
          type: 3, // Cover front
          data: metadata.coverImageBuffer,
          description: 'Cover',
          useUnicodeEncoding: false
        });
      }

      writer.addTag();
      return writer.arrayBuffer;
    } catch (err) {
      console.warn('Gagal menambahkan tag ID3, mengembalikan MP3 orisinal:', err);
      return mp3Data.buffer as ArrayBuffer;
    }
  }

  /**
   * Konversi dari ArrayBuffer sumber audio ke file MP3 utuh dengan ID3 Tag
   * @param sourceBuffer - Raw audio array buffer (bisa WebM, AAC, dll.)
   * @param metadata - Metadata lagu
   * @param kbps - Bitrate
   * @param onProgress - Status konversi
   * @returns Blob file .mp3
   */
  static async convertToMp3Blob(
    sourceBuffer: ArrayBuffer,
    metadata: Mp3Metadata,
    kbps: 128 | 192 | 320 = 192,
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    try {
      // Decode audio ke AudioBuffer (PCM)
      const decodedBuffer = await audioContext.decodeAudioData(sourceBuffer);

      // Encode PCM ke MP3
      const mp3Data = await this.audioBufferToMp3(decodedBuffer, kbps, onProgress);

      // Tulis tag ID3
      const taggedMp3Buffer = this.writeId3Tags(mp3Data, metadata);

      return new Blob([taggedMp3Buffer], { type: 'audio/mp3' });
    } finally {
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
  }
}
