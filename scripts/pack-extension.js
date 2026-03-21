#!/usr/bin/env node
/**
 * Pack the Chrome extension directory into a self-signed .crx file.
 *
 * Uses the crx3 npm package to:
 *   1. Read data/chrome-extension/
 *   2. Generate or reuse a signing key at data/uab-extension.pem
 *   3. Produce data/uab-bridge.crx
 *   4. Output the extension ID to data/extension-id.txt
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash, generateKeyPairSync } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXT_DIR = resolve(ROOT, 'data/chrome-extension');
const PEM_PATH = resolve(ROOT, 'data/uab-extension.pem');
const CRX_PATH = resolve(ROOT, 'data/uab-bridge.crx');
const ID_PATH = resolve(ROOT, 'data/extension-id.txt');

/**
 * Derive Chrome extension ID from a DER-encoded public key.
 * Chrome uses the first 16 bytes of SHA-256 hash, mapped to a-p.
 */
function deriveExtensionId(publicKeyDer) {
  const hash = createHash('sha256').update(publicKeyDer).digest();
  const first16 = hash.subarray(0, 16);
  return Array.from(first16).map(b => String.fromCharCode(97 + (b % 16))).join('');
}

/**
 * Generate or load a PEM private key for extension signing.
 */
function ensureKey() {
  if (existsSync(PEM_PATH)) {
    console.log('Using existing signing key:', PEM_PATH);
    return readFileSync(PEM_PATH, 'utf-8');
  }

  console.log('Generating new signing key...');
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  writeFileSync(PEM_PATH, privateKey, 'utf-8');
  console.log('Key saved to:', PEM_PATH);
  return privateKey;
}

async function main() {
  console.log('Packing Chrome extension...');
  console.log('Extension directory:', EXT_DIR);

  // Verify extension directory exists
  if (!existsSync(resolve(EXT_DIR, 'manifest.json'))) {
    console.error('ERROR: manifest.json not found in', EXT_DIR);
    process.exit(1);
  }

  // Ensure signing key exists
  const privateKeyPem = ensureKey();

  // Try to use crx3 package
  try {
    const crx3 = await import('crx3');
    const crxPack = crx3.default || crx3;

    await crxPack(resolve(EXT_DIR, 'manifest.json'), {
      crxPath: CRX_PATH,
      keyPath: PEM_PATH,
    });
    console.log('CRX file created:', CRX_PATH);
  } catch (err) {
    // Fallback: manual CRX3 packaging
    console.log('crx3 package not available, using manual CRX3 packing...');
    await packCrx3Manual(privateKeyPem);
  }

  // Derive and write extension ID
  const { createPublicKey } = await import('crypto');
  const pubKey = createPublicKey(privateKeyPem);
  const pubKeyDer = pubKey.export({ type: 'spki', format: 'der' });
  const extensionId = deriveExtensionId(pubKeyDer);

  writeFileSync(ID_PATH, extensionId, 'utf-8');
  console.log('Extension ID:', extensionId);
  console.log('ID written to:', ID_PATH);
  console.log('Done!');
}

/**
 * Manual CRX3 packaging fallback.
 * Creates a CRX3 file from the extension directory without the crx3 npm package.
 */
async function packCrx3Manual(privateKeyPem) {
  const { createSign, createPublicKey } = await import('crypto');
  const { readdirSync, statSync } = await import('fs');
  const { join, relative } = await import('path');

  // Collect all extension files
  function collectFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  const files = collectFiles(EXT_DIR);

  // Create a ZIP of the extension directory
  // Minimal ZIP implementation for the extension files
  const zipParts = [];
  const centralDir = [];
  let offset = 0;

  for (const filePath of files) {
    const relPath = relative(EXT_DIR, filePath).replace(/\\/g, '/');
    const content = readFileSync(filePath);
    const nameBuffer = Buffer.from(relPath, 'utf-8');

    // Local file header
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);  // signature
    header.writeUInt16LE(20, 4);           // version needed
    header.writeUInt16LE(0, 6);            // flags
    header.writeUInt16LE(0, 8);            // compression (none)
    header.writeUInt16LE(0, 10);           // mod time
    header.writeUInt16LE(0, 12);           // mod date
    // CRC32
    const crc = crc32(content);
    header.writeInt32LE(crc, 14);
    header.writeUInt32LE(content.length, 18);  // compressed size
    header.writeUInt32LE(content.length, 22);  // uncompressed size
    header.writeUInt16LE(nameBuffer.length, 26);  // name length
    header.writeUInt16LE(0, 28);           // extra field length

    zipParts.push(header, nameBuffer, content);

    // Central directory entry
    const cdEntry = Buffer.alloc(46);
    cdEntry.writeUInt32LE(0x02014b50, 0);  // signature
    cdEntry.writeUInt16LE(20, 4);           // version made by
    cdEntry.writeUInt16LE(20, 6);           // version needed
    cdEntry.writeUInt16LE(0, 8);            // flags
    cdEntry.writeUInt16LE(0, 10);           // compression
    cdEntry.writeUInt16LE(0, 12);           // mod time
    cdEntry.writeUInt16LE(0, 14);           // mod date
    cdEntry.writeInt32LE(crc, 16);
    cdEntry.writeUInt32LE(content.length, 20);
    cdEntry.writeUInt32LE(content.length, 24);
    cdEntry.writeUInt16LE(nameBuffer.length, 28);
    cdEntry.writeUInt16LE(0, 30);  // extra field length
    cdEntry.writeUInt16LE(0, 32);  // comment length
    cdEntry.writeUInt16LE(0, 34);  // disk number
    cdEntry.writeUInt16LE(0, 36);  // internal attrs
    cdEntry.writeUInt32LE(0, 38);  // external attrs
    cdEntry.writeUInt32LE(offset, 42);  // local header offset

    centralDir.push(cdEntry, nameBuffer);
    offset += 30 + nameBuffer.length + content.length;
  }

  const centralDirBuffer = Buffer.concat(centralDir);
  const centralDirOffset = offset;

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);   // disk number
  eocd.writeUInt16LE(0, 6);   // disk with CD
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);  // comment length

  const zipBuffer = Buffer.concat([...zipParts, centralDirBuffer, eocd]);

  // CRX3 format:
  // "Cr24" magic (4 bytes)
  // version 3 (4 bytes, little-endian)
  // header length (4 bytes, little-endian)
  // CRX3 header (protobuf - signed data)
  // ZIP archive

  // Sign the ZIP
  const pubKey = createPublicKey(privateKeyPem);
  const pubKeyDer = pubKey.export({ type: 'spki', format: 'der' });

  const sign = createSign('SHA256');
  // CRX3 signs: "CRX3 SignedData\x00" + header_size_le32 + signed_header_contents + zip
  const signedHeaderData = createSignedHeaderData(pubKeyDer);
  const signPrefix = Buffer.from('CRX3 SignedData\x00');
  const headerSizeLE = Buffer.alloc(4);
  headerSizeLE.writeUInt32LE(signedHeaderData.length, 0);

  sign.update(signPrefix);
  sign.update(headerSizeLE);
  sign.update(signedHeaderData);
  sign.update(zipBuffer);
  const signature = sign.sign(privateKeyPem);

  // Build CRX3 header protobuf
  const crxHeader = createCrx3Header(pubKeyDer, signature, signedHeaderData);

  // Assemble final CRX3
  const magic = Buffer.from('Cr24');
  const version = Buffer.alloc(4);
  version.writeUInt32LE(3, 0);
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32LE(crxHeader.length, 0);

  const crxFile = Buffer.concat([magic, version, headerLength, crxHeader, zipBuffer]);
  writeFileSync(CRX_PATH, crxFile);
  console.log('CRX3 file created (manual):', CRX_PATH);
}

/**
 * Create protobuf-encoded SignedData for CRX3 header.
 * SignedData { crx_id = SHA256(public_key)[:16] }
 */
function createSignedHeaderData(pubKeyDer) {
  const hash = createHash('sha256').update(pubKeyDer).digest();
  const crxId = hash.subarray(0, 16);
  // Protobuf: field 1, type 2 (length-delimited), crx_id bytes
  return Buffer.concat([
    Buffer.from([0x0A, crxId.length]),
    crxId,
  ]);
}

/**
 * Create protobuf-encoded CRX3FileHeader.
 *
 * CrxFileHeader {
 *   sha256_with_rsa = [AsymmetricKeyProof { public_key, signature }]  // field 2
 *   signed_header_data = bytes  // field 10000
 * }
 */
function createCrx3Header(pubKeyDer, signature, signedHeaderData) {
  // AsymmetricKeyProof { public_key (field 1), signature (field 2) }
  const keyProof = Buffer.concat([
    encodeProtobufField(1, pubKeyDer),
    encodeProtobufField(2, signature),
  ]);

  // CrxFileHeader
  return Buffer.concat([
    encodeProtobufField(2, keyProof),         // sha256_with_rsa (field 2)
    encodeProtobufField(10000, signedHeaderData),  // signed_header_data (field 10000)
  ]);
}

/**
 * Encode a protobuf length-delimited field.
 */
function encodeProtobufField(fieldNumber, data) {
  const wireType = 2; // length-delimited
  const tag = (fieldNumber << 3) | wireType;
  const tagBytes = encodeVarint(tag);
  const lenBytes = encodeVarint(data.length);
  return Buffer.concat([tagBytes, lenBytes, data]);
}

/**
 * Encode an unsigned integer as a protobuf varint.
 */
function encodeVarint(value) {
  const bytes = [];
  while (value > 0x7F) {
    bytes.push((value & 0x7F) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7F);
  return Buffer.from(bytes);
}

/**
 * CRC32 implementation for ZIP entries.
 */
function crc32(buf) {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) | 0;
}

main().catch(err => {
  console.error('Failed to pack extension:', err);
  process.exit(1);
});
