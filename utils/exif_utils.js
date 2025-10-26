// Minimal EXIF parser to extract capture date from JPEG files
// Returns Promise resolving to { timestamp, dateString } or null if unavailable

function readFileArrayBuffer(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath,
        success: (res) => resolve(res.data),
        fail: (err) => resolve(null)
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function getUint16(view, offset, little) {
  return little ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function getUint32(view, offset, little) {
  return little ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

function toDate(dateStr) {
  // EXIF: YYYY:MM:DD HH:MM:SS
  if (!dateStr || typeof dateStr !== 'string') return null;
  const m = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  const s = parseInt(m[6], 10);
  const ts = new Date(y, mo, d, h, mi, s).getTime();
  if (isNaN(ts)) return null;
  const iso = new Date(ts).toISOString().split('T')[0];
  return { timestamp: ts, dateString: iso };
}

function parseExifDateFromJpeg(buf) {
  if (!buf) return null;
  const view = new DataView(buf);
  // JPEG SOI 0xFFD8
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xFFE1) { // APP1
      const len = view.getUint16(offset, false);
      const start = offset + 2;
      // Check Exif header
      if (start + 6 <= view.byteLength) {
        const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // 'Exif\0\0'
        let ok = true;
        for (let i = 0; i < 6; i++) {
          if (view.getUint8(start + i) !== exifHeader[i]) { ok = false; break; }
        }
        if (!ok) {
          offset = start + len - 2; // jump to next
          continue;
        }
        const tiffStart = start + 6;
        if (tiffStart + 8 > view.byteLength) return null;
        const little = (view.getUint16(tiffStart, false) === 0x4949);
        if (!little && view.getUint16(tiffStart, false) !== 0x4D4D) return null;
        const magic = getUint16(view, tiffStart + 2, little);
        if (magic !== 0x002A) return null;
        const ifd0Offset = getUint32(view, tiffStart + 4, little);
        let ifdOffset = tiffStart + ifd0Offset;
        if (ifdOffset + 2 > view.byteLength) return null;
        const entries = getUint16(view, ifdOffset, little);
        ifdOffset += 2;
        let exifIfdPointer = 0;
        for (let i = 0; i < entries; i++) {
          const entryOffset = ifdOffset + i * 12;
          if (entryOffset + 12 > view.byteLength) break;
          const tag = getUint16(view, entryOffset, little);
          if (tag === 0x8769) { // Exif IFD Pointer
            exifIfdPointer = getUint32(view, entryOffset + 8, little);
          }
        }
        if (!exifIfdPointer) return null;
        let exifIfd = tiffStart + exifIfdPointer;
        if (exifIfd + 2 > view.byteLength) return null;
        const exifEntries = getUint16(view, exifIfd, little);
        exifIfd += 2;
        let dateStr = null;
        for (let i = 0; i < exifEntries; i++) {
          const eo = exifIfd + i * 12;
          if (eo + 12 > view.byteLength) break;
          const tag = getUint16(view, eo, little);
          if (tag === 0x9003 || tag === 0x0132 || tag === 0x9004) { // DateTimeOriginal / DateTime / DateTimeDigitized
            const type = getUint16(view, eo + 2, little); // 2 = ASCII
            const count = getUint32(view, eo + 4, little);
            let valueOffset = getUint32(view, eo + 8, little);
            if (type === 2 && count > 0) {
              let strOffset = tiffStart + valueOffset;
              if (count <= 4) {
                // value stored inline in offset field (rare for dates)
                strOffset = eo + 8;
              }
              const end = Math.min(strOffset + count, view.byteLength);
              let chars = [];
              for (let j = strOffset; j < end; j++) {
                const c = view.getUint8(j);
                if (c === 0) break;
                chars.push(String.fromCharCode(c));
              }
              dateStr = chars.join('');
              const parsed = toDate(dateStr);
              if (parsed) return parsed;
            }
          }
        }
        return null;
      }
      offset = start + len - 2;
    } else if (marker === 0xFFDA) { // SOS start of scan: stop parsing headers
      break;
    } else {
      // Skip other segment
      if (offset + 2 > view.byteLength) break;
      const len = view.getUint16(offset, false);
      offset += 2 + len - 2;
    }
  }
  return null;
}

function extractImageDateWithDebug(filePath) {
  return readFileArrayBuffer(filePath).then((buf) => {
    const debug = { success: false, data: null, reason: '', details: '' };
    try {
      if (!buf) {
        debug.reason = 'read_error';
        debug.details = '无法读取文件数据';
        return debug;
      }
      const view = new DataView(buf);
      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
        debug.reason = 'not_jpeg';
        debug.details = '文件头不是JPEG (SOI)';
        return debug;
      }
      // Search APP1 and Exif
      let offset = 2;
      let foundApp1 = false;
      while (offset + 4 <= view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xFFE1) {
          foundApp1 = true;
          const len = view.getUint16(offset, false);
          const start = offset + 2;
          if (start + 6 > view.byteLength) {
            debug.reason = 'parse_error';
            debug.details = 'APP1 长度异常';
            return debug;
          }
          const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
          let isExif = true;
          for (let i = 0; i < 6; i++) {
            if (view.getUint8(start + i) !== header[i]) { isExif = false; break; }
          }
          if (!isExif) {
            debug.reason = 'no_exif_header';
            debug.details = 'APP1 中无 Exif 头';
            return debug;
          }
          const tiffStart = start + 6;
          const little = (view.getUint16(tiffStart, false) === 0x4949);
          const magic = little ? view.getUint16(tiffStart + 2, true) : view.getUint16(tiffStart + 2, false);
          if (magic !== 0x002A) {
            debug.reason = 'parse_error';
            debug.details = 'TIFF 头魔数不匹配';
            return debug;
          }
          const ifd0Offset = little ? view.getUint32(tiffStart + 4, true) : view.getUint32(tiffStart + 4, false);
          let ifdOffset = tiffStart + ifd0Offset;
          const entries = little ? view.getUint16(ifdOffset, true) : view.getUint16(ifdOffset, false);
          ifdOffset += 2;
          let exifIfdPointer = 0;
          for (let i = 0; i < entries; i++) {
            const eo = ifdOffset + i * 12;
            const tag = little ? view.getUint16(eo, true) : view.getUint16(eo, false);
            if (tag === 0x8769) {
              exifIfdPointer = little ? view.getUint32(eo + 8, true) : view.getUint32(eo + 8, false);
            }
          }
          if (!exifIfdPointer) {
            debug.reason = 'no_exif_ifd';
            debug.details = '未找到 Exif IFD 指针 (0x8769)';
            return debug;
          }
          let exifIfd = tiffStart + exifIfdPointer;
          const exifEntries = little ? view.getUint16(exifIfd, true) : view.getUint16(exifIfd, false);
          exifIfd += 2;
          let dateStr = null;
          for (let i = 0; i < exifEntries; i++) {
            const eo = exifIfd + i * 12;
            const tag = little ? view.getUint16(eo, true) : view.getUint16(eo, false);
            if (tag === 0x9003 || tag === 0x0132 || tag === 0x9004) {
              const type = little ? view.getUint16(eo + 2, true) : view.getUint16(eo + 2, false);
              const count = little ? view.getUint32(eo + 4, true) : view.getUint32(eo + 4, false);
              let valueOffset = little ? view.getUint32(eo + 8, true) : view.getUint32(eo + 8, false);
              if (type === 2 && count > 0) {
                let strOffset = tiffStart + valueOffset;
                if (count <= 4) strOffset = eo + 8;
                const end = Math.min(strOffset + count, view.byteLength);
                let chars = [];
                for (let j = strOffset; j < end; j++) {
                  const c = view.getUint8(j);
                  if (c === 0) break;
                  chars.push(String.fromCharCode(c));
                }
                dateStr = chars.join('');
                const parsed = toDate(dateStr);
                if (parsed) {
                  debug.success = true;
                  debug.data = parsed;
                  debug.details = `读取到标签 0x${tag.toString(16)}: ${dateStr}`;
                  return debug;
                }
              }
            }
          }
          debug.reason = 'not_found';
          debug.details = '未找到日期字段 0x9003/0x0132/0x9004';
          return debug;
        } else if (marker === 0xFFDA) {
          break;
        } else {
          if (offset + 2 > view.byteLength) break;
          const len = view.getUint16(offset, false);
          offset += 2 + len - 2;
        }
      }
      if (!foundApp1) {
        debug.reason = 'no_app1';
        debug.details = 'JPEG 中未找到 APP1 段';
      }
      return debug;
    } catch (e) {
      debug.reason = 'parse_exception';
      debug.details = e && e.message ? e.message : '未知错误';
      return debug;
    }
  });
}

function extractImageDate(filePath) {
  return extractImageDateWithDebug(filePath).then((r) => r && r.success ? r.data : null);
}

module.exports = {
  extractImageDate,
  extractImageDateWithDebug
};
