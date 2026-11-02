export async function* parseSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data = [];
  const dispatch = () => {
    if (!data.length) { event = 'message'; return null; }
    const item = { event, data: data.join('\n') };
    event = 'message'; data = [];
    return item;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      let boundary;
      while ((boundary = /\r\n|\n|\r/.exec(buffer))) {
        if (boundary[0] === '\r' && boundary.index === buffer.length - 1 && !done) break;
        const line = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (!line) {
          const item = dispatch();
          if (item) yield item;
        } else if (line.startsWith(':')) {
          continue;
        } else {
          const colon = line.indexOf(':');
          const field = colon < 0 ? line : line.slice(0, colon);
          let value = colon < 0 ? '' : line.slice(colon + 1);
          if (value.startsWith(' ')) value = value.slice(1);
          if (field === 'event') event = value;
          if (field === 'data') data.push(value);
        }
      }
      if (done) break;
    }
    if (buffer) {
      const line = buffer;
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      else if (line.startsWith('event:')) event = line.slice(6).replace(/^ /, '');
    }
    const final = dispatch();
    if (final) yield final;
  } finally {
    reader.releaseLock();
  }
}
